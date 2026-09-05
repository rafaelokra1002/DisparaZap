const express = require('express');
const router = express.Router();
const whatsappService = require('../services/whatsappService');

router.get('/groups', async (req, res) => {
  try {
    const groups = await whatsappService.getGroups(req.userId, req.user?.dedicatedWhatsApp);

    res.json({
      total: groups.length,
      groups,
    });
  } catch (error) {
    console.error('Erro ao listar grupos do WhatsApp:', error);
    if (error.message === 'WhatsApp exige nova autenticação por QR Code') {
      return res.status(409).json({
        error: 'WhatsApp exige nova autenticação por QR Code',
        status: 'qr_ready',
      });
    }

    if (error.message === 'WhatsApp não está conectado') {
      return res.status(409).json({
        error: 'WhatsApp não está conectado',
        status: 'disconnected',
      });
    }

    // Erro interno do WhatsApp Web (name='r', message='r') — sessão corrompida
    const isRrErr = (e) => (e?.name === 'r' && e?.message === 'r') || /^r:\s*r$/i.test((e?.message || String(e) || '').trim());
    if (isRrErr(error)) {
      return res.status(409).json({
        error: 'WhatsApp não está respondendo. Reconecte na aba WhatsApp.',
        status: 'disconnected',
      });
    }

    res.status(500).json({ error: 'Erro ao listar grupos do WhatsApp' });
  }
});

// Iniciar sessão WhatsApp global do admin
router.post('/start', async (req, res) => {
  try {
    whatsappService.initialize(req.userId, req.user?.dedicatedWhatsApp)
      .catch((error) => {
        console.error('Erro assíncrono ao iniciar WhatsApp:', error);
      });

    res.status(202).json({ message: 'Sessão WhatsApp iniciada. Aguarde o QR Code.' });
  } catch (error) {
    console.error('Erro ao iniciar WhatsApp:', error);
    res.status(500).json({ error: 'Erro ao iniciar sessão WhatsApp' });
  }
});

// Obter QR Code da sessão global
router.get('/qrcode', async (req, res) => {
  const qrCode = await whatsappService.getQRCode(req.userId, req.user?.dedicatedWhatsApp);
  const status = await whatsappService.getStatus(req.userId, req.user?.dedicatedWhatsApp);

  res.json({
    status,
    qrCode: qrCode || null,
  });
});

// Status da conexão global
router.get('/status', async (req, res) => {
  const status = await whatsappService.getStatus(req.userId, req.user?.dedicatedWhatsApp);
  res.json({ status });
});

// Desconectar sessão global
router.post('/disconnect', async (req, res) => {
  try {
    await whatsappService.disconnect(req.userId, req.user?.dedicatedWhatsApp);
    res.json({ message: 'WhatsApp desconectado' });
  } catch (error) {
    console.error('Erro ao desconectar:', error);
    res.status(500).json({ error: 'Erro ao desconectar' });
  }
});

// Logout - desvincula número e apaga sessão (para trocar de número)
router.post('/logout', async (req, res) => {
  try {
    await whatsappService.logout(req.userId, req.user?.dedicatedWhatsApp);
    res.json({ message: 'Logout realizado. Você pode conectar outro número.' });
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
    res.status(500).json({ error: 'Erro ao fazer logout' });
  }
});

module.exports = router;
