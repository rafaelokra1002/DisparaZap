// Resposta automática no privado: quando alguém chama o número que divulga
// o anúncio, responde na hora com a mensagem configurada (no máximo 1x a
// cada 24h por contato) e registra o contato para as métricas reais.
const prisma = require('../lib/prisma');
const whatsappService = require('./whatsappService');
const { ADMIN_EMAIL } = require('../lib/access');

const REPLY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_AUTO_REPLY_MESSAGE = 'Oi, {nome}! 👋 Obrigado pela mensagem. Aqui está o link da oferta: {link}\n\nJá já te respondo pessoalmente!';

let adminUserIdCache = null;

async function getAdminUserId() {
  if (adminUserIdCache) {
    return adminUserIdCache;
  }
  const admin = await prisma.user.findFirst({
    where: { email: { equals: ADMIN_EMAIL, mode: 'insensitive' } },
    select: { id: true },
  });
  adminUserIdCache = admin?.id || null;
  return adminUserIdCache;
}

// Dono do número: sessão dedicada pertence ao próprio usuário; a sessão
// global é o número do sistema, configurado pelo admin.
async function resolveSessionOwner(sessionId) {
  if (sessionId.startsWith('dedicated-')) {
    return sessionId.slice('dedicated-'.length);
  }
  if (sessionId === whatsappService.GLOBAL_SESSION_ID) {
    return getAdminUserId();
  }
  return null;
}

function getChatId(msg) {
  return whatsappService.serializeWid(msg.from)
    || whatsappService.serializeWid(msg._data?.from)
    || whatsappService.serializeWid(msg.id?.remote);
}

function isPrivateChat(chatId) {
  return !!chatId
    && !chatId.endsWith('@g.us')
    && !chatId.endsWith('@broadcast')
    && !chatId.endsWith('@newsletter')
    && chatId !== 'status@broadcast';
}

async function getLatestAdLink(userId) {
  const ad = await prisma.ad.findFirst({
    where: { userId, trackingId: { not: null } },
    orderBy: { updatedAt: 'desc' },
    select: { trackingId: true },
  });
  if (!ad) {
    return '';
  }
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3002';
  return `${backendUrl}/r/${ad.trackingId}`;
}

function renderMessage(template, { name, link }) {
  return template
    .replace(/\{nome\}/gi, name || '')
    .replace(/\{link\}/gi, link || '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/,\s*!/g, '!')
    .trim();
}

async function handleIncomingMessage({ sessionId, client, msg }) {
  if (!msg || msg.fromMe || msg.isStatus || msg.broadcast) {
    return;
  }

  const chatId = getChatId(msg);
  if (!isPrivateChat(chatId)) {
    return;
  }

  const userId = await resolveSessionOwner(sessionId);
  if (!userId) {
    return;
  }

  const contactName = (msg._data?.notifyName || msg.notifyName || '').trim().slice(0, 80) || null;
  const now = new Date();

  const where = { userId_contactId: { userId, contactId: chatId } };
  const update = {
    messageCount: { increment: 1 },
    lastMessageAt: now,
    ...(contactName ? { name: contactName } : {}),
  };
  let contact;
  try {
    contact = await prisma.privateContact.upsert({
      where,
      create: { userId, contactId: chatId, name: contactName, messageCount: 1, lastMessageAt: now },
      update,
    });
  } catch (error) {
    // Duas mensagens simultâneas de um contato novo: a outra criou o registro primeiro.
    if (error.code !== 'P2002') {
      throw error;
    }
    contact = await prisma.privateContact.update({ where, data: update });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { autoReplyEnabled: true, autoReplyMessage: true },
  });
  if (!user?.autoReplyEnabled) {
    return;
  }

  if (contact.lastReplyAt && now - contact.lastReplyAt < REPLY_COOLDOWN_MS) {
    return;
  }

  // Marca antes de responder: se chegarem várias mensagens seguidas do mesmo
  // contato, só a primeira dispara a resposta.
  const claimed = await prisma.privateContact.updateMany({
    where: {
      id: contact.id,
      OR: [{ lastReplyAt: null }, { lastReplyAt: { lt: new Date(now.getTime() - REPLY_COOLDOWN_MS) } }],
    },
    data: { lastReplyAt: now },
  });
  if (claimed.count === 0) {
    return;
  }

  const template = (user.autoReplyMessage || '').trim() || DEFAULT_AUTO_REPLY_MESSAGE;
  const link = /\{link\}/i.test(template) ? await getLatestAdLink(userId) : '';
  const text = renderMessage(template, { name: contactName ? contactName.split(' ')[0] : '', link });
  if (!text) {
    return;
  }

  // Pausa curta para parecer digitação humana.
  await new Promise((resolve) => setTimeout(resolve, 3000 + Math.floor(Math.random() * 5000)));
  await client.sendMessage(chatId, text);
  console.log(`💬 [${userId}] Resposta automática enviada para ${chatId}`);
}

function registerAutoReply() {
  whatsappService.setIncomingMessageHandler(handleIncomingMessage);
}

module.exports = {
  DEFAULT_AUTO_REPLY_MESSAGE,
  registerAutoReply,
  renderMessage,
};
