const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const whatsappService = require('../services/whatsappService');
const { processQueue, hasActiveManualQueue, startManualQueue, finishManualQueue, postAdStatus, startSchedule, stopSchedule, getScheduleStatus, activateDailySchedule, deactivateDailySchedule, getDailyScheduleStatus, getDailyLimit } = require('../workers/sendWorker');

function isRrError(e) {
  if (e?.name === 'r' && e?.message === 'r') return true;
  if (typeof e === 'string' && /^r:\s*r$/i.test(e.trim())) return true;
  return /^r:\s*r$/i.test((e?.message || '').trim());
}

function getWhatsAppAvailabilityErrorMessage(error) {
  if (isRrError(error)) {
    return 'WhatsApp não está respondendo. Reconecte na aba WhatsApp.';
  }

  if (!error?.message) {
    return null;
  }

  if (error.message === 'WhatsApp não está conectado') {
    return error.message;
  }

  if (error.message === 'WhatsApp exige nova autenticação por QR Code') {
    return error.message;
  }

  return null;
}

function resolveSelectedGroups(allGroups, sendToAll, groupIds) {
  if (sendToAll !== false) {
    return allGroups;
  }

  if (!Array.isArray(groupIds) || groupIds.length === 0) {
    return { error: 'Selecione pelo menos um grupo.' };
  }

  const selectedIds = new Set(
    groupIds
      .filter(id => typeof id === 'string')
      .map(id => id.trim())
      .filter(Boolean)
  );

  if (selectedIds.size === 0) {
    return { error: 'Seleção de grupos inválida.' };
  }

  const groups = allGroups.filter(group => selectedIds.has(group.id));

  if (groups.length === 0) {
    return { error: 'Os grupos selecionados não foram encontrados na sua sessão atual.' };
  }

  if (groups.length !== selectedIds.size) {
    return { error: 'Alguns grupos selecionados não estão disponíveis na sua sessão atual. Atualize a lista e tente novamente.' };
  }

  return groups;
}

