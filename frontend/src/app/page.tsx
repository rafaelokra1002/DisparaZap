'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { X, Copy, Loader } from 'lucide-react';

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

const Tick = () => (
  <svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" /></svg>
);

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

export default function LandingPage() {
  const [checkoutPlan, setCheckoutPlan] = useState<PaidPlan | null>(null);
  const plans: PaidPlan[] = ['days_3', 'days_7', 'days_15', 'days_30'];

  return (
    <div className="dz">
      <style>{CSS}</style>

      <header>
        <div className="wrap nav">
          <div className="brand">
            <span className="mark"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20Zm4.4-5.6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.1-.2 0-.4.1-.5l.4-.5.2-.4v-.4l-.8-1.8c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4 0-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.4c.1.2 1.7 2.6 4.1 3.6 1.5.6 2 .7 2.7.6.5-.1 1.4-.6 1.5-1.1.2-.5.2-1 .1-1.1l-.3-.2Z" /></svg></span>
            DisparaZap
          </div>
          <nav className="links">
            <a href="#recursos">Recursos</a>
            <a href="#como">Como funciona</a>
            <a href="#planos">Planos</a>
            <a href="#faq">Dúvidas</a>
          </nav>
          <div className="right">
            <Link className="login" href="/login">Entrar</Link>
            <Link className="btn btn-primary" href="/login">Começar grátis</Link>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="wrap">
          <div>
            <span className="eyebrow">Disparo em grupos de WhatsApp</span>
            <h1>Divulgue em <span className="hl">dezenas de grupos</span> com um clique</h1>
            <p className="lead">Monte o anúncio uma vez e envie para todos os seus grupos de WhatsApp, com agendamento automático e relatório de cliques.</p>
            <div className="cta">
              <Link className="btn btn-gold btn-lg" href="/login">Criar conta grátis</Link>
              <a className="btn btn-ghost btn-lg hero-ghost" href="#planos">Ver planos</a>
            </div>
            <div className="assure">
              <span><svg className="tick" viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" /></svg>Teste grátis por 24h</span>
              <span><svg className="tick" viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" /></svg>Ativação na hora por PIX</span>
            </div>
          </div>

          <div className="phone" aria-hidden="true">
            <div className="screen">
              <div className="ptop">
                <span className="pdot"><svg viewBox="0 0 24 24"><path d="M2 21l1.6-4A9 9 0 1 1 12 21H2Z" /></svg></span>
                <b>DisparaZap</b>
                <small><span className="blip" />Enviando</small>
              </div>
              <div className="pbody">
                <div className="msg">
                  🔥 Promoção só hoje: 30% OFF em toda a loja!<br />
                  Aproveite antes que acabe 👇<br />
                  <span className="lnk">disparazap.online/r/x8a2</span>
                </div>
                <div className="glist">
                  <div className="grow"><span className="cbx"><Tick /></span>Ofertas do Dia · 836 membros<span className="gst">enviado</span></div>
                  <div className="grow"><span className="cbx"><Tick /></span>Achadinhos SP · 410 membros<span className="gst">enviado</span></div>
                  <div className="grow"><span className="cbx"><Tick /></span>Promo Relâmpago · 191 membros<span className="gst">enviado</span></div>
                  <div className="grow"><span className="cbx off" />Divulgação Livre · 48 membros<span className="gst wait">na fila</span></div>
                </div>
                <div className="prog">
                  <div className="pbar"><div className="pfill" /></div>
                  <div className="pcap"><span>17 de 25 grupos</span><span>68%</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="strip">
        <div className="wrap">
          <span><Tick />Vários grupos por vez</span>
          <span><Tick />Agendamento automático</span>
          <span><Tick />Relatório de cliques</span>
          <span><Tick />Proteção anti-bloqueio</span>
        </div>
      </div>

      <section id="recursos">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Recursos</span>
            <h2>Tudo pra divulgar no WhatsApp sem trabalho manual</h2>
            <p>Pare de copiar e colar mensagem em cada grupo. O DisparaZap faz o envio, agenda e ainda mostra quem clicou.</p>
          </div>
          <div className="grid">
            <div className="card">
              <div className="ic"><svg viewBox="0 0 24 24"><path d="M2 21l1.9-5.7A8 8 0 1 1 8 19.9L2 21Zm7-6h6v-2H9v2Zm0-3h9V10H9v2Z" /></svg></div>
              <h3>Disparo em massa</h3>
              <p>Escolha os grupos e envie o mesmo anúncio para todos de uma vez, ou selecione só os que quiser.</p>
            </div>
            <div className="card">
              <div className="ic"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 10V6h-2v7l5 3 1-1.7-4-2.3Z" /></svg></div>
              <h3>Agendamento diário</h3>
              <p>Programe os disparos pra sair sozinhos nos horários de pico, uma ou três vezes por dia.</p>
            </div>
            <div className="card">
              <div className="ic"><svg viewBox="0 0 24 24"><path d="M3 3v18h18v-2H5V3H3Zm4 12 4-5 3 3 5-6-1.5-1.2L14 10l-3-3-5 6.2L7 15Z" /></svg></div>
              <h3>Relatório de cliques</h3>
              <p>Cada anúncio ganha um link rastreável. Veja quantas pessoas clicaram, de onde e por qual aparelho.</p>
            </div>
            <div className="card">
              <div className="ic"><svg viewBox="0 0 24 24"><path d="M12 1 3 5v6c0 5 3.8 9.7 9 11 5.2-1.3 9-6 9-11V5l-9-4Zm-1 15-4-4 1.4-1.4L11 13.2l4.6-4.6L17 10l-6 6Z" /></svg></div>
              <h3>Proteção anti-bloqueio</h3>
              <p>Envios com intervalo entre grupos e variação automática do texto, pra reduzir o risco de o número ser bloqueado.</p>
            </div>
            <div className="card">
              <div className="ic"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm0 14a7 7 0 0 1-5.6-2.8C6.5 15.3 9 14 12 14s5.5 1.3 5.6 3.2A7 7 0 0 1 12 20Z" /></svg></div>
              <h3>Publicar no Status</h3>
              <p>Marque uma opção e o mesmo anúncio também vai pro seu Status do WhatsApp, junto com o envio aos grupos.</p>
            </div>
            <div className="card">
              <div className="ic"><svg viewBox="0 0 24 24"><path d="M4 4h16v2H4V4Zm0 5h10v2H4V9Zm0 5h16v2H4v-2Zm0 5h10v2H4v-2Z" /></svg></div>
              <h3>Texto e imagem</h3>
              <p>Envie só texto ou imagem com legenda. Salve seus anúncios e reutilize quando quiser.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="como" className="sec-alt">
        <div className="wrap">
          <div className="sec-head center">
            <span className="eyebrow">Como funciona</span>
            <h2>Do cadastro ao primeiro disparo em minutos</h2>
          </div>
          <div className="steps">
            <div className="step"><div className="n">1</div><h3>Crie sua conta</h3><p>Cadastro rápido com e-mail e telefone. Ganhe 24h de teste grátis.</p></div>
            <div className="step"><div className="n">2</div><h3>Conecte o WhatsApp</h3><p>Leia o QR Code com o celular, como no WhatsApp Web. Seus grupos aparecem na hora.</p></div>
            <div className="step"><div className="n">3</div><h3>Monte o anúncio</h3><p>Escreva o texto ou envie uma imagem, e cole o link do que você quer divulgar.</p></div>
            <div className="step"><div className="n">4</div><h3>Dispare ou agende</h3><p>Envie na hora para os grupos escolhidos, ou deixe agendado pra sair sozinho.</p></div>
          </div>
        </div>
      </section>

      <section id="planos">
        <div className="wrap">
          <div className="sec-head center">
            <span className="eyebrow">Planos</span>
            <h2>Escolha o período e libere na hora</h2>
            <p>Pagamento por PIX com ativação imediata. Sem fidelidade.</p>
          </div>
          <div className="plans">
            {plans.map((planId) => {
              const info = PLAN_INFO[planId];
              const feat = planId === 'days_15';
              return (
                <div key={planId} className={feat ? 'plan feat' : 'plan'}>
                  {feat && <span className="tag">Mais vendido</span>}
                  <span className="pe">{info.eyebrow}</span>
                  <h3>{info.name}</h3>
                  <div className="amt">R$ {formatPrice(info.amount)}</div>
                  <div className="per">acesso por {info.days} dias</div>
                  <p className="tl">{info.tagline}</p>
                  <ul>
                    {info.highlights.map((item) => (
                      <li key={item}><Tick />{item}</li>
                    ))}
                  </ul>
                  <button className={feat ? 'btn btn-primary' : 'btn btn-ghost'} onClick={() => setCheckoutPlan(planId)}>
                    {info.cta}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="warn center">O pagamento é vinculado à sua conta. Crie a conta antes de assinar para o acesso ser liberado automaticamente.</p>
        </div>
      </section>

      <section id="faq" className="sec-alt">
        <div className="wrap">
          <div className="sec-head center">
            <span className="eyebrow">Dúvidas</span>
            <h2>Perguntas frequentes</h2>
          </div>
          <div className="faq">
            <details>
              <summary>Como funciona o pagamento?</summary>
              <p>É por PIX. Você escolhe o período, gera o QR Code (ou copia o código), paga no seu banco e o acesso é liberado automaticamente, em geral em menos de 1 minuto.</p>
            </details>
            <details>
              <summary>Corro risco de bloquear meu número?</summary>
              <p>Enviar muita mensagem em pouco tempo sempre tem algum risco no WhatsApp. Por isso o DisparaZap envia com intervalo entre os grupos e varia o texto automaticamente. Mesmo assim, comece devagar e evite exagerar na quantidade de grupos.</p>
            </details>
            <details>
              <summary>Preciso instalar alguma coisa?</summary>
              <p>Não. É tudo pelo navegador. Você conecta o WhatsApp lendo um QR Code com o celular, do mesmo jeito que faz no WhatsApp Web.</p>
            </details>
            <details>
              <summary>Funciona com quais grupos?</summary>
              <p>Com os grupos em que o seu número já participa. Ao conectar, a lista dos seus grupos aparece e você escolhe para quais quer enviar.</p>
            </details>
            <details>
              <summary>Posso testar antes de pagar?</summary>
              <p>Sim. Ao criar a conta você ganha 24 horas de teste grátis para conhecer o sistema antes de escolher um plano.</p>
            </details>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="final">
            <div className="in">
              <h2>Comece a divulgar hoje</h2>
              <p>Crie sua conta grátis, conecte o WhatsApp e faça o primeiro disparo em poucos minutos.</p>
              <Link className="btn btn-gold btn-lg" href="/login">Criar conta grátis</Link>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap foot">
          <div className="brand small"><span className="mark sm"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20Z" /></svg></span>DisparaZap</div>
          <span>© 2026 DisparaZap · disparazap.online</span>
        </div>
        <div className="wrap"><p className="warn">DisparaZap é uma ferramenta independente e não é afiliada ao WhatsApp ou à Meta. Use com responsabilidade e respeite as regras dos grupos.</p></div>
      </footer>

      <CheckoutModal plan={checkoutPlan} onClose={() => setCheckoutPlan(null)} />
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Figtree:wght@400;500;600&display=swap');

.dz{
  --paper:#f2f6f0; --surface:#ffffff; --ink:#0c1a13; --muted:#54655b;
  --line:#e0e9dd; --green:#0f9d4e; --green-deep:#0a7439; --green-soft:#e7f6ec;
  --gold:#f0a01c; --hero-bg:#0a2418; --hero-ink:#eaf5ec; --hero-muted:#a7c4b3;
  --hero-line:rgba(255,255,255,.12); --hero-card:#0f3123; --radius:14px; --maxw:1140px;
  --shadow:0 1px 2px rgba(12,26,19,.06), 0 12px 30px -12px rgba(12,26,19,.18);
  min-height:100vh; background:var(--paper); color:var(--ink);
  font-family:"Figtree",system-ui,-apple-system,Segoe UI,Roboto,sans-serif; font-size:17px; line-height:1.6;
}
@media (prefers-color-scheme:dark){ .dz{
  --paper:#08110c; --surface:#0f1913; --ink:#e9f3eb; --muted:#9db3a6;
  --line:#1d2a21; --green:#2ec16d; --green-deep:#43d17f; --green-soft:#12281b; --gold:#f4b23c; --hero-card:#0d2519;
  --shadow:0 1px 2px rgba(0,0,0,.4), 0 16px 40px -16px rgba(0,0,0,.6);
}}
.dz *{box-sizing:border-box}
.dz h1,.dz h2,.dz h3{font-family:"Bricolage Grotesque","Figtree",sans-serif; line-height:1.05; margin:0; letter-spacing:-.02em}
.dz h1,.dz h2{text-wrap:balance}
.dz p{margin:0}
.dz img{max-width:100%}
.dz .wrap{max-width:var(--maxw); margin:0 auto; padding-inline:20px}
.dz .eyebrow{font-size:13px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:var(--green-deep)}
.dz .btn{display:inline-flex; align-items:center; justify-content:center; gap:8px; font-family:inherit; font-weight:600; font-size:16px; border:none; border-radius:11px; padding:13px 22px; cursor:pointer; text-decoration:none; transition:filter .12s ease, transform .12s ease}
.dz .btn:active{transform:translateY(1px)}
.dz .btn-primary{background:var(--green); color:#fff}
.dz .btn-primary:hover{filter:brightness(1.06)}
.dz .btn-gold{background:var(--gold); color:#241800}
.dz .btn-gold:hover{filter:brightness(1.05)}
.dz .btn-ghost{background:transparent; color:var(--ink); border:1px solid var(--line)}
.dz .btn-lg{padding:16px 28px; font-size:17px}

.dz header{position:sticky; top:0; z-index:20; backdrop-filter:blur(10px); background:color-mix(in srgb, var(--paper) 86%, transparent); border-bottom:1px solid var(--line)}
.dz .nav{display:flex; align-items:center; gap:24px; height:64px}
.dz .brand{display:flex; align-items:center; gap:9px; font-family:"Bricolage Grotesque",sans-serif; font-weight:800; font-size:20px; letter-spacing:-.02em}
.dz .mark{width:30px; height:30px; border-radius:9px; background:var(--green); display:grid; place-items:center; flex:none}
.dz .mark svg{width:17px; height:17px; fill:#fff}
.dz .mark.sm{width:26px; height:26px}
.dz .links{display:flex; gap:22px; margin-left:8px}
.dz .links a{color:var(--muted); text-decoration:none; font-weight:500; font-size:15px}
.dz .links a:hover{color:var(--ink)}
.dz .nav .right{margin-left:auto; display:flex; align-items:center; gap:14px}
.dz .nav .login{color:var(--muted); font-weight:600; font-size:15px; text-decoration:none}
.dz .nav .login:hover{color:var(--ink)}
@media (max-width:760px){ .dz .links{display:none} }

.dz .hero{background:var(--hero-bg); color:var(--hero-ink); position:relative; overflow:hidden}
.dz .hero::before{content:""; position:absolute; inset:0; background:radial-gradient(900px 420px at 82% -10%, rgba(46,193,109,.22), transparent 60%); pointer-events:none}
.dz .hero .wrap{position:relative; display:grid; grid-template-columns:1.05fr .95fr; gap:48px; align-items:center; padding-block:64px}
.dz .hero .eyebrow{color:#7fe0a4}
.dz .hero h1{font-size:clamp(32px,4.6vw,52px); font-weight:800; margin:16px 0 18px}
.dz .hero h1 .hl{color:#5fd98e}
.dz .hero .lead{font-size:18px; color:var(--hero-muted); max-width:32ch}
.dz .hero .cta{display:flex; gap:12px; flex-wrap:wrap; margin-top:26px}
.dz .hero-ghost{color:var(--hero-ink); border-color:var(--hero-line)}
.dz .hero .assure{display:flex; gap:18px; flex-wrap:wrap; margin-top:22px; font-size:14px; color:var(--hero-muted)}
.dz .hero .assure span{display:inline-flex; align-items:center; gap:7px}
.dz .tick{width:16px; height:16px; flex:none; fill:#5fd98e}
@media (max-width:900px){ .dz .hero .wrap{grid-template-columns:1fr; gap:36px; padding-block:46px} }

.dz .phone{justify-self:center; width:300px; max-width:100%; background:var(--hero-card); border:1px solid var(--hero-line); border-radius:28px; padding:14px; box-shadow:0 30px 60px -20px rgba(0,0,0,.55)}
.dz .screen{background:#0b2016; border:1px solid var(--hero-line); border-radius:18px; overflow:hidden}
.dz .ptop{display:flex; align-items:center; gap:9px; padding:12px 14px; background:#0f3123; border-bottom:1px solid var(--hero-line)}
.dz .pdot{width:26px; height:26px; border-radius:8px; background:var(--green); display:grid; place-items:center}
.dz .pdot svg{width:14px; height:14px; fill:#fff}
.dz .ptop b{font-size:14px; color:#eaf5ec}
.dz .ptop small{color:#7fe0a4; font-size:11px; margin-left:auto; display:inline-flex; align-items:center; gap:5px}
.dz .blip{width:7px; height:7px; border-radius:50%; background:#43d17f; animation:dzpulse 1.8s infinite}
@keyframes dzpulse{0%{box-shadow:0 0 0 0 rgba(67,209,127,.5)}70%{box-shadow:0 0 0 7px rgba(67,209,127,0)}100%{box-shadow:0 0 0 0 rgba(67,209,127,0)}}
.dz .pbody{padding:14px}
.dz .msg{background:#12402c; border:1px solid var(--hero-line); border-radius:12px 12px 12px 4px; padding:10px 12px; color:#dff3e4; font-size:13px; line-height:1.5}
.dz .msg .lnk{color:#7fe0a4}
.dz .glist{margin-top:14px; display:flex; flex-direction:column; gap:8px}
.dz .grow{display:flex; align-items:center; gap:10px; font-size:12.5px; color:#cfe6d7}
.dz .grow .gst{margin-left:auto; font-size:11px; color:#7fe0a4; display:inline-flex; align-items:center; gap:4px}
.dz .grow .gst.wait{color:#a7c4b3}
.dz .cbx{width:16px; height:16px; border-radius:5px; background:var(--green); display:grid; place-items:center; flex:none}
.dz .cbx svg{width:10px; height:10px; fill:#06170f}
.dz .cbx.off{background:transparent; border:1.5px solid var(--hero-line)}
.dz .prog{margin-top:14px}
.dz .pbar{height:7px; border-radius:99px; background:rgba(255,255,255,.1); overflow:hidden}
.dz .pfill{height:100%; width:68%; background:linear-gradient(90deg,var(--green),#5fd98e); border-radius:99px}
.dz .pcap{display:flex; justify-content:space-between; font-size:11px; color:#a7c4b3; margin-top:7px; font-variant-numeric:tabular-nums}

.dz .strip{border-bottom:1px solid var(--line); background:var(--surface)}
.dz .strip .wrap{display:flex; flex-wrap:wrap; gap:14px 40px; justify-content:center; padding-block:20px; color:var(--muted); font-weight:600; font-size:15px}
.dz .strip .wrap span{display:inline-flex; align-items:center; gap:8px}
.dz .strip svg{width:16px; height:16px; fill:var(--green)}

.dz section{padding-block:72px}
.dz .sec-alt{background:var(--surface); border-block:1px solid var(--line)}
.dz .sec-head{max-width:620px; margin-bottom:42px}
.dz .sec-head.center{margin-inline:auto; text-align:center}
.dz .sec-head h2{font-size:clamp(27px,3.4vw,38px); font-weight:700; margin:12px 0 14px}
.dz .sec-head p{color:var(--muted); font-size:18px}

.dz .grid{display:grid; grid-template-columns:repeat(3,1fr); gap:18px}
@media (max-width:900px){ .dz .grid{grid-template-columns:repeat(2,1fr)} }
@media (max-width:560px){ .dz .grid{grid-template-columns:1fr} }
.dz .card{background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); padding:24px}
.dz .card .ic{width:42px; height:42px; border-radius:11px; background:var(--green-soft); display:grid; place-items:center; margin-bottom:16px}
.dz .card .ic svg{width:21px; height:21px; fill:var(--green-deep)}
.dz .card h3{font-size:19px; font-weight:700; margin-bottom:7px}
.dz .card p{color:var(--muted); font-size:15.5px}

.dz .steps{display:grid; grid-template-columns:repeat(4,1fr); gap:16px}
@media (max-width:860px){ .dz .steps{grid-template-columns:repeat(2,1fr)} }
@media (max-width:480px){ .dz .steps{grid-template-columns:1fr} }
.dz .step .n{font-family:"Bricolage Grotesque",sans-serif; font-weight:800; font-size:15px; color:var(--green); width:34px; height:34px; border-radius:10px; border:1px solid var(--line); background:var(--surface); display:grid; place-items:center; margin-bottom:14px}
.dz .step h3{font-size:18px; font-weight:700; margin-bottom:6px}
.dz .step p{color:var(--muted); font-size:15px}

.dz .plans{display:grid; grid-template-columns:repeat(4,1fr); gap:16px; align-items:start}
@media (max-width:900px){ .dz .plans{grid-template-columns:repeat(2,1fr)} }
@media (max-width:520px){ .dz .plans{grid-template-columns:1fr} }
.dz .plan{background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:24px; position:relative; display:flex; flex-direction:column}
.dz .plan.feat{border-color:var(--green); box-shadow:var(--shadow)}
.dz .plan .tag{position:absolute; top:-11px; left:50%; transform:translateX(-50%); background:var(--gold); color:#241800; font-size:11px; font-weight:700; padding:4px 10px; border-radius:99px; white-space:nowrap}
.dz .plan .pe{font-size:12px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--green-deep)}
.dz .plan h3{font-family:"Bricolage Grotesque",sans-serif; font-size:22px; font-weight:800; margin:6px 0 8px}
.dz .plan .amt{font-family:"Bricolage Grotesque",sans-serif; font-weight:800; font-size:34px; letter-spacing:-.03em}
.dz .plan .per{font-size:13px; color:var(--muted); margin-top:2px}
.dz .plan .tl{font-size:14px; color:var(--muted); margin:12px 0}
.dz .plan ul{list-style:none; padding:0; margin:0 0 20px; display:flex; flex-direction:column; gap:9px}
.dz .plan li{display:flex; gap:9px; font-size:14px; align-items:flex-start; color:var(--ink)}
.dz .plan li svg{width:16px; height:16px; fill:var(--green); flex:none; margin-top:3px}
.dz .plan .btn{width:100%; margin-top:auto}

.dz .faq{max-width:760px; margin-inline:auto; display:flex; flex-direction:column; gap:12px}
.dz details{background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:4px 20px}
.dz summary{cursor:pointer; font-weight:600; font-size:17px; padding:16px 0; list-style:none; display:flex; justify-content:space-between; align-items:center; gap:16px}
.dz summary::-webkit-details-marker{display:none}
.dz summary::after{content:"+"; font-size:22px; color:var(--green); font-weight:400; transition:transform .2s}
.dz details[open] summary::after{transform:rotate(45deg)}
.dz details p{color:var(--muted); font-size:15.5px; padding:0 0 18px}

.dz .final{background:var(--hero-bg); color:var(--hero-ink); border-radius:22px; text-align:center; padding:58px 28px; position:relative; overflow:hidden}
.dz .final::before{content:""; position:absolute; inset:0; background:radial-gradient(600px 300px at 50% 0%, rgba(46,193,109,.22), transparent 65%)}
.dz .final .in{position:relative}
.dz .final h2{font-size:clamp(27px,3.8vw,40px); font-weight:800; margin-bottom:14px}
.dz .final p{color:var(--hero-muted); font-size:18px; max-width:44ch; margin:0 auto 26px}

.dz footer{border-top:1px solid var(--line); padding-block:32px; color:var(--muted); font-size:14px}
.dz .foot{display:flex; flex-wrap:wrap; gap:14px; align-items:center; justify-content:space-between}
.dz .brand.small{font-size:17px}
.dz .warn{font-size:12.5px; color:var(--muted); max-width:62ch; margin-top:10px}
.dz .warn.center{text-align:center; margin-inline:auto}

@media (prefers-reduced-motion:reduce){ .dz *{animation:none !important; transition:none !important} }
`;
