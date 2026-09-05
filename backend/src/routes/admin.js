const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const whatsappService = require('../services/whatsappService');
const { isAdminEmail } = require('../middleware/auth');
const { getUserAccessState, hasDedicatedWhatsAppAccess } = require('../lib/access');

// Estatísticas gerais do sistema
router.get('/stats', async (req, res) => {
  try {
    // Total de usuários
    const totalUsers = await prisma.user.count();

    // Usuários por plano
    const usersByPlan = await prisma.user.groupBy({
      by: ['plan'],
      _count: true,
    });

    // Usuários com plano ativo (não expirado)
    const now = new Date();
    const usersWithActivePlan = await prisma.user.count({
      where: {
        plan: { not: 'free' },
        planExpiresAt: { gt: now },
      },
    });

    // Total de anúncios
    const totalAds = await prisma.ad.count();

    // Total de envios
    const totalSends = await prisma.sendLog.count({
      where: { status: 'sent' },
    });

    // Total de cliques
    const totalClicks = await prisma.click.count();

    // Receita total (transações pagas)
    const totalRevenue = await prisma.planTransaction.aggregate({
      where: { status: 'paid' },
      _sum: { amount: true },
    });

    // Transações pendentes
    const pendingTransactions = await prisma.planTransaction.count({
      where: { status: 'pending' },
    });

    // Últimos usuários cadastrados
    const recentUsers = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        planExpiresAt: true,
        createdAt: true,
      },
    });

    // Taxa de conversão (usuários com plano / total)
    const conversionRate = totalUsers > 0 ? ((usersWithActivePlan / totalUsers) * 100).toFixed(2) : 0;

    res.json({
      summary: {
        totalUsers,
        usersWithActivePlan,
        conversionRate: `${conversionRate}%`,
      },
      usersByPlan: usersByPlan.map(p => ({
        plan: p.plan,
        count: p._count,
      })),
      activity: {
        totalAds,
        totalSends,
        totalClicks,
        averageClicksPerAd: totalAds > 0 ? (totalClicks / totalAds).toFixed(2) : 0,
      },
      revenue: {
        totalRevenue: totalRevenue._sum.amount || 0,
        pendingTransactions,
      },
      recentUsers,
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas do admin:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// Lista de todos os usuários com filtro
router.get('/users', async (req, res) => {
  try {
    const { plan, search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (plan) where.plan = plan;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          dedicatedWhatsApp: true,
          plan: true,
          planExpiresAt: true,
          createdAt: true,
          _count: {
            select: { ads: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users: users.map((user) => {
        const accessState = getUserAccessState(user);
        const isAdmin = isAdminEmail(user.email);

        return {
          ...user,
          isAdmin,
          hasAccess: accessState.hasSystemAccess,
          requiresPlan: accessState.requiresPlan,
          isTrialActive: accessState.isTrialActive,
          trialExpired: accessState.trialExpired,
          trialHoursLeft: accessState.trialHoursLeft,
          hasActivePaidPlan: accessState.hasActivePaidPlan,
          isExpiredPaidPlan: accessState.isExpiredPaidPlan,
          accessMode: accessState.accessMode,
          accessPlanLabel: accessState.planLabel,
          daysLeft: accessState.daysLeft,
          usesDedicatedWhatsApp: !isAdmin && hasDedicatedWhatsAppAccess(user),
        };
      }),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
});

router.patch('/users/:userId/dedicated-whatsapp', async (req, res) => {
  try {
    const { userId } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'O campo enabled deve ser booleano' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, dedicatedWhatsApp: true },
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (isAdminEmail(existingUser.email)) {
      return res.status(400).json({ error: 'O administrador sempre usa a sessão global' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { dedicatedWhatsApp: enabled },
      select: {
        id: true,
        name: true,
        email: true,
        dedicatedWhatsApp: true,
      },
    });

    whatsappService.clearSessionCache(userId);

    res.json({
      message: enabled
        ? 'WhatsApp individual liberado para o usuário'
        : 'WhatsApp individual removido do usuário',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Erro ao atualizar liberação de WhatsApp individual:', error);
    res.status(500).json({ error: 'Erro ao atualizar liberação de WhatsApp individual' });
  }
});

router.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, dedicatedWhatsApp: true },
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (isAdminEmail(existingUser.email)) {
      return res.status(400).json({ error: 'O administrador não pode ser excluído' });
    }

    try {
      await whatsappService.logout(userId, true);
    } catch (error) {
      console.warn(`Não foi possível limpar a sessão dedicada do usuário ${userId}:`, error.message);
    }

    await prisma.$transaction(async (transaction) => {
      const userAds = await transaction.ad.findMany({
        where: { userId },
        select: { id: true },
      });

      const adIds = userAds.map((ad) => ad.id);

      if (adIds.length > 0) {
        await transaction.sendLog.deleteMany({
          where: { adId: { in: adIds } },
        });

        await transaction.click.deleteMany({
          where: { adId: { in: adIds } },
        });

        await transaction.dailySchedule.deleteMany({
          where: { adId: { in: adIds } },
        });

        await transaction.ad.deleteMany({
          where: { id: { in: adIds } },
        });
      }

      await transaction.dailySchedule.deleteMany({
        where: { userId },
      });

      await transaction.planTransaction.deleteMany({
        where: { userId },
      });

      await transaction.user.delete({
        where: { id: userId },
      });
    });

    whatsappService.clearSessionCache(userId);

    res.json({ message: 'Usuário excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    res.status(500).json({ error: 'Erro ao excluir usuário' });
  }
});

// Detalhes de um usuário específico
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        ads: {
          include: {
            _count: {
              select: { clicks: true, sendLogs: true },
            },
          },
        },
        planTransactions: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(user);
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

module.exports = router;
