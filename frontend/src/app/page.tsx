'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { 
  MessageSquare, X, ChevronRight, Check, Users, Zap, BarChart3, Star, ChevronDown,
  TrendingUp, Shield, Clock, Target, AlertCircle, Copy, Loader
} from 'lucide-react';

type PaidPlan = 'days_3' | 'days_7' | 'days_15' | 'days_30';

const PLAN_INFO: Record<PaidPlan, {
  name: string;
  days: number;
  amount: number;
  eyebrow: string;
  tagline: string;
  cta: string;
  highlights: string[];
}> = {
  days_3: {
    name: '3 DIAS',
    days: 3,
    amount: 8.5,
    eyebrow: 'Entrada',
    tagline: 'Divulgacao em grupos e privados',
    cta: 'Assinar 3 DIAS',
    highlights: ['Disparos ilimitados', 'Envio em grupos e privados', 'Ativacao imediata por PIX'],
  },
  days_7: {
    name: '7 DIAS',
    days: 7,
    amount: 14.9,
    eyebrow: 'Mais alcance',
    tagline: 'Mais alcance e engajamento',
    cta: 'Assinar 7 DIAS',
    highlights: ['Mais tempo de exposicao', 'Melhor custo por dia', 'Ideal para validar campanhas'],
  },
  days_15: {
    name: '15 DIAS',
    days: 15,
    amount: 24.9,
    eyebrow: 'Mais vendido',
    tagline: 'Alcance continuo e reforcado',
    cta: 'Assinar 15 DIAS',
    highlights: ['Campanha continua por 15 dias', 'Reforco constante da divulgacao', 'Equilibrio entre preco e alcance'],
  },
  days_30: {
    name: '30 DIAS',
    days: 30,
    amount: 39.9,
    eyebrow: 'Maxima visibilidade',
    tagline: 'Maxima visibilidade e prioridade',
    cta: 'Assinar 30 DIAS',
    highlights: ['Presenca estendida por 30 dias', 'Prioridade para campanhas longas', 'Maior folego para escalar vendas'],
  },
};

function formatPrice(amount: number) {
  return amount.toFixed(2).replace('.', ',');
}

