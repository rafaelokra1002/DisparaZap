const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const {
  ADMIN_EMAIL,
  isAdminEmail,
  hasDedicatedWhatsAppAccess,
  hasSystemAccess,
  getUserAccessState,
} = require('../lib/access');

const JWT_SECRET = process.env.JWT_SECRET || 'disparazap-secret-key-change-in-production';

// Middleware que verifica o token JWT e injeta req.userId
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Token mal formatado' });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

async function adminMiddleware(req, res, next) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, dedicatedWhatsApp: true, plan: true, planExpiresAt: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (!isAdminEmail(user.email)) {
      return res.status(403).json({ error: 'Acesso restrito ao administrador' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Erro ao validar admin:', error);
    return res.status(500).json({ error: 'Erro ao validar administrador' });
  }
}

async function whatsappAccessMiddleware(req, res, next) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, dedicatedWhatsApp: true, plan: true, planExpiresAt: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const isAdmin = isAdminEmail(user.email);
    const usesDedicatedWhatsApp = !isAdmin && hasDedicatedWhatsAppAccess(user);
    const hasWhatsAppAccess = isAdmin || usesDedicatedWhatsApp;

    if (!hasWhatsAppAccess) {
      return res.status(403).json({ error: 'Acesso restrito à conexão autorizada do WhatsApp' });
    }

    req.user = {
      ...user,
      dedicatedWhatsApp: usesDedicatedWhatsApp,
    };
    next();
  } catch (error) {
    console.error('Erro ao validar acesso ao WhatsApp:', error);
    return res.status(500).json({ error: 'Erro ao validar acesso ao WhatsApp' });
  }
}

async function systemAccessMiddleware(req, res, next) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, plan: true, planExpiresAt: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const accessState = getUserAccessState(user);

    if (!accessState.hasSystemAccess) {
      return res.status(403).json({
        error: accessState.isExpiredPaidPlan
          ? 'Seu plano venceu. Renove o pagamento para liberar os envios novamente.'
          : accessState.trialExpired
            ? 'Seu acesso de teste de 24 horas terminou. Faça o pagamento de um plano para liberar o sistema novamente.'
            : 'Sua conta precisa de um plano ativo para liberar o sistema.',
        code: 'PLAN_REQUIRED',
        trialExpired: accessState.trialExpired,
        expiredPaidPlan: accessState.isExpiredPaidPlan,
      });
    }

    next();
  } catch (error) {
    console.error('Erro ao validar acesso ao sistema:', error);
    return res.status(500).json({ error: 'Erro ao validar acesso ao sistema' });
  }
}

module.exports = {
  authMiddleware,
  adminMiddleware,
  whatsappAccessMiddleware,
  systemAccessMiddleware,
  JWT_SECRET,
  ADMIN_EMAIL,
  isAdminEmail,
  hasDedicatedWhatsAppAccess,
  hasSystemAccess,
};
