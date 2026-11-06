const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { resolveTargetUrl } = require('../lib/targetUrl');

// Robôs que abrem o link só para gerar a prévia (WhatsApp, Facebook, Telegram...).
// Não são pessoas: redireciona normalmente, mas não conta como clique.
const PREVIEW_BOT_UA = /whatsapp|facebookexternalhit|facebot|telegrambot|twitterbot|slackbot|discordbot|linkedinbot|skypeuripreview|googlebot|bingbot|bot\b|crawler|spider|preview/i;

function detectDevice(userAgent) {
  if (/tablet|ipad/i.test(userAgent)) return 'Tablet';
  if (/mobile|android|iphone/i.test(userAgent)) return 'Mobile';
  return 'Desktop';
}

// Rastreamento de cliques: GET /r/:code
// - código de envio (10 caracteres): sabe o grupo e a variação do anúncio
// - trackingId antigo do anúncio (8 caracteres): continua funcionando
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;

    let ad = null;
    let sendLog = null;

    sendLog = await prisma.sendLog.findUnique({
      where: { trackingCode: code },
      include: { ad: true },
    });

    if (sendLog) {
      ad = sendLog.ad;
    } else {
      ad = await prisma.ad.findUnique({ where: { trackingId: code } });
    }

    if (!ad) {
      return res.status(404).send('Link não encontrado');
    }

    const targetUrl = resolveTargetUrl(ad);
    if (!targetUrl) {
      return res.status(400).send('Link sem destino configurado');
    }

    const userAgent = req.headers['user-agent'] || '';

    if (!PREVIEW_BOT_UA.test(userAgent)) {
      await prisma.click.create({
        data: {
          adId: ad.id,
          sendLogId: sendLog?.id || null,
          groupId: sendLog?.groupId || null,
          variantIndex: sendLog?.variantIndex ?? null,
          ip: req.ip,
          userAgent: userAgent.substring(0, 500),
          country: req.headers['cf-ipcountry'] || 'BR',
          device: detectDevice(userAgent),
          referer: req.headers['referer'] || null,
        },
      });
    }

    res.redirect(302, targetUrl);
  } catch (error) {
    console.error('Erro no rastreamento:', error);
    res.status(500).send('Erro interno');
  }
});

module.exports = router;
