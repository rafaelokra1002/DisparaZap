const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { JWT_SECRET, authMiddleware } = require('../middleware/auth');
const { getUserAccessState, hasDedicatedWhatsAppAccess } = require('../lib/access');

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function buildUserAccessPayload(user) {
  const now = new Date();
  const { password, dedicatedWhatsApp, ...safeUser } = user;
  const accessState = getUserAccessState(user, now);
  const isAdmin = accessState.isAdmin;
  const usesDedicatedWhatsApp = !isAdmin && hasDedicatedWhatsAppAccess(user);

  return {
    ...safeUser,
    plan: accessState.resolvedPlan,
    daysLeft: accessState.daysLeft,
    planActive: isAdmin || accessState.hasActivePaidPlan,
    hasAccess: accessState.hasSystemAccess,
    isExpiredPaidPlan: accessState.isExpiredPaidPlan,
    isTrialActive: accessState.isTrialActive,
    trialEndsAt: accessState.trialEndsAt,
    trialHoursLeft: accessState.trialHoursLeft,
    requiresPlan: accessState.requiresPlan,
    isPaid: accessState.hasActivePaidPlan,
    accessMode: accessState.accessMode,
    planLabel: accessState.planLabel,
    isAdmin,
    usesDedicatedWhatsApp,
    canManageWhatsApp: isAdmin || usesDedicatedWhatsApp,
  };
}

// Registrar novo usuário
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const normalizedPhone = normalizePhone(phone);

    if (!name || !email || !password || !normalizedPhone) {
      return res.status(400).json({ error: 'Nome, email, telefone e senha são obrigatórios' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
    }

    if (normalizedPhone.length < 10 || normalizedPhone.length > 13) {
      return res.status(400).json({ error: 'Informe um telefone válido com DDD' });
    }

    // Verificar se email já existe
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Este email já está cadastrado' });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: normalizedPhone,
        password: hashedPassword,
        plan: 'no_plan',
        dedicatedWhatsApp: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        dedicatedWhatsApp: true,
        createdAt: true,
        plan: true,
        planExpiresAt: true,
      },
    });

    // Gerar token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: buildUserAccessPayload(user),
    });
  } catch (error) {
    console.error('Erro ao registrar:', error);
    res.status(500).json({ error: 'Erro ao registrar usuário' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        password: true,
        dedicatedWhatsApp: true,
        createdAt: true,
        plan: true,
        planExpiresAt: true,
      },
    });
    if (!user) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: buildUserAccessPayload(user),
    });
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// Obter dados do usuário logado
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true, phone: true, dedicatedWhatsApp: true, createdAt: true, plan: true, planExpiresAt: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(buildUserAccessPayload(user));
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

module.exports = router;
