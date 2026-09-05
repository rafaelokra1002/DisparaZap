const prisma = require('../lib/prisma');
const whatsappService = require('../services/whatsappService');
const { getUserAccessState } = require('../lib/access');

// Função de delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const SEND_INTERVAL_MS = 3 * 60 * 1000;

function uniqueGroupsById(groups) {
  const uniqueGroups = [];
  const seenGroupIds = new Set();

  for (const group of groups || []) {
    if (!group?.id || seenGroupIds.has(group.id)) {
      continue;
    }

    seenGroupIds.add(group.id);
    uniqueGroups.push(group);
  }

  return uniqueGroups;
}

// ===== SISTEMA ANTI-BAN =====

// Caracteres invisíveis para variar o hash da mensagem
const invisibleChars = [
  '\u200B', // zero-width space
  '\u200C', // zero-width non-joiner
  '\u200D', // zero-width joiner
  '\uFEFF', // zero-width no-break space
  '\u2060', // word joiner
];

// Emojis de separação para variar visualmente
const separatorEmojis = ['✨', '⭐', '🔥', '💫', '⚡', '🌟', '💥', '🎯', '🚀', '💎', '🏆', '👑', '🎉', '🔔', '📌'];

// Variação de texto para cada envio parecer único
function variarTexto(texto) {
  let variado = texto;
  
  // 1. Inserir 2-4 caracteres invisíveis em posições aleatórias
  const numInvisible = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < numInvisible; i++) {
    const pos = Math.floor(Math.random() * variado.length);
    const char = invisibleChars[Math.floor(Math.random() * invisibleChars.length)];
    variado = variado.slice(0, pos) + char + variado.slice(pos);
  }

  // 2. Adicionar variação de espaços no final (1-3 espaços extras)
  const extraSpaces = ' '.repeat(1 + Math.floor(Math.random() * 3));
  variado += extraSpaces;

  // 3. Às vezes adicionar um emoji separador no final
  if (Math.random() > 0.5) {
    const emoji = separatorEmojis[Math.floor(Math.random() * separatorEmojis.length)];
    variado += '\n' + emoji;
  }

  return variado;
}

const FREE_DAILY_LIMIT = 150;
const DAILY_LIMIT = Infinity;
const USER_ACCESS_SELECT = { email: true, plan: true, planExpiresAt: true, createdAt: true };

function getBlockedAccessReason(accessState) {
  if (accessState.isExpiredPaidPlan) {
    return 'plano vencido aguardando novo pagamento';
  }

  if (accessState.trialExpired) {
    return 'acesso de teste expirado';
  }

  if (accessState.requiresPlan) {
    return 'conta sem plano ativo';
  }

  return 'acesso indisponível';
}

async function getUserSendingAccess(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: USER_ACCESS_SELECT,
  });

  if (!user) {
    return {
      user: null,
      accessState: null,
      hasAccess: false,
      reason: 'usuário não encontrado',
    };
  }

  const accessState = getUserAccessState(user);
  return {
    user,
    accessState,
    hasAccess: accessState.hasSystemAccess,
    reason: accessState.hasSystemAccess ? null : getBlockedAccessReason(accessState),
  };
}

async function ensureUserCanSend(userId, context, options = {}) {
  const access = await getUserSendingAccess(userId);

  if (access.hasAccess) {
    return access;
  }

  console.log(`🚫 [${userId}] ${context} bloqueado: ${access.reason}.`);

  if (options.stopIntervalSchedule) {
    stopSchedule(userId);
  }

  return access;
}

async function getDailyLimit(userId) {
  const access = await getUserSendingAccess(userId);

  if (!access.user || !access.accessState) {
    return 0;
  }

  const { accessState } = access;

  if (accessState.isAdmin) {
    return DAILY_LIMIT;
  }

  if (accessState.hasActivePaidPlan) {
    return DAILY_LIMIT;
  }

  if (accessState.hasSystemAccess) {
    return FREE_DAILY_LIMIT;
  }

  return 0;
}

async function getSendsToday(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const count = await prisma.sendLog.count({
    where: {
      ad: { userId },
      status: 'sent',
      sentAt: { gte: today },
    },
  });
  return count;
}

