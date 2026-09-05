const prisma = require('./prisma');

async function applyPaidPlanTransaction(transactionId, paidAt = new Date()) {
  return prisma.$transaction(async (tx) => {
    const markedAsPaid = await tx.planTransaction.updateMany({
      where: {
        id: transactionId,
        status: 'pending',
      },
      data: {
        status: 'paid',
        paidAt,
      },
    });

    const transaction = await tx.planTransaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        userId: true,
        plan: true,
        days: true,
        status: true,
      },
    });

    if (!transaction) {
      return {
        outcome: 'not_found',
      };
    }

    if (markedAsPaid.count === 0) {
      return {
        outcome: transaction.status === 'paid' ? 'already_paid' : 'skipped',
        transaction,
      };
    }

    const user = await tx.user.findUnique({
      where: { id: transaction.userId },
      select: {
        planExpiresAt: true,
      },
    });

    const currentExpiry =
      user?.planExpiresAt && new Date(user.planExpiresAt) > paidAt
        ? new Date(user.planExpiresAt)
        : new Date(paidAt);

    const newExpiry = new Date(currentExpiry);
    newExpiry.setDate(newExpiry.getDate() + transaction.days);

    await tx.user.update({
      where: { id: transaction.userId },
      data: {
        plan: transaction.plan,
        planExpiresAt: newExpiry,
      },
    });

    return {
      outcome: 'applied',
      transaction,
      planExpiresAt: newExpiry,
    };
  });
}

module.exports = {
  applyPaidPlanTransaction,
};