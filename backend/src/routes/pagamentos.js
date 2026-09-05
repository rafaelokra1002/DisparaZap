const express = require('express');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { applyPaidPlanTransaction } = require('../lib/planTransactions');

const router = express.Router();
const prisma = new PrismaClient();

const MISTIC_PAY_API_URL = 'https://api.misticpay.com/api';
const MISTIC_PAY_CLIENT_ID = process.env.MISTIC_PAY_CLIENT_ID;
const MISTIC_PAY_CLIENT_SECRET = process.env.MISTIC_PAY_CLIENT_SECRET;

// Headers padrão para requisições Mistic Pay
const getMisticPayHeaders = () => ({
  'ci': MISTIC_PAY_CLIENT_ID,
  'cs': MISTIC_PAY_CLIENT_SECRET,
  'Content-Type': 'application/json'
});

// Informações dos planos
const PLANS = {
  days_3: {
    days: 3,
    amount: 8.50,
    name: '3 DIAS'
  },
  days_7: {
    days: 7,
    amount: 14.90,
    name: '7 DIAS'
  },
  days_15: {
    days: 15,
    amount: 24.90,
    name: '15 DIAS'
  },
  days_30: {
    days: 30,
    amount: 39.90,
    name: '30 DIAS'
  }
};

/**
 * POST /api/pagamentos/criar (COM AUTENTICAÇÃO)
 * Cria uma transação PIX na Mistic Pay e retorna QR code
 */
router.post('/criar', async (req, res) => {
  try {
    const { plan } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (!plan || !PLANS[plan]) {
      return res.status(400).json({ error: 'Plano inválido' });
    }

    const planInfo = PLANS[plan];

    // Criar transação no banco antes de enviar para Mistic Pay
    const transaction = await prisma.planTransaction.create({
      data: {
        userId: user.id,
        plan: plan,
        days: planInfo.days,
        amount: planInfo.amount,
        status: 'pending'
      }
    });

    // Gerar ID único para a transação
    const clientTransactionId = `divulgarzap-${transaction.id.substring(0, 8)}-${Date.now()}`;

    // Criar transação na Mistic Pay
    const misticPayResponse = await axios.post(
      `${MISTIC_PAY_API_URL}/transactions/create`,
      {
        amount: planInfo.amount,
        payerName: user.name,
        payerDocument: '00000000000', // Usar CPF real se disponível
        transactionId: clientTransactionId,
        description: `Plano ${planInfo.name} - DivulgaZap`,
        projectWebhook: process.env.MISTIC_PAY_WEBHOOK_URL
      },
      { headers: getMisticPayHeaders() }
    );

    // Atualizar transação com dados da Mistic Pay
    await prisma.planTransaction.update({
      where: { id: transaction.id },
      data: {
        misticPayTransactionId: misticPayResponse.data.data.transactionId,
        pixCode: misticPayResponse.data.data.copyPaste
      }
    });

    // Retornar QR code e dados
    res.json({
      success: true,
      transaction: {
        id: transaction.id,
        plan: plan,
        amount: planInfo.amount,
        days: planInfo.days
      },
      payment: {
        transactionId: misticPayResponse.data.data.transactionId,
        qrCode: misticPayResponse.data.data.qrCodeBase64,
        qrCodeUrl: misticPayResponse.data.data.qrcodeUrl,
        copyPaste: misticPayResponse.data.data.copyPaste,
        value: misticPayResponse.data.data.transactionAmount / 100 // Converter de centavos
      }
    });
  } catch (error) {
    console.error('Erro ao criar transação Mistic Pay:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Erro ao gerar pagamento',
      details: error.response?.data?.message || error.message
    });
  }
});

/**
 * GET /api/pagamentos/verificar/:transactionId (COM AUTENTICAÇÃO)
 * Verifica o status de uma transação
 */
router.get('/verificar/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;

    const transaction = await prisma.planTransaction.findFirst({
      where: {
        id: transactionId,
        userId: req.userId
      }
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transação não encontrada' });
    }

    // Verificar status com Mistic Pay
    if (transaction.misticPayTransactionId) {
      try {
        const response = await axios.post(
          `${MISTIC_PAY_API_URL}/transactions/check`,
          { transactionId: transaction.misticPayTransactionId },
          { headers: getMisticPayHeaders() }
        );

        const misticStatus = response.data.transaction.transactionState;
        let localStatus = transaction.status;
        let paidAt = transaction.paidAt;

        if (misticStatus === 'COMPLETO' && transaction.status === 'pending') {
          const result = await applyPaidPlanTransaction(transaction.id, new Date());

          if (result.outcome === 'applied' || result.outcome === 'already_paid') {
            localStatus = 'paid';
            paidAt = result.transaction?.paidAt || transaction.paidAt || new Date();
          }
        }

        res.json({
          success: true,
          transaction: {
            id: transaction.id,
            plan: transaction.plan,
            amount: transaction.amount,
            status: localStatus,
            misticPayStatus: misticStatus,
            paidAt
          }
        });
      } catch (misticError) {
        console.error('Erro ao verificar com Mistic Pay:', misticError.message);
        // Retornar status local se Mistic Pay estiver indisponível
        res.json({
          success: true,
          transaction: {
            id: transaction.id,
            plan: transaction.plan,
            amount: transaction.amount,
            status: transaction.status
          }
        });
      }
    } else {
      res.json({
        success: true,
        transaction: {
          id: transaction.id,
          plan: transaction.plan,
          amount: transaction.amount,
          status: transaction.status
        }
      });
    }
  } catch (error) {
    console.error('Erro ao verificar transação:', error.message);
    res.status(500).json({ error: 'Erro ao verificar transação' });
  }
});

/**
 * GET /api/pagamentos/saldo (COM AUTENTICAÇÃO)
 * Retorna saldo da conta Mistic Pay (admin only)
 */
router.get('/saldo', async (req, res) => {
  try {
    const response = await axios.get(
      `${MISTIC_PAY_API_URL}/users/balance`,
      { headers: getMisticPayHeaders() }
    );

    res.json({
      success: true,
      balance: response.data.data.balance
    });
  } catch (error) {
    console.error('Erro ao obter saldo:', error.message);
    res.status(500).json({ error: 'Erro ao obter saldo' });
  }
});

module.exports = router;