// Processar envio de mensagens em background
async function processQueue(ad, groups, userId) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3002';
  const initialAccess = await ensureUserCanSend(userId, 'Disparo manual');
  if (!initialAccess.hasAccess) {
    return { success: false, blocked: true };
  }

  const dailyLimit = await getDailyLimit(userId);

  const groupsToSend = uniqueGroupsById(groups);

  for (let i = 0; i < groupsToSend.length; i++) {
    const access = await ensureUserCanSend(userId, 'Disparo manual');
    if (!access.hasAccess) {
      break;
    }

    const sendsToday = await getSendsToday(userId);
    if (sendsToday >= dailyLimit) {
      console.log(`🚫 [${userId}] Limite diário atingido (${sendsToday}/${dailyLimit}). Parando fila.`);
      break;
    }

    const group = groupsToSend[i];
    const groupId = group.id;
    const groupName = group.name;

    console.log(`📤 [${userId}] [${i + 1}/${groupsToSend.length}] Enviando para: ${groupName}`);

    try {
      let type = 'text';

      if (ad.captionActive && ad.imageUrl && ad.caption) {
        let fullCaption = variarTexto(ad.caption);
        if (ad.trackingId) {
          fullCaption += `\n\n🔗 ${backendUrl}/r/${ad.trackingId}`;
        }
        await whatsappService.sendImage(userId, groupId, ad.imageUrl, fullCaption);
        type = 'image';
      } else if (ad.textActive && ad.text) {
        let fullText = variarTexto(ad.text);
        if (ad.trackingId) {
          fullText += `\n\n🔗 ${backendUrl}/r/${ad.trackingId}`;
        }
        await whatsappService.sendText(userId, groupId, fullText);
        type = 'text';
      }

      await prisma.sendLog.create({
        data: {
          adId: ad.id,
          groupId,
          groupName,
          type,
          status: 'sent',
        },
      });

      console.log(`✅ Enviado para: ${groupName}`);
    } catch (error) {
      console.error(`❌ Erro ao enviar para ${groupName}:`, error.message);

      await prisma.sendLog.create({
        data: {
          adId: ad.id,
          groupId,
          groupName,
          type: ad.textActive ? 'text' : 'image',
          status: 'failed',
        },
      });
    }

    // Delay fixo de 3 minutos entre cada grupo
    if (i < groupsToSend.length - 1) {
      console.log('⏳ Aguardando 3 minutos antes do próximo envio...');
      await delay(SEND_INTERVAL_MS);
    }
  }

  console.log(`🏁 Disparo concluído! ${groupsToSend.length} grupos processados.`);
  return { success: true, sent: groupsToSend.length };
}

// ===== SISTEMA DE AGENDAMENTO POR USUÁRIO =====
const scheduledTimers = new Map();
const activeManualQueues = new Map();

function hasActiveManualQueue(userId) {
  return activeManualQueues.has(userId);
}

function startManualQueue(userId, metadata) {
  activeManualQueues.set(userId, {
    startedAt: new Date(),
    ...metadata,
  });
}

function finishManualQueue(userId) {
  activeManualQueues.delete(userId);
}

async function refillScheduledGroups(entry, userId, reason = 'novo ciclo') {
  await whatsappService.ensureConnected(userId, undefined, `recarregar grupos para ${reason}`);

  const allGroups = uniqueGroupsById(await whatsappService.getGroups(userId));
  const selectedIds = new Set((entry.config.groupIds || []).filter(Boolean));
  const groups = entry.config.sendToAll
    ? allGroups
    : allGroups.filter(group => selectedIds.has(group.id));

  if (groups.length === 0) {
    entry.pendingGroups = [];
    entry.totalGroups = 0;
    return false;
  }

  entry.pendingGroups = [...groups];
  entry.totalGroups = groups.length;
  entry.cycle = (entry.cycle || 0) + 1;

  console.log(`🔁 [${userId}] Iniciando ciclo ${entry.cycle} com ${groups.length} grupos.`);
  return true;
}

