const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { v4: uuidv4 } = require('uuid');
const { resolveTargetUrl } = require('../lib/targetUrl');
const { normalizeVariants } = require('../lib/insights');
const {
  isAiConfigured,
  generateAdVariations,
  AiNotConfiguredError,
  AiRefusedError,
} = require('../lib/ai');

// Limite simples de uso da IA por usuário (evita custo descontrolado).
const AI_LIMIT_PER_HOUR = 20;
const aiUsage = new Map(); // userId -> timestamps

function consumeAiQuota(userId) {
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const recent = (aiUsage.get(userId) || []).filter((ts) => ts > hourAgo);
  if (recent.length >= AI_LIMIT_PER_HOUR) {
    aiUsage.set(userId, recent);
    return false;
  }
  recent.push(Date.now());
  aiUsage.set(userId, recent);
  return true;
}

function variantsFromBody(textVariants) {
  if (textVariants === undefined) {
    return undefined;
  }
  return normalizeVariants(textVariants);
}

// Criar anúncio
router.post('/', async (req, res) => {
  try {
    const { text, textActive, caption, imageUrl, captionActive, targetUrl, textVariants } = req.body;
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
        textVariants: variantsFromBody(textVariants) || [],
      },
    });

    res.status(201).json(ad);
  } catch (error) {
    console.error('Erro ao criar anúncio:', error);
    res.status(500).json({ error: 'Erro ao criar anúncio' });
  }
});

// Listar anúncios do usuário
router.get('/', async (req, res) => {
  try {
    const ads = await prisma.ad.findMany({
      where: { userId: req.userId },
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

// Gerar variações do anúncio com IA
router.get('/ia/status', (req, res) => {
  res.json({ enabled: isAiConfigured() });
});

router.post('/ia/variacoes', async (req, res) => {
  try {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (text.length < 10) {
      return res.status(400).json({ error: 'Escreva o anúncio (pelo menos 10 caracteres) antes de gerar variações.' });
    }
    if (text.length > 4000) {
      return res.status(400).json({ error: 'Anúncio muito longo (máximo 4000 caracteres).' });
    }

    if (!consumeAiQuota(req.userId)) {
      return res.status(429).json({ error: `Limite de ${AI_LIMIT_PER_HOUR} gerações por hora atingido. Tente mais tarde.` });
    }

    const variations = await generateAdVariations(text, req.body?.count);
    res.json({ variations });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return res.status(503).json({ error: error.message });
    }
    if (error instanceof AiRefusedError) {
      return res.status(422).json({ error: error.message });
    }
    console.error('Erro ao gerar variações com IA:', error);
    res.status(502).json({ error: 'Não foi possível gerar as variações agora. Tente novamente.' });
  }
});

// Buscar anúncio por ID
router.get('/:id', async (req, res) => {
  try {
    const ad = await prisma.ad.findFirst({
      where: { id: req.params.id, userId: req.userId },
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
    const existing = await prisma.ad.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Anúncio não encontrado' });
    }

    const { text, textActive, caption, imageUrl, captionActive, targetUrl, textVariants } = req.body;
    const resolvedTargetUrl = resolveTargetUrl({ targetUrl, text, caption });
    const variants = variantsFromBody(textVariants);

    const ad = await prisma.ad.update({
      where: { id: existing.id },
      data: {
        text,
        textActive,
        caption,
        imageUrl,
        captionActive,
        targetUrl: resolvedTargetUrl,
        ...(variants !== undefined ? { textVariants: variants } : {}),
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
    const result = await prisma.ad.deleteMany({ where: { id: req.params.id, userId: req.userId } });
    if (result.count === 0) {
      return res.status(404).json({ error: 'Anúncio não encontrado' });
    }
    res.json({ message: 'Anúncio deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar anúncio:', error);
    res.status(500).json({ error: 'Erro ao deletar anúncio' });
  }
});

module.exports = router;
