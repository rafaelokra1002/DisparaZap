const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { getUserAccessState, hasDedicatedWhatsAppAccess } = require('../lib/access');
const { DEFAULT_AUTO_REPLY_MESSAGE } = require('../services/autoReply');
const { buildWeeklyReport, sendWeeklyReport, normalizeReportPhone } = require('../services/weeklyReport');
const { isAiConfigured } = require('../lib/ai');

const USER_SELECT = {
  id: true,
  email: true,
  phone: true,
  plan: true,
  planExpiresAt: true,
  createdAt: true,
  dedicatedWhatsApp: true,
  smartGroupsEnabled: true,
  autoReplyEnabled: true,
  autoReplyMessage: true,
  weeklyReportEnabled: true,
  lastWeeklyReportAt: true,
};

// Resposta automática só faz sentido em número próprio: no número
// compartilhado as mensagens chegam para o admin, não para o cliente.
function canUseAutoReply(user) {
  return getUserAccessState(user).isAdmin || hasDedicatedWhatsAppAccess(user);
}

function toPayload(user) {
  return {
    smartGroupsEnabled: user.smartGroupsEnabled,
    autoReplyEnabled: user.autoReplyEnabled,
    autoReplyMessage: user.autoReplyMessage || '',
    defaultAutoReplyMessage: DEFAULT_AUTO_REPLY_MESSAGE,
    canUseAutoReply: canUseAutoReply(user),
    weeklyReportEnabled: user.weeklyReportEnabled,
    lastWeeklyReportAt: user.lastWeeklyReportAt,
    phone: user.phone || '',
    phoneValid: !!normalizeReportPhone(user.phone),
    aiEnabled: isAiConfigured(),
  };
}

router.get('/', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: USER_SELECT });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    res.json(toPayload(user));
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
});

router.put('/', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: USER_SELECT });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const body = req.body || {};
    const data = {};

    if (typeof body.smartGroupsEnabled === 'boolean') {
      data.smartGroupsEnabled = body.smartGroupsEnabled;
    }
    if (typeof body.weeklyReportEnabled === 'boolean') {
      data.weeklyReportEnabled = body.weeklyReportEnabled;
    }
    if (typeof body.autoReplyEnabled === 'boolean') {
      if (body.autoReplyEnabled && !canUseAutoReply(user)) {
        return res.status(403).json({ error: 'A resposta automática precisa de um WhatsApp próprio conectado.' });
      }
      data.autoReplyEnabled = body.autoReplyEnabled;
    }
    if (typeof body.autoReplyMessage === 'string') {
      const message = body.autoReplyMessage.trim();
      if (message.length > 1000) {
        return res.status(400).json({ error: 'Mensagem automática muito longa (máximo 1000 caracteres).' });
      }
      data.autoReplyMessage = message || null;
    }
    if (typeof body.phone === 'string') {
      const digits = body.phone.replace(/\D/g, '');
      if (digits && !normalizeReportPhone(digits)) {
        return res.status(400).json({ error: 'Telefone inválido. Use DDD + número, ex.: 11999998888.' });
      }
      data.phone = digits || null;
    }

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data,
      select: USER_SELECT,
    });

    res.json(toPayload(updated));
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    res.status(500).json({ error: 'Erro ao salvar configurações' });
  }
});

router.get('/relatorio/previa', async (req, res) => {
  try {
    const report = await buildWeeklyReport(req.userId);
    res.json({ text: report.text });
  } catch (error) {
    console.error('Erro ao montar prévia do relatório:', error);
    res.status(500).json({ error: 'Erro ao montar a prévia do relatório' });
  }
});

const TEST_COOLDOWN_MS = 10 * 60 * 1000;
const lastTestByUser = new Map();

router.post('/relatorio/teste', async (req, res) => {
  try {
    const last = lastTestByUser.get(req.userId) || 0;
    if (Date.now() - last < TEST_COOLDOWN_MS) {
      return res.status(429).json({ error: 'Aguarde alguns minutos antes de enviar outro teste.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: USER_SELECT });
    if (!normalizeReportPhone(user?.phone)) {
      return res.status(400).json({ error: 'Cadastre um telefone válido para receber o relatório.' });
    }

    lastTestByUser.set(req.userId, Date.now());
    await sendWeeklyReport(user, { markSent: false });
    res.json({ message: 'Relatório enviado para o seu WhatsApp!' });
  } catch (error) {
    console.error('Erro ao enviar relatório de teste:', error.message);
    const message = error.message === 'WhatsApp do sistema desconectado'
      ? 'O WhatsApp do sistema está desconectado no momento. Tente mais tarde.'
      : error.message === 'Número sem WhatsApp'
        ? 'Esse telefone não tem WhatsApp.'
        : 'Não foi possível enviar o relatório agora.';
    res.status(400).json({ error: message });
  }
});

module.exports = router;