async function startSchedule(adId, intervalMs, userId, options = {}) {
  const access = await ensureUserCanSend(userId, 'Agendamento automático');
  if (!access.hasAccess) {
    return { active: false, error: 'Sua conta precisa de um plano ativo para enviar novamente.' };
  }

  stopSchedule(userId);

  const config = {
    adId,
    intervalMs,
    sendToAll: options.sendToAll !== false,
    groupIds: Array.isArray(options.groupIds) ? [...new Set(options.groupIds.filter(Boolean))] : [],
  };
  console.log(`⏰ [${userId}] Agendamento ativado: 1 grupo a cada ${intervalMs / 60000} minutos`);

  const entry = {
    timer: null,
    config,
    pendingGroups: [],
    totalGroups: 0,
    cycle: 0,
    running: false,
    nextRunAt: null,
  };
  scheduledTimers.set(userId, entry);

  try {
    const hasGroups = await refillScheduledGroups(entry, userId, 'início de agendamento');
    if (!hasGroups) {
      console.log(`⏰ [${userId}] Nenhum grupo encontrado`);
      stopSchedule(userId);
      return { active: false, error: 'Nenhum grupo encontrado para agendar.' };
    }
  } catch (error) {
    console.log(`⏰ [${userId}] WhatsApp indisponível para agendar: ${error.message}`);
    stopSchedule(userId);
    return { active: false, error: error.message || 'WhatsApp indisponível para agendar.' };
  }

  void (async () => {
    await sendNextGroup(adId, userId);

    if (scheduledTimers.has(userId)) {
      scheduleNextRun(userId);
    }
  })();

  return { active: scheduledTimers.has(userId), intervalMinutes: Math.max(1, Math.round(intervalMs / 60000)) };
}

function scheduleNextRun(userId) {
  const entry = scheduledTimers.get(userId);
  if (!entry) {
    return;
  }

  if (entry.timer) {
    clearTimeout(entry.timer);
  }

  entry.nextRunAt = new Date(Date.now() + entry.config.intervalMs);
  entry.timer = setTimeout(async () => {
    const currentEntry = scheduledTimers.get(userId);
    if (!currentEntry) {
      return;
    }

    await sendNextGroup(currentEntry.config.adId, userId);

    if (scheduledTimers.has(userId)) {
      scheduleNextRun(userId);
    }
  }, entry.config.intervalMs);
}

async function sendNextGroup(adId, userId) {
  const entry = scheduledTimers.get(userId);
  if (!entry) {
    return;
  }

  if (entry.running) {
    return;
  }

  entry.running = true;
  entry.nextRunAt = null;

  try {
    const access = await ensureUserCanSend(userId, 'Agendamento automático', { stopIntervalSchedule: true });
    if (!access.hasAccess) {
      return;
    }

    if (entry.pendingGroups.length === 0) {
      try {
        const hasGroups = await refillScheduledGroups(entry, userId);
        if (!hasGroups) {
          console.log(`🏁 [${userId}] Nenhum grupo disponível para continuar o agendamento.`);
          stopSchedule(userId);
          return;
        }
      } catch (error) {
        console.log(`⏰ [${userId}] Não foi possível iniciar um novo ciclo: ${error.message}`);
        return;
      }
    }

    // Verificar limite diário
    const dailyLimit = await getDailyLimit(userId);
    const sendsToday = await getSendsToday(userId);
    if (sendsToday >= dailyLimit) {
      console.log(`🚫 [${userId}] Limite diário atingido (${sendsToday}/${dailyLimit}). Agendamento pausado até amanhã.`);
      stopSchedule(userId);
      return;
    }

    const ad = await prisma.ad.findUnique({ where: { id: adId } });
    if (!ad) {
      console.error(`⏰ [${userId}] Anúncio não encontrado, parando`);
      stopSchedule(userId);
      return;
    }

    try {
      await whatsappService.ensureConnected(userId, undefined, 'envio agendado');
    } catch (error) {
      console.log(`⏰ [${userId}] WhatsApp indisponível, pulando este ciclo: ${error.message}`);
      return;
    }

    // Delay aleatório antes de enviar (30s - 2min) para parecer humano
    const jitter = Math.floor(Math.random() * 90000) + 30000;
    console.log(`⏰ [${userId}] Aguardando ${(jitter / 1000).toFixed(0)}s de variação antes de enviar...`);
    await delay(jitter);

    const postJitterAccess = await ensureUserCanSend(userId, 'Agendamento automático', { stopIntervalSchedule: true });
    if (!postJitterAccess.hasAccess) {
      return;
    }

    const group = entry.pendingGroups.shift();
    const remaining = entry.pendingGroups.length;
    const sent = entry.totalGroups - remaining - 1;

    console.log(`⏰ [${userId}] Enviando para: ${group.name} (${sent + 1}/${entry.totalGroups}) no ciclo ${entry.cycle}`);

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3002';
    let type = 'text';

    if (ad.captionActive && ad.imageUrl && ad.caption) {
      let fullCaption = variarTexto(ad.caption);
      if (ad.trackingId) {
        fullCaption += `\n\n🔗 ${backendUrl}/r/${ad.trackingId}`;
      }
      await whatsappService.sendImage(userId, group.id, ad.imageUrl, fullCaption);
      type = 'image';
    } else if (ad.textActive && ad.text) {
      let fullText = variarTexto(ad.text);
      if (ad.trackingId) {
        fullText += `\n\n🔗 ${backendUrl}/r/${ad.trackingId}`;
      }
      await whatsappService.sendText(userId, group.id, fullText);
      type = 'text';
    }

    await prisma.sendLog.create({
      data: {
        adId: ad.id,
        groupId: group.id,
        groupName: group.name,
        type,
        status: 'sent',
      },
    });

    console.log(`✅ [${userId}] Enviado para ${group.name} — restam ${remaining} grupos`);

    if (remaining === 0) {
      console.log(`🔁 [${userId}] Ciclo ${entry.cycle} concluído. O agendamento continuará pelo primeiro grupo no próximo intervalo.`);
    }
  } catch (error) {
    console.error(`❌ [${userId}] Erro no envio agendado:`, error.message);
  } finally {
    const currentEntry = scheduledTimers.get(userId);
    if (currentEntry) {
      currentEntry.running = false;
    }
  }
}

