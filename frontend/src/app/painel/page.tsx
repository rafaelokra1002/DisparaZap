'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import Tabs from '@/components/Tabs';
import OverviewTab from '@/components/OverviewTab';
import AdsTab from '@/components/AdsTab';
import ClicksTab from '@/components/ClicksTab';
import HistoryTab from '@/components/HistoryTab';
import WhatsAppTab from '@/components/WhatsAppTab';
import { api } from '@/lib/api';

type PaidPlan = 'days_3' | 'days_7' | 'days_15' | 'days_30';

const PLAN_OPTIONS: Array<{
  id: PaidPlan;
  name: string;
  days: number;
  amount: number;
  description: string;
}> = [
  { id: 'days_3', name: '3 DIAS', days: 3, amount: 8.5, description: 'Entrada rapida para comecar a divulgar agora.' },
  { id: 'days_7', name: '7 DIAS', days: 7, amount: 14.9, description: 'Mais alcance para validar campanhas por uma semana.' },
  { id: 'days_15', name: '15 DIAS', days: 15, amount: 24.9, description: 'Opcao mais escolhida para manter constancia.' },
  { id: 'days_30', name: '30 DIAS', days: 30, amount: 39.9, description: 'Maxima duracao para campanhas continuas.' },
];

function formatPrice(amount: number) {
  return amount.toFixed(2).replace('.', ',');
}

