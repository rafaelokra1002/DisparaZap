const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// Obter métricas gerais
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;

    // Filtro por usuário autenticado
    const adFilter = { ad: { userId } };
    const adWhere = { userId };

    // Total de envios
    const totalSends = await prisma.sendLog.count({
      where: { ...adFilter, status: 'sent' },
    });

    // Envios hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sendsToday = await prisma.sendLog.count({
      where: {
        ...adFilter,
        status: 'sent',
        sentAt: { gte: today },
      },
    });

    // Pessoas alcançadas (estimativa: 50 pessoas por grupo em média)
    const peopleReached = totalSends * 50;

    // Total de cliques
    const totalClicks = await prisma.click.count({
      where: adFilter,
    });

    // Cliques hoje
    const clicksToday = await prisma.click.count({
      where: {
        ...adFilter,
        clickedAt: { gte: today },
      },
    });

    // Mensagens privadas (estimativa: 2% dos alcançados)
    const privateMessages = Math.floor(peopleReached * 0.02);

    // Cliques por hora (para melhor horário)
    const clicksByHour = await prisma.$queryRaw`
      SELECT EXTRACT(HOUR FROM c."clickedAt")::text as hour, COUNT(*)::int as count
      FROM "Click" c
      INNER JOIN "Ad" a ON c."adId" = a."id"
      WHERE a."userId" = ${userId}
      GROUP BY hour
      ORDER BY count DESC
      LIMIT 1
    `;

    const bestHour = clicksByHour.length > 0 ? `${clicksByHour[0].hour}:00` : 'N/A';

    // Cliques por dispositivo
    const clicksByDevice = await prisma.click.groupBy({
      by: ['device'],
      _count: true,
      where: adFilter,
    });

    // Cliques por país
    const clicksByCountry = await prisma.click.groupBy({
      by: ['country'],
      _count: true,
      where: adFilter,
    });

    // Total de grupos do usuário
    const uniqueGroups = await prisma.sendLog.findMany({
      where: { ...adFilter, status: 'sent' },
      distinct: ['groupId'],
      select: { groupId: true },
    });
    const totalGroups = uniqueGroups.length;

    // Último envio
    const lastSend = await prisma.sendLog.findFirst({
      where: { ...adFilter, status: 'sent' },
      orderBy: { sentAt: 'desc' },
      select: { groupName: true, sentAt: true },
    });

    res.json({
      overview: {
        sendsToday,
        totalSends,
        peopleReached,
        privateMessages,
        totalGroups,
        lastSend: lastSend ? { groupName: lastSend.groupName, sentAt: lastSend.sentAt } : null,
      },
      clicks: {
        totalClicks,
        clicksToday,
        bestHour,
        byDevice: clicksByDevice.map(d => ({
          device: d.device || 'Desconhecido',
          count: d._count,
        })),
        byCountry: clicksByCountry.map(c => ({
          country: c.country || 'Desconhecido',
          count: c._count,
        })),
      },
    });
  } catch (error) {
    console.error('Erro ao buscar métricas:', error);
    res.status(500).json({ error: 'Erro ao buscar métricas' });
  }
});

// Histórico de envios
router.get('/historico', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const userId = req.userId;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { ad: { userId } };

    const [logs, total] = await Promise.all([
      prisma.sendLog.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        skip,
        take: parseInt(limit),
        include: {
          ad: { select: { text: true, caption: true, imageUrl: true } },
        },
      }),
      prisma.sendLog.count({ where }),
    ]);

    res.json({
      logs,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
});

module.exports = router;