function stopSchedule(userId) {
  const entry = scheduledTimers.get(userId);
  if (entry) {
    clearTimeout(entry.timer);
    scheduledTimers.delete(userId);
    console.log(`⏰ [${userId}] Agendamento parado`);
  }
}

function getScheduleStatus(userId) {
  const entry = scheduledTimers.get(userId);
  if (!entry) {
    return { active: false, config: null };
  }

  const intervalMinutes = Math.max(1, Math.round((entry.config?.intervalMs || 0) / 60000));

  return {
    active: true,
    config: entry.config,
    intervalMinutes,
    remaining: entry.pendingGroups.length,
    total: entry.totalGroups,
    cycle: entry.cycle || 1,
    nextRunAt: entry.nextRunAt,
  };
}

// ===== SISTEMA DE AGENDAMENTO DIÁRIO (PERSISTIDO NO BANCO) =====
const dailyTimers = new Map(); // userId -> intervalId

const TRIPLE_HOURS = [8, 12, 19];

async function activateDailySchedule(userId, adId, startHour, intervalMinutes, scheduleMode = 'single') {
  // Parar agendamento diário anterior se existir
  await deactivateDailySchedule(userId);

  // Salvar no banco
  const existing = await prisma.dailySchedule.findFirst({ where: { userId, active: true } });
  if (existing) {
    await prisma.dailySchedule.update({
      where: { id: existing.id },
      data: { adId, startHour, intervalMinutes, scheduleMode, active: true },
    });
  } else {
    await prisma.dailySchedule.create({
      data: { userId, adId, startHour, intervalMinutes, scheduleMode, active: true },
    });
  }

  // Iniciar o timer
  startDailyTimer(userId, adId, startHour, intervalMinutes, scheduleMode);

  if (scheduleMode === 'triple') {
    console.log(`📅 [${userId}] Agendamento diário ativado: 3x ao dia (8h, 12h, 19h), intervalo de ${intervalMinutes}min`);
  } else {
    console.log(`📅 [${userId}] Agendamento diário ativado: todos os dias às ${startHour}h, intervalo de ${intervalMinutes}min`);
  }
  return { success: true };
}

function startDailyTimer(userId, adId, startHour, intervalMinutes, scheduleMode = 'single') {
  // Verificar a cada minuto se é hora de começar o disparo do dia
  const checkInterval = setInterval(async () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    let shouldFire = false;
    if (scheduleMode === 'triple') {
      shouldFire = TRIPLE_HOURS.includes(currentHour) && currentMinute === 0;
    } else {
      shouldFire = currentHour === startHour && currentMinute === 0;
    }

    if (shouldFire) {
      console.log(`📅 [${userId}] Hora de disparar! Iniciando disparo das ${currentHour}h (modo: ${scheduleMode})...`);
      await runDailyDispatch(userId, adId, intervalMinutes, scheduleMode);
    }
  }, 60000); // Verifica a cada 1 minuto

  dailyTimers.set(userId, checkInterval);

  // Se agora já passou do horário mas estamos dentro dos primeiros 5 minutos, iniciar
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const inWindow = currentMinute <= 5;
  const shouldFireNow = scheduleMode === 'triple'
    ? TRIPLE_HOURS.includes(currentHour) && inWindow
    : currentHour === startHour && inWindow;

  if (shouldFireNow) {
    console.log(`📅 [${userId}] Iniciando disparo agora (dentro da janela das ${currentHour}h)...`);
    runDailyDispatch(userId, adId, intervalMinutes, scheduleMode);
  }
}

