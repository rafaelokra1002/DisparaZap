const express = require('express');
const router = express.Router();
const whatsappService = require('../services/whatsappService');

function getGroupsAvailabilityError(error) {
  if (!error?.message) {
    return null;
  }

  if (error.message === 'WhatsApp não está conectado') {
    return error.message;
  }

  if (error.message === 'WhatsApp exige nova autenticação por QR Code') {
    return error.message;
  }

  return null;
}

// Listar grupos da sessão global do WhatsApp
router.get('/', async (req, res) => {
  try {
    const groups = await whatsappService.getGroups(req.userId);

    res.json({
      total: groups.length,
      groups,
    });
  } catch (error) {
    console.error('Erro ao listar grupos:', error);
    const availabilityError = getGroupsAvailabilityError(error);
    if (availabilityError) {
      return res.status(400).json({ error: availabilityError });
    }

    res.status(500).json({ error: 'Erro ao listar grupos' });
  }
});

module.exports = router;