export default function PainelPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [userName, setUserName] = useState('');
  const [userPlan, setUserPlan] = useState('free');
  const [planActive, setPlanActive] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [isTrialActive, setIsTrialActive] = useState(false);
  const [trialHoursLeft, setTrialHoursLeft] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canManageWhatsApp, setCanManageWhatsApp] = useState(false);
  const [usesDedicatedWhatsApp, setUsesDedicatedWhatsApp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPlans, setShowPlans] = useState(false);
  const [loadingPlanId, setLoadingPlanId] = useState<PaidPlan | null>(null);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [paymentPlan, setPaymentPlan] = useState<PaidPlan | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [checkingPayment, setCheckingPayment] = useState(false);

  const refreshUser = async () => {
    const me = await api.getMe();
    if (me?.name) {
      setUserName(me.name);
    }
    setUserPlan(me?.plan || 'free');
    setPlanActive(!!me?.planActive);
    setHasAccess(!!me?.hasAccess);
    setIsTrialActive(!!me?.isTrialActive);
    setTrialHoursLeft(Number(me?.trialHoursLeft) || 0);
    setIsAdmin(!!me?.isAdmin);
    setCanManageWhatsApp(!!me?.canManageWhatsApp || !!me?.usesDedicatedWhatsApp);
    setUsesDedicatedWhatsApp(!!me?.usesDedicatedWhatsApp);
    localStorage.setItem('disparazap_user', JSON.stringify(me));
    return me;
  };

  useEffect(() => {
    const token = localStorage.getItem('disparazap_token');
    if (!token) {
      router.push('/login');
      return;
    }

    const user = localStorage.getItem('disparazap_user');
    if (user) {
      try {
        const parsed = JSON.parse(user);
        setUserName(parsed.name || 'Usuário');
        setHasAccess(!!parsed.hasAccess);
        setIsTrialActive(!!parsed.isTrialActive);
        setTrialHoursLeft(Number(parsed.trialHoursLeft) || 0);
        setIsAdmin(!!parsed.isAdmin);
        setCanManageWhatsApp(!!parsed.canManageWhatsApp || !!parsed.usesDedicatedWhatsApp);
        setUsesDedicatedWhatsApp(!!parsed.usesDedicatedWhatsApp);
      } catch {
        setUserName('Usuário');
      }
    }

    refreshUser()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!transactionId || !paymentData) {
      return;
    }

    const interval = window.setInterval(async () => {
      if (checkingPayment) {
        return;
      }

      try {
        setCheckingPayment(true);
        const data = await api.checkPayment(transactionId);
        const localStatus = data?.transaction?.status;
        const providerStatus = data?.transaction?.misticPayStatus;
        const isPaid = localStatus === 'paid' || providerStatus === 'COMPLETO';

        if (isPaid) {
          window.clearInterval(interval);
          await refreshUser();
          setPaymentData(null);
          setPaymentPlan(null);
          setTransactionId(null);
          setShowPlans(false);
          toast.success('Pagamento aprovado. Painel liberado com sucesso.');
        }
      } catch {
      } finally {
        setCheckingPayment(false);
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [transactionId, paymentData, checkingPayment]);

  const handleLogout = () => {
    localStorage.removeItem('disparazap_token');
    localStorage.removeItem('disparazap_user');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleChoosePlan = async (planId: PaidPlan) => {
    setLoadingPlanId(planId);
    try {
      const data = await api.createPayment(planId);
      if (!data?.success) {
        toast.error(data?.details || data?.error || 'Nao foi possivel gerar o pagamento');
        return;
      }

      setPaymentPlan(planId);
      setPaymentData(data.payment);
      setTransactionId(data.transaction?.id || null);
      toast.success('PIX gerado. Finalize o pagamento para liberar o painel.');
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao gerar o pagamento');
    } finally {
      setLoadingPlanId(null);
    }
  };

  const handleCopyPix = async () => {
    if (!paymentData?.copyPaste) {
      return;
    }

    await navigator.clipboard.writeText(paymentData.copyPaste);
    toast.success('Codigo PIX copiado');
  };

  const handleCheckPayment = async () => {
    if (!transactionId) {
      return;
    }

    setCheckingPayment(true);
    try {
      const data = await api.checkPayment(transactionId);
      const localStatus = data?.transaction?.status;
      const providerStatus = data?.transaction?.misticPayStatus;
      const isPaid = localStatus === 'paid' || providerStatus === 'COMPLETO';

      if (isPaid) {
        await refreshUser();
        setPaymentData(null);
        setPaymentPlan(null);
        setTransactionId(null);
        setShowPlans(false);
        toast.success('Pagamento aprovado. Painel liberado com sucesso.');
        return;
      }

      toast('Pagamento ainda nao confirmado. Assim que cair, o painel libera automaticamente.');
    } catch {
      toast.error('Nao foi possivel verificar o pagamento agora');
    } finally {
      setCheckingPayment(false);
    }
  };

  function renderTab() {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab />;
      case 'ads':
        return <AdsTab />;
      case 'clicks':
        return <ClicksTab />;
      case 'history':
        return <HistoryTab />;
      case 'whatsapp':
        return canManageWhatsApp ? <WhatsAppTab /> : <OverviewTab />;
      default:
        return <OverviewTab />;
    }
  }

  const requiresPaidPlan = !isAdmin && !hasAccess;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userName={userName} onLogout={handleLogout} />
      {!requiresPaidPlan && <Tabs activeTab={activeTab} onTabChange={setActiveTab} showWhatsApp={canManageWhatsApp} />}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {requiresPaidPlan ? (
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="rounded-3xl border border-emerald-200 bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-700">Plano necessário</p>
              <h2 className="mt-3 text-3xl font-black text-gray-900">Seu acesso de teste terminou</h2>
              <p className="mt-3 text-base leading-7 text-gray-600">
                As primeiras 24 horas ficam liberadas para novos cadastros. Depois desse período, o painel só volta a abrir com o pagamento de um plano de 3, 7, 15 ou 30 dias.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => setShowPlans(true)}
                  className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
                >
                  Ver planos
                </button>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center rounded-2xl border border-gray-300 px-6 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
                >
                  Sair
                </button>
              </div>
            </div>

            {showPlans && (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {PLAN_OPTIONS.map((plan) => (
                    <div key={plan.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">{plan.name}</p>
                      <p className="mt-4 text-4xl font-black text-slate-900">R$ {formatPrice(plan.amount)}</p>
                      <p className="mt-1 text-sm text-slate-500">acesso por {plan.days} dias</p>
                      <p className="mt-4 min-h-[72px] text-sm leading-6 text-slate-600">{plan.description}</p>
                      <button
                        onClick={() => handleChoosePlan(plan.id)}
                        disabled={loadingPlanId === plan.id}
                        className="mt-6 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
                      >
                        {loadingPlanId === plan.id ? 'Gerando PIX...' : 'Escolher plano'}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-700">Pagamento</p>
                  {paymentData && paymentPlan ? (
                    <>
                      <h3 className="mt-3 text-2xl font-black text-slate-900">Finalize o PIX do plano {PLAN_OPTIONS.find((plan) => plan.id === paymentPlan)?.name}</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        Assim que o pagamento for confirmado, o painel sera liberado automaticamente.
                      </p>
                      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        {paymentData.qrCode && (
                          <img src={paymentData.qrCode} alt="QR Code PIX" className="mx-auto w-full max-w-[220px] rounded-2xl bg-white p-3" />
                        )}
                      </div>
                      {paymentData.copyPaste && (
                        <>
                          <textarea
                            value={paymentData.copyPaste}
                            readOnly
                            className="mt-4 h-28 w-full rounded-2xl border border-slate-200 p-3 text-xs text-slate-600"
                          />
                          <button
                            onClick={handleCopyPix}
                            className="mt-3 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                          >
                            Copiar codigo PIX
                          </button>
                        </>
                      )}
                      <button
                        onClick={handleCheckPayment}
                        disabled={checkingPayment}
                        className="mt-3 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {checkingPayment ? 'Verificando...' : 'Ja paguei, verificar agora'}
                      </button>
                    </>
                  ) : (
                    <>
                      <h3 className="mt-3 text-2xl font-black text-slate-900">Escolha um plano ao lado</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        Quando voce selecionar um plano, o QR Code PIX aparece aqui para concluir a ativacao sem sair desta pagina.
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
        {!isAdmin && isTrialActive && (
          <div className="mb-6 rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 to-sky-50 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-cyan-700">Teste de 24 horas</p>
                <h2 className="text-lg font-black text-gray-900">Seu acesso está liberado agora e termina em cerca de {trialHoursLeft}h</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Aproveite para configurar o painel. Quando o teste acabar, o sistema fica bloqueado até o pagamento de um plano.
                </p>
              </div>
              <Link
                href="/#planos"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                Ver planos
              </Link>
            </div>
          </div>
        )}
        {!isAdmin && !isTrialActive && (!planActive || userPlan === 'free') && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold text-amber-700 uppercase tracking-wide">Plano Grátis</p>
                <h2 className="text-lg font-black text-gray-900">Seu limite atual é de 150 disparos por dia</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Para continuar enviando sem bloqueio diário, escolha um plano de 3, 7, 15 ou 30 dias.
                </p>
              </div>
              <Link
                href="/#planos"
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                Ver planos pagos
              </Link>
            </div>
          </div>
        )}
        {renderTab()}
          </>
        )}
      </main>
    </div>
  );
}