async function runDailyDispatch(userId, adId, intervalMinutes, scheduleMode = 'single') {
  try {
    const access = await ensureUserCanSend(userId, 'Disparo diário');
    if (!access.hasAccess) {
      return;
    }

    const dailyLimit = await getDailyLimit(userId);

    // Verificar se já atingiu limite hoje
    const sendsToday = await getSendsToday(userId);
    if (sendsToday >= dailyLimit) {
      console.log(`📅 [${userId}] Limite diário já atingido (${sendsToday}/${dailyLimit}). Pulando hoje.`);
      return;
    }

    const ad = await prisma.ad.findUnique({ where: { id: adId } });
    if (!ad) {
      console.log(`📅 [${userId}] Anúncio não encontrado, desativando agendamento diário.`);
      await deactivateDailySchedule(userId);
      return;
    }

    try {
      await whatsappService.ensureConnected(userId, undefined, 'disparo diário');
    } catch (error) {
      console.log(`📅 [${userId}] WhatsApp indisponível. O disparo tentará reconectar depois: ${error.message}`);
      return;
    }

    // Buscar todos os grupos
    const groups = uniqueGroupsById(await whatsappService.getGroups(userId));

    if (groups.length === 0) {
      console.log(`📅 [${userId}] Nenhum grupo encontrado.`);
      return;
    }

    // No modo triple, reenvia para todos os grupos a cada horário (8h, 12h, 19h).
    // No modo single, filtra grupos que já receberam HOJE para não duplicar.
    let pendingGroups;
    if (scheduleMode === 'triple') {
      pendingGroups = uniqueGroupsById(groups);
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sentToday = await prisma.sendLog.findMany({
        where: { adId, status: 'sent', sentAt: { gte: today } },
        select: { groupId: true },
      });
      const sentTodayIds = new Set(sentToday.map(s => s.groupId));
      pendingGroups = uniqueGroupsById(groups).filter(g => !sentTodayIds.has(g.id));

      if (pendingGroups.length === 0) {
        console.log(`📅 [${userId}] Todos os ${groups.length} grupos já receberam hoje.`);
        return;
      }
    }

    const remaining = Number.isFinite(dailyLimit) ? dailyLimit - sendsToday : pendingGroups.length;
    const groupsToSend = pendingGroups.slice(0, remaining);

    console.log(`📅 [${userId}] Iniciando disparo (modo: ${scheduleMode}): ${groupsToSend.length} grupos`);

    for (let i = 0; i < groupsToSend.length; i++) {
      const currentAccess = await ensureUserCanSend(userId, 'Disparo diário');
      if (!currentAccess.hasAccess) {
        return;
      }

      // Reverificar se agendamento ainda está ativo
      const schedule = await prisma.dailySchedule.findFirst({ where: { userId, active: true } });
      if (!schedule) {
        console.log(`📅 [${userId}] Agendamento desativado pelo usuário. Parando.`);
        return;
      }

      // Reverificar limite diário
      const currentSends = await getSendsToday(userId);
      if (currentSends >= dailyLimit) {
        console.log(`📅 [${userId}] Limite diário atingido. Continuará amanhã.`);
        return;
      }

      const group = groupsToSend[i];
      console.log(`📅 [${userId}] [${i + 1}/${groupsToSend.length}] Enviando para: ${group.name}`);

      try {
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:3002';
        let type = 'text';

        // Delay aleatório anti-ban (30s-2min)
        const jitter = Math.floor(Math.random() * 90000) + 30000;
        await delay(jitter);

        const postJitterAccess = await ensureUserCanSend(userId, 'Disparo diário');
        if (!postJitterAccess.hasAccess) {
          return;
        }

        if (ad.captionActive && ad.imageUrl && ad.caption) {
          let fullCaption = variarTexto(ad.caption);
          if (ad.trackingId) {
            fullCaption += `\n\n🔗 ${backendUrl}/r/${ad.trackingId}`;
          }
          await whatsappService.sendImage(userId, group.id, ad.imageUrl, fullCaption);
          type = 'image';
        } else if (ad.textActive && ad.text) {
          let fullText = variarTexto(ad.text);
          if (ad.trackingId) {
            fullText += `\n\n🔗 ${backendUrl}/r/${ad.trackingId}`;
          }
          await whatsappService.sendText(userId, group.id, fullText);
          type = 'text';
        }

        await prisma.sendLog.create({
          data: {
            adId: ad.id,
            groupId: group.id,
            groupName: group.name,
            type,
            status: 'sent',
          },
        });

        console.log(`✅ [${userId}] Enviado para ${group.name} — restam ${groupsToSend.length - i - 1}`);
      } catch (error) {
        console.error(`❌ [${userId}] Erro ao enviar para ${group.name}:`, error.message);
        await prisma.sendLog.create({
          data: { adId: ad.id, groupId: group.id, groupName: group.name, type: 'text', status: 'failed' },
        });
      }

      // Esperar o intervalo configurado entre envios do disparo diário.
      if (i < groupsToSend.length - 1) {
        console.log(`⏳ [${userId}] Próximo envio em ${intervalMinutes} minuto(s)...`);
        await delay(intervalMinutes * 60000);
      }
    }

    console.log(`🏁 [${userId}] Disparo diário concluído! ${groupsToSend.length} grupos processados.`);
  } catch (error) {
    console.error(`❌ [${userId}] Erro no disparo diário:`, error.message);
  }
}