// Disparar mensagens para grupos
router.post('/', async (req, res) => {
  try {
    const { adId, groupIds, sendToAll, postStatus } = req.body;

    if (!adId) {
      return res.status(400).json({ error: 'adId é obrigatório' });
    }

    // Buscar anúncio
    const ad = await prisma.ad.findUnique({ where: { id: adId } });
    if (!ad) {
      return res.status(404).json({ error: 'Anúncio não encontrado' });
    }

    try {
      await whatsappService.ensureConnected(req.userId, undefined, 'disparo manual');
    } catch (error) {
      return res.status(400).json({ error: error.message || 'WhatsApp não está conectado' });
    }

    const allGroups = await whatsappService.getGroups(req.userId);

    // Obter grupos respeitando explicitamente o modo escolhido no frontend.
    const resolvedGroups = resolveSelectedGroups(allGroups, sendToAll, groupIds);
    if (resolvedGroups?.error) {
      return res.status(400).json({ error: resolvedGroups.error });
    }

    const groups = resolvedGroups;

    if (groups.length === 0) {
      return res.status(400).json({ error: 'Nenhum grupo encontrado' });
    }

    const dailyLimit = await getDailyLimit(req.userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sendsToday = await prisma.sendLog.count({
      where: {
        ad: { userId: req.userId },
        status: 'sent',
        sentAt: { gte: today },
      },
    });

    if (Number.isFinite(dailyLimit) && sendsToday >= dailyLimit) {
      return res.status(403).json({
        error: `Limite diário do plano grátis atingido (${dailyLimit} envios). Aguarde até amanhã ou assine um plano pago.`,
      });
    }

    const remaining = Number.isFinite(dailyLimit)
      ? Math.max(0, dailyLimit - sendsToday)
      : groups.length;
    const groupsToProcess = Number.isFinite(dailyLimit)
      ? groups.slice(0, remaining)
      : groups;

    if (groupsToProcess.length === 0) {
      return res.status(403).json({ error: 'Nenhum envio disponível para hoje no seu plano atual.' });
    }

    if (hasActiveManualQueue(req.userId)) {
      return res.status(409).json({ error: 'Já existe um disparo manual em andamento para esta conta. Aguarde finalizar antes de iniciar outro.' });
    }

    startManualQueue(req.userId, {
      adId,
      totalGroups: groupsToProcess.length,
    });

    // Processar envio em background (sem bloquear a resposta)
    processQueue(ad, groupsToProcess, req.userId)
      .catch(err => {
        console.error('Erro no processamento da fila:', err);
      })
      .finally(() => {
        finishManualQueue(req.userId);
      });

    // Publicar no Status do WhatsApp (opcional), sem bloquear o disparo dos grupos
    if (postStatus) {
      postAdStatus(req.userId, ad)
        .then(() => console.log(`📢 [${req.userId}] Anúncio publicado no status`))
        .catch(err => console.error('Erro ao publicar no status:', err.message));
    }

    res.json({
      message: `${groupsToProcess.length} envios iniciados${postStatus ? ' + status' : ''}`,
      totalGroups: groupsToProcess.length,
      postStatus: !!postStatus,
      dailyLimit: Number.isFinite(dailyLimit) ? dailyLimit : null,
      remainingAfterQueue: Number.isFinite(dailyLimit)
        ? Math.max(0, remaining - groupsToProcess.length)
        : null,
    });
  } catch (error) {
    const whatsappErrorMessage = getWhatsAppAvailabilityErrorMessage(error);
    if (whatsappErrorMessage) {
      return res.status(400).json({ error: whatsappErrorMessage });
    }

    console.error('Erro ao disparar mensagens:', error);
    res.status(500).json({ error: 'Erro ao disparar mensagens' });
  }
});

// Agendar disparo automático
router.post('/agendar', async (req, res) => {
  try {
    const { adId, intervalMinutes, groupIds, sendToAll } = req.body;

    if (!adId) {
      return res.status(400).json({ error: 'adId é obrigatório' });
    }

    const interval = parseInt(intervalMinutes) || 3;

    if (interval < 3) {
      return res.status(400).json({ error: 'Intervalo mínimo é 3 minutos' });
    }

    const ad = await prisma.ad.findUnique({ where: { id: adId } });
    if (!ad) {
      return res.status(404).json({ error: 'Anúncio não encontrado' });
    }

    try {
      await whatsappService.ensureConnected(req.userId, undefined, 'agendamento automático');
    } catch (error) {
      return res.status(400).json({ error: error.message || 'WhatsApp não está conectado' });
    }

    const allGroups = await whatsappService.getGroups(req.userId);
    const resolvedGroups = resolveSelectedGroups(allGroups, sendToAll, groupIds);
    if (resolvedGroups?.error) {
      return res.status(400).json({ error: resolvedGroups.error });
    }

    const intervalMs = interval * 60 * 1000;
    const scheduleResult = await startSchedule(adId, intervalMs, req.userId, {
      sendToAll: sendToAll !== false,
      groupIds: sendToAll === false ? groupIds : [],
    });

    if (!scheduleResult?.active) {
      return res.status(400).json({ error: scheduleResult?.error || 'Não foi possível ativar o agendamento.' });
    }

    res.json({
      message: `Disparo agendado a cada ${interval} minutos`,
      intervalMinutes: scheduleResult.intervalMinutes || interval,
      totalGroups: resolvedGroups.length,
    });
  } catch (error) {
    const whatsappErrorMessage = getWhatsAppAvailabilityErrorMessage(error);
    if (whatsappErrorMessage) {
      return res.status(400).json({ error: whatsappErrorMessage });
    }

    console.error('Erro ao agendar:', error);
    res.status(500).json({ error: 'Erro ao agendar disparo' });
  }
});

// Parar agendamento (por usuário)
router.post('/parar', (req, res) => {
  stopSchedule(req.userId);
  res.json({ message: 'Agendamento parado' });
});

// Status do agendamento (por usuário)
router.get('/agendamento', (req, res) => {
  const status = getScheduleStatus(req.userId);
  res.json(status);
});

// Limite diário
router.get('/limite-diario', async (req, res) => {
  try {
    const dailyLimit = await getDailyLimit(req.userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sendsToday = await prisma.sendLog.count({
      where: {
        ad: { userId: req.userId },
        status: 'sent',
        sentAt: { gte: today },
      },
    });
    res.json({
      limit: Number.isFinite(dailyLimit) ? dailyLimit : null,
      used: sendsToday,
      remaining: Number.isFinite(dailyLimit) ? Math.max(0, dailyLimit - sendsToday) : null,
      isUnlimited: !Number.isFinite(dailyLimit),
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar limite' });
  }
});

// ===== AGENDAMENTO DIÁRIO =====

// Ativar agendamento diário
router.post('/diario/ativar', async (req, res) => {
  try {
    const { adId, startHour, intervalMinutes, scheduleMode } = req.body;

    if (!adId) {
      return res.status(400).json({ error: 'adId é obrigatório' });
    }

    const mode = scheduleMode === 'triple' ? 'triple' : 'single';

    const hour = parseInt(startHour) || 8;
    if (mode === 'single' && (isNaN(hour) || hour < 0 || hour > 23)) {
      return res.status(400).json({ error: 'startHour deve ser entre 0 e 23' });
    }

    const interval = parseInt(intervalMinutes) || 3;
    if (interval < 3) {
      return res.status(400).json({ error: 'Intervalo mínimo é 3 minutos' });
    }

    const ad = await prisma.ad.findUnique({ where: { id: adId } });
    if (!ad) {
      return res.status(404).json({ error: 'Anúncio não encontrado' });
    }

    await activateDailySchedule(req.userId, adId, hour, interval, mode);

    const message = mode === 'triple'
      ? `Disparo diário ativado! 3x ao dia: 8h, 12h e 19h, intervalo de ${interval} minutos entre grupos.`
      : `Disparo diário ativado! Todos os dias às ${hour}h com intervalo de ${interval} minutos.`;

    res.json({
      message,
      scheduleMode: mode,
      startHour: hour,
      intervalMinutes: interval,
    });
  } catch (error) {
    console.error('Erro ao ativar agendamento diário:', error);
    res.status(500).json({ error: 'Erro ao ativar agendamento diário' });
  }
});

// Desativar agendamento diário
router.post('/diario/desativar', async (req, res) => {
  try {
    await deactivateDailySchedule(req.userId);
    res.json({ message: 'Agendamento diário desativado' });
  } catch (error) {
    console.error('Erro ao desativar agendamento diário:', error);
    res.status(500).json({ error: 'Erro ao desativar agendamento diário' });
  }
});

// Status do agendamento diário
router.get('/diario/status', async (req, res) => {
  try {
    const status = await getDailyScheduleStatus(req.userId);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar status do agendamento diário' });
  }
});

module.exports = router;