function CheckoutModal({ plan, onClose }: { plan: PaidPlan | null, onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'paid'>('idle');
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedUser = localStorage.getItem('disparazap_user');

    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser?.email) {
          setAccountEmail(parsedUser.email);
        }
      } catch {
        // Ignore invalid local storage data.
      }
    }

    api.getMe()
      .then((me) => {
        if (!me?.email) {
          return;
        }

        setAccountEmail(me.email);

        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            localStorage.setItem('disparazap_user', JSON.stringify({ ...parsedUser, ...me }));
          } catch {
            localStorage.setItem('disparazap_user', JSON.stringify(me));
          }
        }
      })
      .catch(() => {
        // Do not block checkout when user refresh fails.
      });
  }, []);

  const refreshUserPlan = async () => {
    try {
      const me = await api.getMe();
      if (me?.email) {
        setAccountEmail(me.email);
      }
      if (typeof window !== 'undefined' && me && !me.error) {
        localStorage.setItem('disparazap_user', JSON.stringify(me));
      }
    } catch {
      // Silent refresh after payment confirmation.
    }
  };

  const verifyPayment = async (showPendingFeedback = false) => {
    if (!transactionId || checkingPayment || paymentStatus === 'paid') {
      return;
    }

    setCheckingPayment(true);

    try {
      const data = await api.checkPayment(transactionId);

      if (!data?.success) {
        if (showPendingFeedback) {
          toast.error(data?.error || 'Nao foi possivel verificar o pagamento agora');
        }
        return;
      }

      const localStatus = data.transaction?.status;
      const providerStatus = data.transaction?.misticPayStatus;
      const isPaid = localStatus === 'paid' || providerStatus === 'COMPLETO';

      if (isPaid) {
        setPaymentStatus('paid');
        await refreshUserPlan();
        toast.success(`Pagamento aprovado. Plano ${info.name} ativado com sucesso.`);
        setTimeout(() => {
          router.push('/painel');
        }, 1500);
        return;
      }

      if (showPendingFeedback) {
        toast('Pagamento ainda nao foi confirmado. Assim que entrar, liberamos automaticamente.');
      }
    } catch {
      if (showPendingFeedback) {
        toast.error('Erro ao consultar o status do pagamento');
      }
    } finally {
      setCheckingPayment(false);
    }
  };

  useEffect(() => {
    if (!transactionId || paymentStatus !== 'pending') {
      return;
    }

    const interval = window.setInterval(() => {
      verifyPayment();
    }, 5000);

    verifyPayment();

    return () => {
      window.clearInterval(interval);
    };
  }, [transactionId, paymentStatus]);

  const handleCheckout = async () => {
    if (!plan) {
      return;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('disparazap_token') : null;
    
    if (!token) {
      window.location.href = '/login';
      return;
    }

    setLoading(true);
    try {
      const data = await api.createPayment(plan);
      if (data.success) {
        setQrCode(data.payment);
        setTransactionId(data.transaction?.id || null);
        setPaymentStatus('pending');
      } else {
        toast.error('Erro ao gerar QR code: ' + (data.details || data.error));
      }
    } catch (error: any) {
      toast.error('Erro ao processar pagamento: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (qrCode?.copyPaste) {
      navigator.clipboard.writeText(qrCode.copyPaste);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!plan) return null;

  const info = PLAN_INFO[plan];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-xl font-bold text-gray-900">Assinar {info.name}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {!qrCode ? (
            <div>
              <div className="bg-emerald-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600 mb-2">Plano selecionado:</p>
                <p className="text-lg font-black text-gray-900">{info.name}</p>
                <p className="text-sm font-medium text-gray-600 mt-1">{info.tagline}</p>
                <p className="text-2xl font-black text-emerald-600">R$ {formatPrice(info.amount)}</p>
                <p className="text-xs text-gray-500 mt-1">acesso por {info.days} dias</p>
                {accountEmail && (
                  <p className="text-xs text-gray-600 mt-3">
                    Pagamento vinculado a conta: <span className="font-semibold">{accountEmail}</span>
                  </p>
                )}
              </div>

              <button
                onClick={handleCheckout}
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"
              >
                {loading && <Loader className="w-4 h-4 animate-spin" />}
                {loading ? 'Gerando QR Code...' : 'Gerar PIX/QR Code'}
              </button>

              <p className="text-xs text-gray-500 text-center mt-4">
                Você será redirecionado ao dashboard após confirmar o pagamento
              </p>
            </div>
          ) : (
            <div className="text-center">
              <div className="bg-emerald-50 rounded-lg p-4 mb-6">
                <p className="text-sm font-bold text-emerald-700">QR Code gerado com sucesso!</p>
                <p className="text-lg font-black text-gray-900 mt-2">Plano {info.name}</p>
                <p className="text-sm text-gray-600">R$ {formatPrice(info.amount)} por {info.days} dias</p>
                {paymentStatus === 'paid' ? (
                  <p className="text-xs text-emerald-700 mt-2">Pagamento aprovado do plano {info.name}. Redirecionando para o painel...</p>
                ) : (
                  <p className="text-xs text-emerald-700 mt-2">Estamos verificando o pagamento do plano {info.name} automaticamente a cada 5 segundos.</p>
                )}
              </div>

              <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
                {qrCode.qrCode && (
                  <img
                    src={qrCode.qrCode}
                    alt="QR Code PIX"
                    className="w-full max-w-xs mx-auto"
                  />
                )}
              </div>

              {qrCode.copyPaste && (
                <div className="mb-6">
                  <p className="text-xs text-gray-500 mb-2">Copie e cole no seu banco:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={qrCode.copyPaste}
                      readOnly
                      className="flex-1 text-xs p-2 border border-gray-200 rounded bg-gray-50"
                    />
                    <button
                      onClick={copyToClipboard}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded transition"
                    >
                      <Copy className="w-4 h-4" />
                      {copied ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>
              )}

              {accountEmail && (
                <p className="text-xs text-gray-500 mb-4">
                  Este pagamento sera creditado para a conta <span className="font-semibold text-gray-700">{accountEmail}</span>.
                </p>
              )}

              <button
                onClick={() => verifyPayment(true)}
                disabled={checkingPayment || paymentStatus === 'paid'}
                className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2 mb-4"
              >
                {checkingPayment && <Loader className="w-4 h-4 animate-spin" />}
                {paymentStatus === 'paid' ? 'Pagamento confirmado' : checkingPayment ? 'Verificando pagamento...' : 'Ja paguei, verificar agora'}
              </button>

              <p className="text-xs text-gray-600">
                Após o pagamento, seu plano será ativado automaticamente. Pode levar até 1 minuto.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition text-left"
      >
        <span className="font-semibold text-gray-900">{question}</span>
        <ChevronDown className={`w-5 h-5 text-gray-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-gray-600">
          {answer}
        </div>
      )}
    </div>
  );
}

function SocialProof() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100/50 p-4 text-center text-sm sm:flex-row sm:text-left">
      <div className="flex items-center">
        {[1, 2, 3].map((i) => (
          <div key={i} className="w-6 h-6 -ml-2 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold">
            {i}
          </div>
        ))}
      </div>
      <span className="text-gray-700">
        <strong>500+ vendedores</strong> já estão ganhando dinheiro com DivulgaZap
      </span>
    </div>
  );
}

export default function LandingPage() {
  const [bannerVisible, setBannerVisible] = useState(true);
  const [cookieVisible, setCookieVisible] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<PaidPlan | null>(null);

  return (
    <div className="min-h-screen bg-white">
      {/* Announcement Banner - Urgência */}
      {bannerVisible && (
        <div className="relative flex flex-col items-center justify-center gap-3 bg-red-600 px-10 py-3 text-sm text-white sm:flex-row sm:gap-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <div className="text-center flex-1">
            <span className="font-bold">⚡ Novos acessos agora são pagos:</span> escolha seu período e libere o sistema imediatamente.
          </div>
          <button
            onClick={() => setBannerVisible(false)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header - Sticky com CTA */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-auto flex-col gap-3 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:py-0">
            <div className="flex items-center gap-2">
              <div className="bg-emerald-600 rounded-lg p-2">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">DivulgaZap</span>
            </div>
            <Link
              href="/login"
              className="w-full rounded-lg bg-emerald-600 px-5 py-2.5 text-center text-sm font-bold text-white transition hover:bg-emerald-700 sm:w-auto"
            >
              Entrar / Criar Conta →
            </Link>
          </div>
        </div>
      </header>

      {/* HERO - Headline Ultra Forte */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="max-w-3xl">
          {/* Social proof subtle no topo */}
          <SocialProof />

          {/* Headline Principal (Agressivo e direto) */}
          <h1 className="mt-6 mb-4 text-4xl font-black leading-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Venda Todos os Dias 
            <span className="block text-emerald-600">no Automático no WhatsApp</span>
          </h1>

          {/* Subheadline - Explica exatamente o que faz */}
          <p className="mb-4 text-lg leading-relaxed text-gray-600 sm:text-xl">
            Coloque seus anúncios em grupos WhatsApp 24/7. Sistema automático responde quando clientes fazem perguntas. Você só recebe mensagens de interessados.
          </p>

          {/* Urgência + CTA Principal */}
          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <Link
              href="/login"
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-lg font-bold text-lg transition shadow-lg shadow-emerald-300 flex items-center justify-center gap-2"
            >
              Criar Conta e Escolher Plano
              <ChevronRight className="w-5 h-5" />
            </Link>
            <Link
              href="https://wa.me/5571999504584"
              className="border-2 border-gray-300 text-gray-900 px-8 py-4 rounded-lg font-bold text-lg hover:border-gray-400 transition flex items-center justify-center gap-2"
            >
              Testar com Consultor
              <MessageSquare className="w-5 h-5" />
            </Link>
          </div>

          {/* Reassurance + Sem risco */}
          <p className="text-gray-600 text-sm">
            ✓ Ativação rápida  • ✓ PIX na hora  • ✓ Planos de 3, 7, 15 ou 30 dias
          </p>
        </div>
      </section>

      {/* PROVA SOCIAL - Estatísticas + Depoimentos Fortes */}
      <section className="bg-gray-50 border-y border-gray-200 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center mb-12">
            <div>
              <p className="text-3xl font-black text-emerald-600 sm:text-4xl">R$ 105k+</p>
              <p className="text-gray-600 text-sm mt-1">Faturado por clientes</p>
            </div>
            <div>
              <p className="text-3xl font-black text-emerald-600 sm:text-4xl">500+</p>
              <p className="text-gray-600 text-sm mt-1">Vendedores ativos</p>
            </div>
            <div>
              <p className="text-3xl font-black text-emerald-600 sm:text-4xl">50k+</p>
              <p className="text-gray-600 text-sm mt-1">Disparos/semana</p>
            </div>
            <div>
              <p className="text-3xl font-black text-emerald-600 sm:text-4xl">4.9★</p>
              <p className="text-gray-600 text-sm mt-1">Satisfação média</p>
            </div>
          </div>

          {/* Depoimentos com RESULTADOS ESPECÍFICOS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: 'João Silva',
                result: 'R$ 3.500/mês',
                business: 'IPTV',
                text: '2 semanas usando DivulgaZap e já fiz mais em vendas do que em 3 meses inteiros de trabalho manual.',
                rating: 5,
              },
              {
                name: 'Maria Costa',
                result: '25 clientes/mês',
                business: 'Consultório estético',
                text: 'Meu agendamento triplicou. Clientes já chegam sabendo exatamente o que querem. Investimento absurdamente bom.',
                rating: 5,
              },
              {
                name: 'Felipe Mendes',
                result: 'R$ 12k/mês',
                business: 'E-commerce',
                text: 'DivulgaZap escalou minhas vendas de R$2k pra R$12k em 3 meses. Parou de ser lado e virou meu principal canal.',
                rating: 5,
              },
            ].map((review, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-900">{review.name}</p>
                    <p className="text-xs text-emerald-600 font-semibold">{review.business.toUpperCase()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-emerald-600">{review.result}</p>
                  </div>
                </div>
                <div className="flex gap-1 mb-3">
                  {[...Array(review.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">"{review.text}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SEÇÃO DE BENEFÍCIOS - TRANSFORMAÇÃO */}
      <section id="planos" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 scroll-mt-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-black text-gray-900 mb-4">
            Por Que DivulgaZap Funciona?
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Nós resolvemos os 3 maiores problemas de quem quer ganhar dinheiro pela internet
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            {
              icon: <TrendingUp className="w-8 h-8" />,
              title: 'Venda Sem Experiência',
              desc: 'Não precisa de habilidade de vendedor. Sistema automático faz tudo. Você só recebe os interessados.',
            },
            {
              icon: <Clock className="w-8 h-8" />,
              title: 'Trabalhe No Automático',
              desc: 'Enquanto você dorme, o sistema está vendendo. Ativa uma vez e deixa rodando infinitamente.',
            },
            {
              icon: <Target className="w-8 h-8" />,
              title: 'Chegue a Milhares de Clientes',
              desc: 'Sistema acessa centenas de grupos relevantes ao seu nicho. Você não precisa estar em nenhum.',
            },
          ].map((benefit, idx) => (
            <div key={idx} className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-xl p-8 border border-emerald-200">
              <div className="text-emerald-600 mb-4">{benefit.icon}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{benefit.title}</h3>
              <p className="text-gray-600 leading-relaxed">{benefit.desc}</p>
            </div>
          ))}
        </div>

        {/* Exclusão dos problemas */}
        <div className="bg-blue-50 border-l-4 border-blue-600 p-6 rounded">
          <p className="text-gray-900 font-bold mb-3">❌ ADEUS A ESSES PROBLEMAS:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-gray-700">
            <p>✓ Não mais divulgação manual nos grupos</p>
            <p>✓ Sem perder tempo criando anúncios</p>
            <p>✓ Sem depender de tráfego pago (Facebook, Google)</p>
            <p>✓ Sem inconsistência de vendas</p>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA - SIMPLIFICADO (3 PASSOS) */}
      <section className="bg-gray-50 py-20 border-y border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block bg-emerald-100 text-emerald-700 px-4 py-1 rounded-full text-sm font-bold mb-4">
              RÁPIDO E SIMPLES
            </span>
            <h2 className="text-4xl font-black text-gray-900">
              Começar em 3 Passos
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Criar Conta (30 segundos)',
                desc: 'Nome, WhatsApp e senha. Nada mais. Você já acessa o painel.',
              },
              {
                step: '2',
                title: 'Montar Anúncio (5 minutos)',
                desc: 'Coloca título, descrição e link. Sistema valida automaticamente.',
              },
              {
                step: '3',
                title: 'Ativar e Ganhar (10 segundos)',
                desc: 'Clica em "ativar" e messagens de clientes interessados começam a chegar.',
              },
            ].map((item, idx) => (
              <div key={idx} className="relative">
                <div className="bg-white rounded-xl p-8 border border-gray-200 h-full">
                  <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center font-black text-xl mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-600">{item.desc}</p>
                </div>
                {idx < 2 && (
                  <div className="hidden md:flex absolute -right-4 top-1/3 items-center justify-center z-10">
                    <ChevronRight className="w-6 h-6 text-emerald-600" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* APRESENTAÇÃO VISUAL - Melhor Mockup */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-black text-gray-900">Veja o Sistema em Ação</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Mockup do celular melhorado */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative w-72 bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
              <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none"></div>
              <div className="bg-white rounded-[2.7rem] overflow-hidden">
                {/* WhatsApp Header */}
                <div className="bg-emerald-600 text-white px-4 py-3 flex items-center justify-between">
                  <div className="text-xs font-bold">09:42</div>
                  <div className="flex gap-1">
                    <div className="w-1 h-3 bg-white/60 rounded"></div>
                    <div className="w-1 h-3 bg-white rounded"></div>
                  </div>
                </div>

                {/* Chat Flow */}
                <div className="p-4 space-y-3 bg-gray-100 min-h-96 max-h-96 overflow-y-auto">
                  {/* Message 1 - Cliente */}
                  <div className="flex justify-start">
                    <div className="bg-white rounded-2xl rounded-tl px-3 py-2 max-w-xs shadow-sm">
                      <p className="text-xs text-gray-800">Alguém aqui trabalha com IPTV? Qual melhor custo benefício?</p>
                      <span className="text-xs text-gray-400">09:41</span>
                    </div>
                  </div>

                  {/* Message 2 - Bot DivulgaZap */}
                  <div className="flex justify-end">
                    <div className="bg-emerald-600 text-white rounded-2xl rounded-tr px-3 py-2 max-w-xs shadow-sm">
                      <p className="text-xs font-medium">IPTV Premium R$19/mês</p>
                      <p className="text-xs mt-1">✅ Acesso liberado nas primeiras 24h</p>
                      <p className="text-xs mt-1">📞 wa.me/5511999999999</p>
                      <span className="text-xs text-emerald-100">09:42</span>
                    </div>
                  </div>

                  {/* Message 3 - Cliente responde */}
                  <div className="flex justify-start">
                    <div className="bg-white rounded-2xl rounded-tl px-3 py-2 max-w-xs shadow-sm">
                      <p className="text-xs text-gray-800">Opa! Manda o link!</p>
                      <span className="text-xs text-gray-400">09:43</span>
                    </div>
                  </div>

                  {/* Sistema registra */}
                  <div className="flex justify-center">
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-bold">
                      🔔 Cliente interessado!
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Explicação ao lado */}
          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">Automático desde o início</h3>
              <p className="text-gray-600">
                1. Cliente faz pergunta no grupo sobre IPTV
              </p>
            </div>

            <div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">Sua mensagem aparece</h3>
              <p className="text-gray-600">
                2. Sistema DivulgaZap responde na hora (sem você fazer nada)
              </p>
            </div>

            <div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">Cliente vira seu cliente</h3>
              <p className="text-gray-600">
                3. Você recebe notificação e já tem um cliente pronto pra comprar
              </p>
            </div>

            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-bold transition"
            >
              Ver Painel Completo
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* QUEBRA DE OBJEÇÕES */}
      <section className="bg-gray-50 py-20 border-y border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black text-gray-900 mb-2">Dúvidas? Respondemos Tudo</h2>
            <p className="text-gray-600">As objeções mais comuns dos nossos clientes</p>
          </div>

          <div className="space-y-4">
            {[
              {
                q: '❓ Preciso aparecer publicamente/mostrar meu rosto?',
                a: 'Não! Você fica 100% invisível. O sistema coloca seu anúncio nos grupos. Ninguém sabe quem é você.',
              },
              {
                q: '❓ Funciona para qualquer nicho/negócio?',
                a: 'Sim. IPTV, consultório, loja online, infoproduto, serviços... Tudo que você vender. Se tem mercado no WhatsApp, a gente coloca seu anúncio lá.',
              },
              {
                q: '❓ Vou ser bloqueado ou banido?',
                a: 'Não. Usamos técnicas seguras e grupos aprovados. Somos um serviço legítimo com 500+ clientes ativos.',
              },
              {
                q: '❓ E se não vender nada no primeiro mês?',
                a: '7 dias de garantia: se não tiver resultado, devolvemos seu dinheiro. Sem perguntas. Mas 90% têm vendas em até 3 dias.',
              },
              {
                q: '❓ Preciso saber programação ou ter conhecimento técnico?',
                a: 'Zero conhecimento técnico necessário. Painel visual e intuitivo. Se sabe usar celular, consegue usar DivulgaZap.',
              },
              {
                q: '❓ Quantas vendas vou ter garantido?',
                a: 'Depende do seu produto, preço e público. Mas 1 cliente novo = já paga a assinatura. Clientes ganham de 1 a 50+ vendas/dia.',
              },
            ].map((item, idx) => (
              <FAQItem key={idx} question={item.q} answer={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* PLANOS - PERSUASIVOS E COM URGÊNCIA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <span className="inline-block bg-red-100 text-red-700 px-4 py-1.5 rounded-full text-sm font-bold mb-4">
            ⚠️ NOVOS CADASTROS ENTRAM COM 24H DE ACESSO
          </span>
          <h2 className="text-4xl font-black text-gray-900 mb-2">Escolha Seu Plano</h2>
          <p className="text-gray-600 text-lg">Use as primeiras 24 horas para testar e depois mantenha o acesso com o plano ideal.</p>
        </div>

        <div className="max-w-5xl mx-auto mb-6 rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-cyan-50 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-700">Ativação por período</p>
              <h3 className="mt-2 text-2xl font-black text-gray-900">Escolha o tempo ideal da sua campanha e ative o painel no mesmo dia</h3>
              <p className="mt-2 text-sm text-gray-600">Novos usuários ganham 24 horas de acesso inicial. Depois disso, o sistema fica bloqueado até o pagamento de um plano. Usuários antigos continuam com as regras atuais.</p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-2xl border-2 border-emerald-600 px-5 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50"
            >
              Criar conta
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 max-w-6xl mx-auto mb-8 md:grid-cols-2 xl:grid-cols-4">
          {(['days_3', 'days_7', 'days_15', 'days_30'] as PaidPlan[]).map((planId) => {
            const info = PLAN_INFO[planId];
            const isFeatured = planId === 'days_15';
            const isPremium = planId === 'days_30';

            return (
              <div
                key={planId}
                className={[
                  'relative overflow-hidden rounded-[28px] border p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]',
                  isFeatured
                    ? 'border-cyan-400 bg-gradient-to-b from-sky-900 via-blue-900 to-slate-950 text-white'
                    : isPremium
                    ? 'border-emerald-300 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white'
                    : 'border-sky-200 bg-white text-slate-900',
                ].join(' ')}
              >
                {isFeatured && (
                  <span className="absolute right-4 top-4 rounded-full bg-lime-300 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-slate-900">
                    Mais vendido
                  </span>
                )}

                <p className={[
                  'text-xs font-black uppercase tracking-[0.22em]',
                  isFeatured || isPremium ? 'text-cyan-200' : 'text-sky-700',
                ].join(' ')}>
                  {info.eyebrow}
                </p>

                <div className="mt-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-3xl font-black">{info.name}</p>
                    <p className={[
                      'mt-2 text-sm leading-6',
                      isFeatured || isPremium ? 'text-slate-200' : 'text-slate-600',
                    ].join(' ')}>
                      {info.tagline}
                    </p>
                  </div>
                  <div className={[
                    'rounded-2xl p-3',
                    isFeatured || isPremium ? 'bg-white/10' : 'bg-sky-50',
                  ].join(' ')}>
                    <Clock className={[
                      'h-5 w-5',
                      isFeatured || isPremium ? 'text-cyan-200' : 'text-sky-700',
                    ].join(' ')} />
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className={[
                    'text-xs font-bold uppercase tracking-wide',
                    isFeatured || isPremium ? 'text-cyan-200' : 'text-slate-500',
                  ].join(' ')}>
                    Apenas
                  </p>
                  <p className="mt-1 text-4xl font-black">R$ {formatPrice(info.amount)}</p>
                  <p className={[
                    'mt-1 text-sm',
                    isFeatured || isPremium ? 'text-slate-200' : 'text-slate-600',
                  ].join(' ')}>
                    acesso por {info.days} dias
                  </p>
                </div>

                <ul className="mt-6 space-y-3 text-sm">
                  {info.highlights.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <Check className={[
                        'mt-0.5 h-4 w-4 shrink-0',
                        isFeatured || isPremium ? 'text-lime-300' : 'text-emerald-600',
                      ].join(' ')} />
                      <span className={isFeatured || isPremium ? 'text-slate-100' : 'text-slate-700'}>{item}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => setCheckoutPlan(planId)}
                  className={[
                    'mt-8 w-full rounded-2xl py-3 text-sm font-black transition',
                    isFeatured
                      ? 'bg-lime-300 text-slate-900 hover:bg-lime-200'
                      : isPremium
                      ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                      : 'bg-sky-700 text-white hover:bg-sky-800',
                  ].join(' ')}
                >
                  {info.cta}
                </button>
              </div>
            );
          })}
        </div>

        {/* Garantia de satisfação */}
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-6 text-center">
          <Shield className="w-8 h-8 text-blue-600 mx-auto mb-2" />
          <p className="font-bold text-gray-900 mb-1">Garantia de 7 dias</p>
          <p className="text-gray-600 text-sm">
            Se não tiver resultado em uma semana, devolvemos seu dinheiro. Sem perguntas. Confiamos no nosso produto.
          </p>
        </div>
      </section>

      {/* CTA FINAL - URGÊNCIA MÁXIMA */}
      <section className="bg-gradient-to-r from-emerald-600 to-emerald-700 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h2 className="text-4xl font-black mb-4">
            Sua Primeira Venda Pode Sair Hoje
          </h2>
          <p className="text-xl text-emerald-100 mb-8 max-w-2xl mx-auto">
            Cadastro leva 30 segundos. Primeira divulgação sai em 5 minutos. Primeiras vendas chegam em até 24h.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link
              href="/login"
              className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 px-8 py-4 rounded-lg font-black text-lg transition shadow-lg flex items-center justify-center gap-2"
            >
              Quero Vender no Automático
              <Zap className="w-5 h-5" />
            </Link>
            <Link
              href="https://wa.me/5571999504584"
              className="bg-white/20 hover:bg-white/30 text-white px-8 py-4 rounded-lg font-bold text-lg transition"
            >
              Falar com Consultor
            </Link>
          </div>

          <p className="text-emerald-100 text-sm">
            💳 PIX rápido • ✅ Liberação automática • ⚡ Ativação em poucos minutos
          </p>
        </div>
      </section>

      {/* Footer - Confiança */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <p className="font-bold text-white mb-4">Sobre</p>
              <ul className="space-y-2 text-sm">
                <li><Link href="#" className="hover:text-white">Como funciona</Link></li>
                <li><Link href="#" className="hover:text-white">Termos de serviço</Link></li>
                <li><Link href="#" className="hover:text-white">Privacidade</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-white mb-4">Suporte</p>
              <ul className="space-y-2 text-sm">
                <li><Link href="https://wa.me/5571999504584" className="hover:text-white">WhatsApp</Link></li>
                <li><Link href="#" className="hover:text-white">Email</Link></li>
                <li><Link href="#" className="hover:text-white">FAQ</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-white mb-4">Legal</p>
              <ul className="space-y-2 text-sm">
                <li><Link href="#" className="hover:text-white">CNPJ: 00.000.000/0000-00</Link></li>
                <li><Link href="#" className="hover:text-white">Razão Social</Link></li>
                <li><Link href="#" className="hover:text-white">Contato</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-8 text-center">
            <p className="text-sm">
              © {new Date().getFullYear()} DivulgaZap. Todos os direitos reservados.
            </p>
            <p className="text-xs mt-2">
              Desenvolvido com ❤️ para vendedores que querem crescer
            </p>
          </div>
        </div>
      </footer>

      {/* Cookie Banner */}
      {cookieVisible && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white px-6 py-4 flex items-center justify-between gap-4 z-40 border-t border-gray-700">
          <p className="text-sm">Usamos cookies para melhorar sua experiência.</p>
          <button
            onClick={() => setCookieVisible(false)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition shrink-0"
          >
            Entendi
          </button>
        </div>
      )}

      {/* Stats */}
      <section className="border-t border-b border-gray-200 bg-white/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl font-extrabold text-gray-900">R$ 105k+</p>
              <p className="text-sm text-gray-500 mt-1">gerado pelos clientes</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-gray-900">500+</p>
              <p className="text-sm text-gray-500 mt-1">anunciantes ativos</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-gray-900">50k+</p>
              <p className="text-sm text-gray-500 mt-1">disparos/semana</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-gray-900">4.9/5</p>
              <p className="text-sm text-gray-500 mt-1">classificação média</p>
            </div>
          </div>
        </div>
      </section>

      {/* Como funciona - OLD STRUCTURE REMOVED */}

      {/* Checkout Modal */}
      <CheckoutModal plan={checkoutPlan} onClose={() => setCheckoutPlan(null)} />
    </div>
  );
}

