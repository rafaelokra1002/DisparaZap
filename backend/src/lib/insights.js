// Inteligencia de envios: links por envio, teste A/B de variacoes,
// ranking de grupos, melhores horarios e saude do numero.
const crypto = require('crypto');
const prisma = require('./prisma');

const TIMEZONE = 'America/Sao_Paulo';
const RANKING_WINDOW_DAYS = 30;
// Grupo "morto": recebeu pelo menos isso de envios rastreados sem nenhum clique.
const DEAD_GROUP_MIN_SENDS = 8;
// Peso da media geral no score de cada grupo (suaviza grupos com poucos envios).
const SMOOTHING_SENDS = 5;
// Cada variacao recebe ao menos isso de envios antes de o sistema escolher a melhor.
const VARIANT_MIN_SENDS = 20;
const VARIANT_EXPLORE_RATE = 0.2;

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

// 10 caracteres base62: nao colide com os trackingId antigos (8 hex) dos anuncios.
function generateTrackingCode() {
  const bytes = crypto.randomBytes(10);
  let code = '';
  for (const byte of bytes) {
    code += BASE62[byte % BASE62.length];
  }
  return code;
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// Corpo enviado: legenda (quando o envio e imagem) ou texto.
function getAdBody(ad) {
  if (ad.captionActive && ad.imageUrl && ad.caption) {
    return { kind: 'image', body: ad.caption };
  }
  if (ad.textActive && ad.text) {
    return { kind: 'text', body: ad.text };
  }
  return { kind: null, body: null };
}

function normalizeVariants(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

// Lista completa: indice 0 = texto/legenda original, depois as variacoes.
function getAdVariants(ad) {
  const { body } = getAdBody(ad);
  if (!body) {
    return [];
  }
  return [body, ...normalizeVariants(ad.textVariants)];
}

async function getVariantStats(adId) {
  const [sends, clicks] = await Promise.all([
    prisma.sendLog.groupBy({
      by: ['variantIndex'],
      where: { adId, status: 'sent', trackingCode: { not: null } },
      _count: { _all: true },
    }),
    prisma.click.groupBy({
      by: ['variantIndex'],
      where: { adId, variantIndex: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const stats = new Map();
  for (const row of sends) {
    stats.set(row.variantIndex ?? 0, { sends: row._count._all, clicks: 0 });
  }
  for (const row of clicks) {
    const key = row.variantIndex ?? 0;
    const entry = stats.get(key) || { sends: 0, clicks: 0 };
    entry.clicks = row._count._all;
    stats.set(key, entry);
  }
  return stats;
}

// Escolhe qual variacao enviar: primeiro garante amostra minima para todas,
// depois manda a de melhor taxa de clique na maioria das vezes (80%).
async function pickVariant(ad) {
  const variants = getAdVariants(ad);
  if (variants.length <= 1) {
    return { index: 0, body: variants[0] || null };
  }

  const stats = await getVariantStats(ad.id);
  const rows = variants.map((body, index) => {
    const s = stats.get(index) || { sends: 0, clicks: 0 };
    return { index, body, sends: s.sends, clicks: s.clicks };
  });

  const undersampled = rows.filter((row) => row.sends < VARIANT_MIN_SENDS);
  if (undersampled.length > 0) {
    const minSends = Math.min(...undersampled.map((row) => row.sends));
    const candidates = undersampled.filter((row) => row.sends === minSends);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  if (Math.random() < VARIANT_EXPLORE_RATE) {
    return rows[Math.floor(Math.random() * rows.length)];
  }

  return rows.reduce((best, row) => (
    row.clicks / row.sends > best.clicks / best.sends ? row : best
  ));
}

async function getVariantReport(ad) {
  const variants = getAdVariants(ad);
  if (variants.length === 0) {
    return [];
  }
  const stats = await getVariantStats(ad.id);
  return variants.map((body, index) => {
    const s = stats.get(index) || { sends: 0, clicks: 0 };
    return {
      index,
      label: index === 0 ? 'Original' : `Variação ${index}`,
      body,
      sends: s.sends,
      clicks: s.clicks,
      ctr: s.sends > 0 ? s.clicks / s.sends : 0,
      ready: s.sends >= VARIANT_MIN_SENDS,
    };
  });
}

// Envios e cliques por grupo, so com envios que tiveram link rastreado por envio.
async function getGroupStats(userId, days = RANKING_WINDOW_DAYS) {
  const since = daysAgo(days);

  const [sendRows, clickRows] = await Promise.all([
    prisma.$queryRaw`
      SELECT s."groupId",
             (array_agg(s."groupName" ORDER BY s."sentAt" DESC))[1] AS "groupName",
             COUNT(*)::int AS sends,
             MAX(s."sentAt") AS "lastSentAt"
      FROM "SendLog" s
      INNER JOIN "Ad" a ON a."id" = s."adId"
      WHERE a."userId" = ${userId}
        AND s."status" = 'sent'
        AND s."trackingCode" IS NOT NULL
        AND s."sentAt" >= ${since}
      GROUP BY s."groupId"
    `,
    prisma.$queryRaw`
      SELECT c."groupId",
             COUNT(*)::int AS clicks,
             COUNT(DISTINCT COALESCE(c."ip", c."id"))::int AS "uniqueClicks"
      FROM "Click" c
      INNER JOIN "Ad" a ON a."id" = c."adId"
      WHERE a."userId" = ${userId}
        AND c."groupId" IS NOT NULL
        AND c."clickedAt" >= ${since}
      GROUP BY c."groupId"
    `,
  ]);

  const clicksByGroup = new Map(clickRows.map((row) => [row.groupId, row]));
  const totalSends = sendRows.reduce((sum, row) => sum + row.sends, 0);
  const totalClicks = clickRows.reduce((sum, row) => sum + row.uniqueClicks, 0);
  const globalCtr = totalSends > 0 ? totalClicks / totalSends : 0;

  const groups = sendRows.map((row) => {
    const clickRow = clicksByGroup.get(row.groupId);
    const clicks = clickRow ? clickRow.uniqueClicks : 0;
    const ctr = row.sends > 0 ? clicks / row.sends : 0;
    const score = (clicks + SMOOTHING_SENDS * globalCtr) / (row.sends + SMOOTHING_SENDS);
    return {
      groupId: row.groupId,
      groupName: row.groupName || row.groupId,
      sends: row.sends,
      clicks,
      totalClicks: clickRow ? clickRow.clicks : 0,
      ctr,
      score,
      lastSentAt: row.lastSentAt,
      dead: row.sends >= DEAD_GROUP_MIN_SENDS && clicks === 0,
      clickShare: totalClicks > 0 ? clicks / totalClicks : 0,
    };
  });

  groups.sort((a, b) => b.score - a.score || b.clicks - a.clicks);

  return { groups, totalSends, totalClicks, globalCtr, days };
}

// Melhores horarios de POSTAGEM: taxa de clique por hora do envio (horario de Brasilia).
async function getHourStats(userId, days = RANKING_WINDOW_DAYS) {
  const since = daysAgo(days);

  const [sendRows, clickRows] = await Promise.all([
    prisma.$queryRaw`
      SELECT EXTRACT(HOUR FROM (s."sentAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TIMEZONE})::int AS hour,
             COUNT(*)::int AS sends
      FROM "SendLog" s
      INNER JOIN "Ad" a ON a."id" = s."adId"
      WHERE a."userId" = ${userId}
        AND s."status" = 'sent'
        AND s."trackingCode" IS NOT NULL
        AND s."sentAt" >= ${since}
      GROUP BY hour
    `,
    prisma.$queryRaw`
      SELECT EXTRACT(HOUR FROM (s."sentAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TIMEZONE})::int AS hour,
             COUNT(DISTINCT COALESCE(c."ip", c."id"))::int AS clicks
      FROM "Click" c
      INNER JOIN "SendLog" s ON s."id" = c."sendLogId"
      INNER JOIN "Ad" a ON a."id" = c."adId"
      WHERE a."userId" = ${userId}
        AND s."sentAt" >= ${since}
      GROUP BY hour
    `,
  ]);

  const sendsByHour = new Map(sendRows.map((row) => [row.hour, row.sends]));
  const clicksByHour = new Map(clickRows.map((row) => [row.hour, row.clicks]));

  const hours = Array.from({ length: 24 }, (_, hour) => {
    const sends = sendsByHour.get(hour) || 0;
    const clicks = clicksByHour.get(hour) || 0;
    return { hour, sends, clicks, ctr: sends > 0 ? clicks / sends : 0 };
  });

  // So considera horarios com amostra minima para nao eleger um horario com 1 envio.
  const eligible = hours.filter((h) => h.sends >= 5);
  const best = eligible.length > 0
    ? eligible.reduce((a, b) => (b.ctr > a.ctr ? b : a))
    : null;
  const worst = eligible.length > 1
    ? eligible.reduce((a, b) => (b.ctr < a.ctr ? b : a))
    : null;

  return { hours, best, worst };
}

async function getUserSmartSettings(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { smartGroupsEnabled: true },
  });
  return { smartGroupsEnabled: !!user?.smartGroupsEnabled };
}

// Modo inteligente: ordena os grupos pelo score e pula os grupos mortos.
// Nunca devolve lista vazia: se todos forem "mortos", mantem todos.
async function prioritizeGroups(userId, groups) {
  const { smartGroupsEnabled } = await getUserSmartSettings(userId);
  if (!smartGroupsEnabled || !Array.isArray(groups) || groups.length <= 1) {
    return { groups, skipped: [] };
  }

  const { groups: stats, globalCtr } = await getGroupStats(userId);
  const statsById = new Map(stats.map((row) => [row.groupId, row]));

  const scored = groups.map((group) => {
    const row = statsById.get(group.id);
    return {
      group,
      // Grupo nunca testado recebe a media geral: entra no meio da fila.
      score: row ? row.score : globalCtr,
      dead: !!row?.dead,
    };
  });

  const alive = scored.filter((item) => !item.dead);
  const skipped = scored.filter((item) => item.dead).map((item) => item.group);
  const pool = alive.length > 0 ? alive : scored;

  pool.sort((a, b) => b.score - a.score);

  return {
    groups: pool.map((item) => item.group),
    skipped: alive.length > 0 ? skipped : [],
  };
}

// ===== SAUDE DO NUMERO =====
async function getHealth(userId, { sessionStatus = null, sharedNumber = false } = {}) {
  const dayAgo = daysAgo(1);
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [sent24h, failed24h, sentLastHour] = await Promise.all([
    prisma.sendLog.count({ where: { ad: { userId }, status: 'sent', sentAt: { gte: dayAgo } } }),
    prisma.sendLog.count({ where: { ad: { userId }, status: 'failed', sentAt: { gte: dayAgo } } }),
    prisma.sendLog.count({ where: { ad: { userId }, status: 'sent', sentAt: { gte: hourAgo } } }),
  ]);

  const attempts = sent24h + failed24h;
  const failureRate = attempts >= 5 ? failed24h / attempts : 0;

  let score = 100;
  const alerts = [];

  if (sentLastHour > 30) {
    score -= 30;
    alerts.push(`Ritmo alto: ${sentLastHour} envios na última hora. Use intervalos maiores entre os grupos.`);
  } else if (sentLastHour > 15) {
    score -= 10;
    alerts.push(`${sentLastHour} envios na última hora. Fique abaixo de 15 por hora para ficar seguro.`);
  }

  if (sent24h > 400) {
    score -= 25;
    alerts.push(`${sent24h} envios nas últimas 24h. Acima de 400 por dia o risco de bloqueio sobe bastante.`);
  } else if (sent24h > 200) {
    score -= 10;
    alerts.push(`${sent24h} envios nas últimas 24h. Considere reduzir se o número for novo.`);
  }

  if (failureRate > 0.3) {
    score -= 35;
    alerts.push(`${Math.round(failureRate * 100)}% dos envios falharam nas últimas 24h. Pode ser restrição do WhatsApp: pause e verifique o número.`);
  } else if (failureRate > 0.1) {
    score -= 15;
    alerts.push(`${Math.round(failureRate * 100)}% dos envios falharam nas últimas 24h.`);
  }

  if (sessionStatus && sessionStatus !== 'connected') {
    alerts.push('WhatsApp desconectado no momento. Os envios ficam parados até reconectar.');
  }

  score = Math.max(0, Math.min(100, score));
  const level = score >= 75 ? 'baixo' : score >= 50 ? 'medio' : 'alto';

  const tips = [];
  if (level !== 'baixo') {
    tips.push('Aumente o intervalo entre grupos para 20 minutos ou mais.');
    tips.push('Ative as variações do anúncio (teste A/B) para o texto não se repetir.');
  }
  tips.push('Ative o modo inteligente para parar de enviar a grupos que não dão retorno.');

  return {
    score,
    level,
    sent24h,
    failed24h,
    sentLastHour,
    failureRate,
    sessionStatus,
    sharedNumber,
    alerts,
    tips,
  };
}

// Disjuntor: se as ultimas N tentativas falharam, provavelmente o numero
// caiu ou foi restringido. Os loops de envio param para nao insistir.
async function hasConsecutiveFailures(userId, count = 5) {
  const recent = await prisma.sendLog.findMany({
    where: { ad: { userId }, status: { in: ['sent', 'failed'] } },
    orderBy: { sentAt: 'desc' },
    take: count,
    select: { status: true },
  });
  return recent.length >= count && recent.every((row) => row.status === 'failed');
}

module.exports = {
  TIMEZONE,
  RANKING_WINDOW_DAYS,
  DEAD_GROUP_MIN_SENDS,
  VARIANT_MIN_SENDS,
  generateTrackingCode,
  getAdBody,
  getAdVariants,
  normalizeVariants,
  pickVariant,
  getVariantReport,
  getGroupStats,
  getHourStats,
  prioritizeGroups,
  getHealth,
  hasConsecutiveFailures,
};
