const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { resolveTargetUrl } = require('../lib/targetUrl');

// Rastreamento de cliques: GET /r/:trackingId
router.get('/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;

    // Buscar anúncio pelo trackingId
    const ad = await prisma.ad.findUnique({
      where: { trackingId },
    });

    if (!ad) {
      return res.status(404).send('Link não encontrado');
    }

    const targetUrl = resolveTargetUrl(ad);
    if (!targetUrl) {
      return res.status(400).send('Link sem destino configurado');
    }

    // Detectar dispositivo a partir do User-Agent
    const userAgent = req.headers['user-agent'] || '';
    let device = 'Desktop';
    if (/mobile/i.test(userAgent)) device = 'Mobile';
    else if (/tablet/i.test(userAgent)) device = 'Tablet';

    // Registrar clique
    await prisma.click.create({
      data: {
        adId: ad.id,
        ip: req.ip,
        userAgent: userAgent.substring(0, 500),
        country: req.headers['cf-ipcountry'] || 'BR',
        device,
        referer: req.headers['referer'] || null,
      },
    });

    // Redirecionar para a URL de destino
    res.redirect(302, targetUrl);
  } catch (error) {
    console.error('Erro no rastreamento:', error);
    res.status(500).send('Erro interno');
  }
});

module.exports = router;
