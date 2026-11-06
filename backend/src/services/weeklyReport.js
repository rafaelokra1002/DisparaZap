// Relatório semanal enviado no WhatsApp de cada cliente (segunda-feira, 9h
// de Brasília), a partir do número do sistema (sessão global).
const prisma = require('../lib/prisma');
const whatsappService = require('./whatsappService');
const { getUserAccessState } = require('../lib/access');
const { TIMEZONE, getGroupStats, getHourStats } = require('../lib/insights');

const REPORT_WEEKDAY = 1; // segunda-feira
const REPORT_HOUR = 9;
const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const MIN_DAYS_BETWEEN_REPORTS = 6;

function getLocalParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const weekdayName = parts.find((p) => p.type === 'weekday')?.value;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayName);
  return { weekday, hour };
}

// Telefone salvo só com dígitos; sem DDI assume Brasil.
function normalizeReportPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  if (digits.length >= 12 && digits.length <= 13) {
    return digits;
  }
  return null;
}

function formatPerSend(value) {
  return value.toFixed(2).replace('.', ',');
}

async function buildWeeklyReport(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [sends, failed, clicks, privateContacts, groupStats, hourStats] = await Promise.all([
    prisma.sendLog.count({ where: { ad: { userId }, status: 'sent', sentAt: { gte: since } } }),
    prisma.sendLog.count({ where: { ad: { userId }, status: 'failed', sentAt: { gte: since } } }),
    prisma.click.count({ where: { ad: { userId }, clickedAt: { gte: since } } }),
    prisma.privateContact.count({ where: { userId, firstAt: { gte: since } } }),
    getGroupStats(userId, 7),
    getHourStats(userId, 30),
  ]);

  const distinctGroups = await prisma.sendLog.findMany({
    where: { ad: { userId }, status: 'sent', sentAt: { gte: since } },
    distinct: ['groupId'],
    select: { groupId: true },
  });

  const bestGroup = groupStats.groups.find((g) => g.clicks > 0) || null;
  const deadGroups = groupStats.groups.filter((g) => g.dead).length;
  const ctr = sends > 0 ? clicks / sends : 0;
  const firstName = (user?.name || '').trim().split(/\s+/)[0] || '';
  const panelUrl = `${process.env.FRONTEND_URL || 'http://localhost:3003'}/painel`;

  const lines = [
    '📊 *Seu resumo semanal — DisparaZap*',
    '',
    `Olá${firstName ? `, ${firstName}` : ''}! Veja como foram seus últimos 7 dias:`,
    '',
    `📤 *${sends}* envios em *${distinctGroups.length}* grupos`,
    `🖱️ *${clicks}* cliques no seu link (${formatPerSend(ctr)} por envio)`,
  ];

  if (privateContacts > 0) {
    lines.push(`💬 *${privateContacts}* novas pessoas chamaram no seu privado`);
  }
  if (bestGroup) {
    lines.push(`🏆 Melhor grupo: *${bestGroup.groupName}* (${bestGroup.clicks} cliques)`);
  }
  if (hourStats.best && hourStats.best.clicks > 0) {
    lines.push(`🕐 Melhor horário para postar: *${hourStats.best.hour}h*`);
  }
  if (deadGroups > 0) {
    lines.push(`⚠️ *${deadGroups}* grupos não deram nenhum clique. Ative o modo inteligente para pular esses grupos.`);
  }
  if (failed > 0 && failed / Math.max(1, sends + failed) > 0.1) {
    lines.push(`🛡️ ${failed} envios falharam. Confira a saúde do seu número no painel.`);
  }

  lines.push('', `Veja os detalhes na aba *Inteligência*: ${panelUrl}`);
  lines.push('', '_Para não receber mais este resumo, desative em Automações no painel._');

  return { text: lines.join('\n'), sends, clicks };
}

async function sendWeeklyReport(user, { markSent = true } = {}) {
  const phone = normalizeReportPhone(user.phone);
  if (!phone) {
    throw new Error('Telefone inválido ou não cadastrado');
  }
  const report = await buildWeeklyReport(user.id);
  await whatsappService.sendToPhoneFromGlobal(phone, report.text);
  if (markSent) {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastWeeklyReportAt: new Date() },
    });
  }
  return report;
}

let running = false;

async function runWeeklyReports() {
  if (running) {
    return;
  }
  const { weekday, hour } = getLocalParts();
  if (weekday !== REPORT_WEEKDAY || hour !== REPORT_HOUR) {
    return;
  }
  if (whatsappService.getSessionStatusById(whatsappService.GLOBAL_SESSION_ID) !== 'connected') {
    console.log('📊 Relatório semanal: WhatsApp do sistema desconectado, tentando na próxima verificação.');
    return;
  }

  running = true;
  try {
    const cutoff = new Date(Date.now() - MIN_DAYS_BETWEEN_REPORTS * 24 * 60 * 60 * 1000);
    const users = await prisma.user.findMany({
      where: {
        weeklyReportEnabled: true,
        phone: { not: null },
        OR: [{ lastWeeklyReportAt: null }, { lastWeeklyReportAt: { lt: cutoff } }],
      },
      select: { id: true, phone: true, email: true, plan: true, planExpiresAt: true, createdAt: true },
    });

    for (const user of users) {
      if (!getUserAccessState(user).hasSystemAccess) {
        continue;
      }

      // Não manda relatório vazio para quem não usou o sistema na semana.
      const weekSends = await prisma.sendLog.count({
        where: { ad: { userId: user.id }, status: 'sent', sentAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      });
      if (weekSends === 0) {
        continue;
      }

      try {
        await sendWeeklyReport(user);
        console.log(`📊 Relatório semanal enviado para ${user.id}`);
      } catch (error) {
        console.warn(`📊 Relatório semanal não enviado para ${user.id}: ${error.message}`);
      }

      // Espaça os envios do número do sistema.
      await new Promise((resolve) => setTimeout(resolve, 8000 + Math.floor(Math.random() * 12000)));
    }
  } catch (error) {
    console.error('❌ Erro no relatório semanal:', error.message);
  } finally {
    running = false;
  }
}

function startWeeklyReportScheduler() {
  setInterval(runWeeklyReports, CHECK_INTERVAL_MS);
  console.log('📊 Relatório semanal agendado (segundas, 9h de Brasília)');
}

module.exports = {
  buildWeeklyReport,
  sendWeeklyReport,
  normalizeReportPhone,
  startWeeklyReportScheduler,
};