async function deactivateDailySchedule(userId) {
  // Parar timer
  const timer = dailyTimers.get(userId);
  if (timer) {
    clearInterval(timer);
    dailyTimers.delete(userId);
  }

  // Desativar no banco
  await prisma.dailySchedule.updateMany({
    where: { userId, active: true },
    data: { active: false },
  });

  console.log(`📅 [${userId}] Agendamento diário desativado`);
}

async function getDailyScheduleStatus(userId) {
  const schedule = await prisma.dailySchedule.findFirst({
    where: { userId, active: true },
    include: { ad: { select: { id: true, text: true, caption: true } } },
  });

  if (!schedule) {
    return { active: false };
  }

  // Contar envios de hoje
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sentToday = await prisma.sendLog.count({
    where: { adId: schedule.adId, status: 'sent', sentAt: { gte: today } },
  });

  return {
    active: true,
    adId: schedule.adId,
    scheduleMode: schedule.scheduleMode || 'single',
    startHour: schedule.startHour,
    intervalMinutes: schedule.intervalMinutes,
    sentToday,
    isRunning: dailyTimers.has(userId),
  };
}

// Restaurar agendamentos diários do banco ao iniciar o servidor
async function restoreDailySchedules() {
  try {
    const activeSchedules = await prisma.dailySchedule.findMany({ where: { active: true } });
    
    for (const schedule of activeSchedules) {
      const mode = schedule.scheduleMode || 'single';
      const label = mode === 'triple' ? '8h, 12h, 19h' : `${schedule.startHour}h`;
      console.log(`📅 Restaurando agendamento diário para usuário ${schedule.userId} (${label})`);
      startDailyTimer(schedule.userId, schedule.adId, schedule.startHour, schedule.intervalMinutes, mode);
    }

    if (activeSchedules.length > 0) {
      console.log(`📅 ${activeSchedules.length} agendamento(s) diário(s) restaurado(s)`);
    }
  } catch (error) {
    console.error('❌ Erro ao restaurar agendamentos diários:', error.message);
  }
}

// Restaurar ao iniciar
restoreDailySchedules();

console.log('🔄 Worker de envio pronto (com proteção anti-ban e agendamento diário)');

module.exports = {
  processQueue,
  hasActiveManualQueue,
  startManualQueue,
  finishManualQueue,
  startSchedule,
  stopSchedule,
  getScheduleStatus,
  activateDailySchedule,
  deactivateDailySchedule,
  getDailyScheduleStatus,
  getDailyLimit,
  FREE_DAILY_LIMIT,
  DAILY_LIMIT,
};
