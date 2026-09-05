require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const authRouter = require('./routes/auth');
const adsRouter = require('./routes/ads');
const dispararRouter = require('./routes/disparar');
const gruposRouter = require('./routes/grupos');
const metricasRouter = require('./routes/metricas');
const trackingRouter = require('./routes/tracking');
const whatsappRouter = require('./routes/whatsapp');
const uploadRouter = require('./routes/upload');
const planosRouter = require('./routes/planos');
const pagamentosRouter = require('./routes/pagamentos');
const adminRouter = require('./routes/admin');
const { authMiddleware, adminMiddleware, whatsappAccessMiddleware, systemAccessMiddleware } = require('./middleware/auth');
const { applyPaidPlanTransaction } = require('./lib/planTransactions');

const prisma = new PrismaClient();

// Inicializar worker de fila
require('./workers/sendWorker');

const app = express();
const PORT = process.env.PORT || 3002;

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:3003'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir uploads estáticos
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Webhook de pagamentos (SEM autenticação)
app.post('/api/pagamentos/webhook', async (req, res) => {
  try {
    const { transactionId, status, value, fee } = req.body;
    console.log('Webhook Mistic Pay recebido:', { transactionId, status, value, fee });

    if (!transactionId || !status) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }

    // Encontrar transação no banco
    const transaction = await prisma.planTransaction.findFirst({
      where: { misticPayTransactionId: transactionId.toString() }
    });

    if (!transaction) {
      console.warn(`Transação não encontrada: ${transactionId}`);
      return res.status(404).json({ error: 'Transação não encontrada' });
    }

    if (status === 'COMPLETO') {
      const result = await applyPaidPlanTransaction(transaction.id, new Date());

      if (result.outcome === 'applied') {
        console.log(`✅ Plano ativado: ${transaction.plan} para usuário ${transaction.userId}`);
      } else if (result.outcome === 'already_paid') {
        console.log(`ℹ️ Transação já processada anteriormente: ${transaction.id}`);
      } else {
        console.warn(`⚠️ Transação não pôde ser ativada no webhook: ${transaction.id} (${result.outcome})`);
      }
    } else if (status === 'FALHA') {
      await prisma.planTransaction.update({
        where: { id: transaction.id },
        data: { status: 'cancelled' }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Erro no webhook:', error.message);
    res.status(500).json({ error: 'Erro ao processar webhook' });
  }
});

// Rotas públicas
app.use('/api/auth', authRouter);

// Rotas protegidas (requerem autenticação)
app.use('/api/ads', authMiddleware, systemAccessMiddleware, adsRouter);
app.use('/api/disparar', authMiddleware, systemAccessMiddleware, dispararRouter);
app.use('/api/grupos', authMiddleware, systemAccessMiddleware, gruposRouter);
app.use('/api/metricas', authMiddleware, systemAccessMiddleware, metricasRouter);
app.use('/api/whatsapp', authMiddleware, systemAccessMiddleware, whatsappAccessMiddleware, whatsappRouter);
app.use('/api/upload', authMiddleware, systemAccessMiddleware, uploadRouter);
app.use('/api/planos', authMiddleware, planosRouter);
app.use('/api/pagamentos/', authMiddleware, pagamentosRouter);
app.use('/api/admin', authMiddleware, adminMiddleware, adminRouter);

// Rota de rastreamento de cliques
app.use('/r', trackingRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
