const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'okra1002@gmail.com').toLowerCase();
const TRIAL_HOURS = 24;
const TRIAL_DURATION_MS = TRIAL_HOURS * 60 * 60 * 1000;

function isAdminEmail(email) {
  return (email || '').toLowerCase() === ADMIN_EMAIL;
}

function hasDedicatedWhatsAppAccess(user) {
  if (!user) {
    return false;
  }

  if (user.dedicatedWhatsApp) {
    return true;
  }

  return getUserAccessState(user).isTrialActive;
}

function getUserAccessState(user, now = new Date()) {
  if (!user) {
    return {
      isAdmin: false,
      hasNoPlan: false,
      hasFreeAccess: false,
      hasPaidPlan: false,
      hasActivePaidPlan: false,
      isExpiredPaidPlan: false,
      resolvedPlan: 'no_plan',
      daysLeft: 0,
      trialEndsAt: null,
      isTrialActive: false,
      trialExpired: false,
      trialHoursLeft: 0,
      hasSystemAccess: false,
      requiresPlan: true,
      planLabel: 'Sem plano',
      accessMode: 'blocked',
    };
  }

  const isAdmin = isAdminEmail(user.email);
  const hasNoPlan = user.plan === 'no_plan';
  const hasFreePlan = user.plan === 'free';
  const hasPaidPlan = !hasNoPlan && !hasFreePlan;
  const hasActivePaidPlan =
    hasPaidPlan && !!user.planExpiresAt && new Date(user.planExpiresAt) > now;
  const isExpiredPaidPlan = hasPaidPlan && !hasActivePaidPlan;
  const resolvedPlan = user.plan;
  const hasFreeAccess = hasFreePlan;
  const daysLeft = hasActivePaidPlan
    ? Math.ceil((new Date(user.planExpiresAt) - now) / (1000 * 60 * 60 * 24))
    : 0;

  const createdAt = user.createdAt ? new Date(user.createdAt) : null;
  const trialEndsAt = hasNoPlan && createdAt
    ? new Date(createdAt.getTime() + TRIAL_DURATION_MS)
    : null;
  const isTrialActive = hasNoPlan && !!trialEndsAt && trialEndsAt > now;
  const trialExpired = hasNoPlan && !!trialEndsAt && trialEndsAt <= now;
  const trialHoursLeft = isTrialActive
    ? Math.max(1, Math.ceil((trialEndsAt - now) / (1000 * 60 * 60)))
    : 0;

  const hasSystemAccess = isAdmin || hasActivePaidPlan || hasFreeAccess || isTrialActive;
  const requiresPlan = !isAdmin && !hasSystemAccess;

  let accessMode = 'blocked';
  if (isAdmin) {
    accessMode = 'admin';
  } else if (hasActivePaidPlan) {
    accessMode = 'paid';
  } else if (isExpiredPaidPlan) {
    accessMode = 'expired_paid';
  } else if (isTrialActive) {
    accessMode = 'trial';
  } else if (hasFreeAccess) {
    accessMode = 'free';
  }

  let planLabel = 'Sem plano';
  if (hasActivePaidPlan) {
    planLabel = resolvedPlan;
  } else if (isExpiredPaidPlan) {
    planLabel = 'Plano vencido';
  } else if (isTrialActive) {
    planLabel = 'Teste 24h';
  } else if (hasFreeAccess) {
    planLabel = 'Grátis';
  }

  return {
    isAdmin,
    hasNoPlan,
    hasFreeAccess,
    hasPaidPlan,
    hasActivePaidPlan,
    isExpiredPaidPlan,
    resolvedPlan,
    daysLeft,
    trialEndsAt,
    isTrialActive,
    trialExpired,
    trialHoursLeft,
    hasSystemAccess,
    requiresPlan,
    planLabel,
    accessMode,
  };
}

function hasSystemAccess(user, now = new Date()) {
  return getUserAccessState(user, now).hasSystemAccess;
}

module.exports = {
  ADMIN_EMAIL,
  TRIAL_HOURS,
  isAdminEmail,
  hasDedicatedWhatsAppAccess,
  getUserAccessState,
  hasSystemAccess,
};