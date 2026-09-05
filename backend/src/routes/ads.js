const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { v4: uuidv4 } = require('uuid');
const { resolveTargetUrl } = require('../lib/targetUrl');

// Criar ou atualizar anúncio
router.post('/', async (req, res) => {
  try {
    const { text, textActive, caption, imageUrl, captionActive, targetUrl } = req.body;
    const userId = req.userId;
    const resolvedTargetUrl = resolveTargetUrl({ targetUrl, text, caption });

    // Gerar tracking ID para rastreamento de cliques
    const trackingId = uuidv4().slice(0, 8);

    const ad = await prisma.ad.create({
      data: {
        userId,
        text: text || null,
        textActive: textActive || false,
        caption: caption || null,
        imageUrl: imageUrl || null,
        captionActive: captionActive || false,
        trackingId,
        targetUrl: resolvedTargetUrl,
      },
    });

    res.status(201).json(ad);
  } catch (error) {
    console.error('Erro ao criar anúncio:', error);
    res.status(500).json({ error: 'Erro ao criar anúncio' });
  }
});

// Listar anúncios de um usuário
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;
    const where = { userId };

    const ads = await prisma.ad.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { sendLogs: true, clicks: true },
        },
      },
    });

    res.json(ads);
  } catch (error) {
    console.error('Erro ao listar anúncios:', error);
    res.status(500).json({ error: 'Erro ao listar anúncios' });
  }
});

// Buscar anúncio por ID
router.get('/:id', async (req, res) => {
  try {
    const ad = await prisma.ad.findUnique({
      where: { id: req.params.id },
      include: {
        sendLogs: { orderBy: { sentAt: 'desc' }, take: 50 },
        clicks: { orderBy: { clickedAt: 'desc' }, take: 50 },
      },
    });

    if (!ad) {
      return res.status(404).json({ error: 'Anúncio não encontrado' });
    }

    res.json(ad);
  } catch (error) {
    console.error('Erro ao buscar anúncio:', error);
    res.status(500).json({ error: 'Erro ao buscar anúncio' });
  }
});

// Atualizar anúncio
router.put('/:id', async (req, res) => {
  try {
    const { text, textActive, caption, imageUrl, captionActive, targetUrl } = req.body;
    const resolvedTargetUrl = resolveTargetUrl({ targetUrl, text, caption });

    const ad = await prisma.ad.update({
      where: { id: req.params.id },
      data: {
        text,
        textActive,
        caption,
        imageUrl,
        captionActive,
        targetUrl: resolvedTargetUrl,
      },
    });

    res.json(ad);
  } catch (error) {
    console.error('Erro ao atualizar anúncio:', error);
    res.status(500).json({ error: 'Erro ao atualizar anúncio' });
  }
});

// Deletar anúncio
router.delete('/:id', async (req, res) => {
  try {
    await prisma.ad.delete({ where: { id: req.params.id } });
    res.json({ message: 'Anúncio deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar anúncio:', error);
    res.status(500).json({ error: 'Erro ao deletar anúncio' });
  }
});

module.exports = router;
