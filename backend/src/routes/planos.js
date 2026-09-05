const express = require('express');
const router = express.Router();
const axios = require('axios');
const prisma = require('../lib/prisma');
const { getUserAccessState } = require('../lib/access');
const { applyPaidPlanTransaction } = require('../lib/planTransactions');

const MISTIC_PAY_API_URL = 'https://api.misticpay.com/api';

function getMisticPayHeaders() {
  return {
    ci: process.env.MISTIC_PAY_CLIENT_ID,
    cs: process.env.MISTIC_PAY_CLIENT_SECRET,
    'Content-Type': 'application/json',
  };
}

const PLANOS = {
  days_3: { name: '3 DIAS', days: 3, amount: 8.50 },
  days_7: { name: '7 DIAS', days: 7, amount: 14.90 },
  days_15: { name: '15 DIAS', days: 15, amount: 24.90 },
  days_30: { name: '30 DIAS', days: 30, amount: 39.90 },
};

// Status do plano atual do usuário
router.get('/status', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { email: true, plan: true, planExpiresAt: true, createdAt: true },
    });

    const accessState = getUserAccessState(user);
    const isPaid = accessState.hasActivePaidPlan;

    res.json({
      plan: accessState.resolvedPlan,
      planExpiresAt: user.planExpiresAt,
      daysLeft: accessState.daysLeft,
      isActive: isPaid,
      isFree: accessState.hasFreeAccess,
      requiresPlan: accessState.requiresPlan,
      isExpiredPaidPlan: accessState.isExpiredPaidPlan,
      isPaid,
      isPro: isPaid,
      isProPlus: accessState.resolvedPlan === 'days_30',
      hasAccess: accessState.hasSystemAccess,
      isTrialActive: accessState.isTrialActive,
      trialEndsAt: accessState.trialEndsAt,
      trialHoursLeft: accessState.trialHoursLeft,
      planLabel: accessState.isExpiredPaidPlan
        ? 'Plano vencido'
        : accessState.isTrialActive
          ? 'Teste 24h'
          : accessState.hasFreeAccess
            ? 'Grátis'
            : accessState.requiresPlan
              ? 'Sem plano'
              : (PLANOS[accessState.resolvedPlan]?.name || accessState.resolvedPlan),
    });
  } catch (error) {
    console.error('Erro ao buscar status do plano:', error);
    res.status(500).json({ error: 'Erro ao buscar status do plano' });
  }
});

// Gerar PIX para ativação/renovação de plano
router.post('/gerar-pix', async (req, res) => {
  try {
    const { plan } = req.body;
    const selectedPlan = PLANOS[plan];
    if (!selectedPlan) {
      return res.status(400).json({ error: 'Plano inválido.' });
    }

    // Chave PIX configurável via env (padrão: chave exemplo)
    const pixKey = process.env.PIX_KEY || 'pagamentos@divulgazap.com.br';
    const pixName = process.env.PIX_NAME || 'DivulgaZap';
    const pixCity = process.env.PIX_CITY || 'SAO PAULO';

    // Formatar valor com 2 casas decimais
    const valorStr = selectedPlan.amount.toFixed(2);

    // Montar Pix Copia e Cola (EMVCo simplificado — sem CRC real para MVP)
    const descricao = `DIVULGAZAP ${selectedPlan.name} ${selectedPlan.days}D`;
    const pixCode = `PIX: ${pixKey}\nValor: R$ ${valorStr}\nDescrição: ${descricao}`;

    // Registrar transação pendente
    const transaction = await prisma.planTransaction.create({
      data: {
        userId: req.userId,
        plan,
        days: selectedPlan.days,
        amount: selectedPlan.amount,
        pixCode,
        status: 'pending',
      },
    });

    res.json({
      transactionId: transaction.id,
      pixKey,
      pixName,
      amount: selectedPlan.amount,
      planName: selectedPlan.name,
      days: selectedPlan.days,
      pixCode,
    });
  } catch (error) {
    console.error('Erro ao gerar PIX:', error);
    res.status(500).json({ error: 'Erro ao gerar PIX' });
  }
});

// Confirmar pagamento (admin/webhook — marca plano como ativo)
router.post('/confirmar/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;

    const requester = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { email: true },
    });

    if (!requester || requester.email !== (process.env.ADMIN_EMAIL || 'okra1002@gmail.com')) {
      return res.status(403).json({ error: 'Apenas o administrador pode confirmar pagamentos manualmente.' });
    }

    const transaction = await prisma.planTransaction.findUnique({
      where: { id: transactionId },
      include: { user: true },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transação não encontrada' });
    }

    if (!transaction.misticPayTransactionId) {
      return res.status(400).json({ error: 'Transação sem vínculo com a Mistic Pay.' });
    }

    let providerStatus = null;
    try {
      const response = await axios.post(
        `${MISTIC_PAY_API_URL}/transactions/check`,
        { transactionId: transaction.misticPayTransactionId },
        { headers: getMisticPayHeaders() }
      );

      providerStatus = response.data?.transaction?.transactionState || null;
    } catch (providerError) {
      console.error('Erro ao validar transação na Mistic Pay:', providerError.response?.data || providerError.message);
      return res.status(502).json({ error: 'Não foi possível validar o pagamento na Mistic Pay.' });
    }

    if (providerStatus !== 'COMPLETO') {
      return res.status(400).json({
        error: 'A transação ainda não foi confirmada como paga na Mistic Pay.',
        providerStatus,
      });
    }

    const now = new Date();
    const result = await applyPaidPlanTransaction(transactionId, now);

    if (result.outcome === 'not_found') {
      return res.status(404).json({ error: 'Transação não encontrada' });
    }

    if (result.outcome === 'skipped') {
      return res.status(400).json({ error: 'Somente transações pendentes podem ser confirmadas.' });
    }

    const planExpiresAt = result.planExpiresAt || transaction.user.planExpiresAt;

    res.json({
      success: true,
      alreadyProcessed: result.outcome === 'already_paid',
      plan: transaction.plan,
      planExpiresAt,
    });
  } catch (error) {
    console.error('Erro ao confirmar pagamento:', error);
    res.status(500).json({ error: 'Erro ao confirmar pagamento' });
  }
});

module.exports = router;
