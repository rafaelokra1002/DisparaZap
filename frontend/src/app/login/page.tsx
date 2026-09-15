'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 13);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, digits.length - 4)}-${digits.slice(digits.length - 4)}`;
  return `+${digits.slice(0, digits.length - 11)} (${digits.slice(-11, -9)}) ${digits.slice(-9, -4)}-${digits.slice(-4)}`;
}

const Check = () => (
  <svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" /></svg>
);

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });

  const goto = (register: boolean) => {
    setIsRegister(register);
    if (typeof document !== 'undefined') {
      document.getElementById('entrar')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let result;
      if (isRegister) {
        if (!form.name.trim()) {
          toast.error('Informe seu nome');
          setLoading(false);
          return;
        }
        if (form.phone.replace(/\D/g, '').length < 10) {
          toast.error('Informe seu telefone com DDD');
          setLoading(false);
          return;
        }
        result = await api.register(form.name, form.email, form.password, form.phone);
      } else {
        result = await api.login(form.email, form.password);
      }

      if (result.error) {
        toast.error(result.error);
        setLoading(false);
        return;
      }

      localStorage.setItem('disparazap_token', result.token);
      localStorage.setItem('disparazap_user', JSON.stringify(result.user));

      if (isRegister && result.user?.isTrialActive) {
        toast.success('Conta criada. Seu acesso de teste por 24 horas já está liberado.');
        router.push('/painel');
      } else if (isRegister && result.user?.requiresPlan) {
        toast.success('Conta criada. Agora escolha um plano para liberar o sistema.');
        router.push('/#planos');
      } else {
        toast.success(isRegister ? 'Conta criada com sucesso!' : 'Login realizado!');
        router.push('/painel');
      }
    } catch (error) {
      toast.error('Erro de conexão com o servidor');
    } finally {
      setLoading(false);
    }
  };

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
            <a href="#precos">Preços</a>
            <a href="#faq">Dúvidas</a>
          </nav>
          <div className="right">
            <button className="login" onClick={() => goto(false)}>Entrar</button>
            <button className="btn btn-primary" onClick={() => goto(true)}>Começar grátis</button>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="wrap">
          <div>
            <span className="eyebrow">Disparo em grupos de WhatsApp</span>
            <h1>Divulgue em <span className="hl">dezenas de grupos</span> com um clique</h1>
            <p className="lead">Monte o anúncio uma vez e envie para todos os seus grupos de WhatsApp, com agendamento automático e relatório de cliques.</p>
            <div className="assure">
              <span><svg className="tick" viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" /></svg>Plano grátis, sem cartão</span>
              <span><svg className="tick" viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" /></svg>Conecta em 1 minuto</span>
            </div>
          </div>

          <div className="authcard" id="entrar">
            <div className="tabs">
              <button type="button" className={!isRegister ? 'on' : ''} onClick={() => setIsRegister(false)}>Entrar</button>
              <button type="button" className={isRegister ? 'on' : ''} onClick={() => setIsRegister(true)}>Criar conta</button>
            </div>

            <form onSubmit={handleSubmit}>
              {isRegister && (
                <label className="fld">
                  <span>Nome</span>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Seu nome" />
                </label>
              )}
              {isRegister && (
                <label className="fld">
                  <span>Telefone</span>
                  <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhoneInput(e.target.value) })} placeholder="(11) 99999-9999" required={isRegister} />
                </label>
              )}
              <label className="fld">
                <span>E-mail</span>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="seu@email.com" required />
              </label>
              <label className="fld">
                <span>Senha</span>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••" required minLength={6} />
              </label>

              <button type="submit" className="btn btn-gold submit" disabled={loading}>
                {loading ? 'Aguarde...' : isRegister ? 'Criar conta grátis' : 'Entrar'}
              </button>
            </form>

            <p className="switch">
              {isRegister ? 'Já tem uma conta?' : 'Ainda não tem conta?'}{' '}
              <button type="button" onClick={() => setIsRegister(!isRegister)}>
                {isRegister ? 'Fazer login' : 'Criar grátis'}
              </button>
            </p>
          </div>
        </div>
      </section>

      <div className="strip">
        <div className="wrap">
          <span><Check />Vários grupos por vez</span>
          <span><Check />Agendamento automático</span>
          <span><Check />Relatório de cliques</span>
          <span><Check />Proteção anti-bloqueio</span>
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
            <div className="step"><div className="n">1</div><h3>Crie sua conta</h3><p>Cadastro rápido com e-mail e telefone. Comece no plano grátis, sem cartão.</p></div>
            <div className="step"><div className="n">2</div><h3>Conecte o WhatsApp</h3><p>Leia o QR Code com o celular, como no WhatsApp Web. Seus grupos aparecem na hora.</p></div>
            <div className="step"><div className="n">3</div><h3>Monte o anúncio</h3><p>Escreva o texto ou envie uma imagem, e cole o link do que você quer divulgar.</p></div>
            <div className="step"><div className="n">4</div><h3>Dispare ou agende</h3><p>Envie na hora para os grupos escolhidos, ou deixe agendado pra sair sozinho.</p></div>
          </div>
        </div>
      </section>

      <section id="precos">
        <div className="wrap">
          <div className="sec-head center">
            <span className="eyebrow">Preços</span>
            <h2>Comece grátis, cresça quando precisar</h2>
            <p>Sem fidelidade. Cancele quando quiser.</p>
          </div>
          <div className="prices">
            <div className="price">
              <h3>Grátis</h3>
              <div className="amt">R$ 0<small> /sempre</small></div>
              <p className="desc">Pra testar e divulgar no dia a dia.</p>
              <ul>
                <li><Check />Até 150 envios por dia</li>
                <li><Check />Disparo manual para grupos</li>
                <li><Check />Relatório de cliques</li>
                <li><Check />Proteção anti-bloqueio</li>
              </ul>
              <button className="btn btn-ghost" onClick={() => goto(true)}>Criar conta grátis</button>
            </div>
            <div className="price feat">
              <span className="tag">Mais popular</span>
              <h3>Pro</h3>
              <div className="amt">R$ 47<small> /mês</small></div>
              <p className="desc">Pra quem divulga todo dia e quer no automático.</p>
              <ul>
                <li><Check />Envios ilimitados</li>
                <li><Check />Agendamento diário automático</li>
                <li><Check />Publicar no Status</li>
                <li><Check />Relatórios completos</li>
                <li><Check />Suporte prioritário</li>
              </ul>
              <button className="btn btn-primary" onClick={() => goto(true)}>Assinar o Pro</button>
            </div>
          </div>
          <p className="warn center">Valores de exemplo. Ajuste os preços e limites para o seu negócio.</p>
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
              <summary>Consigo ver quem clicou nos meus anúncios?</summary>
              <p>Sim. Cada anúncio recebe um link próprio de rastreamento. No painel você vê o total de cliques e dados como país e tipo de aparelho.</p>
            </details>
            <details>
              <summary>Posso cancelar quando quiser?</summary>
              <p>Sim. Não tem fidelidade. Você pode usar o plano grátis pelo tempo que quiser e assinar o Pro só quando precisar de mais.</p>
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
              <button className="btn btn-gold btn-lg" onClick={() => goto(true)}>Criar conta grátis</button>
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
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Figtree:wght@400;500;600&display=swap');

.dz{
  --paper:#f2f6f0; --surface:#ffffff; --ink:#0c1a13; --muted:#54655b;
  --line:#e0e9dd; --green:#0f9d4e; --green-deep:#0a7439; --green-soft:#e7f6ec;
  --gold:#f0a01c; --hero-bg:#0a2418; --hero-ink:#eaf5ec; --hero-muted:#a7c4b3;
  --hero-line:rgba(255,255,255,.12); --radius:14px; --maxw:1140px;
  --shadow:0 1px 2px rgba(12,26,19,.06), 0 12px 30px -12px rgba(12,26,19,.18);
  min-height:100vh; background:var(--paper); color:var(--ink);
  font-family:"Figtree",system-ui,-apple-system,Segoe UI,Roboto,sans-serif; font-size:17px; line-height:1.6;
}
@media (prefers-color-scheme:dark){ .dz{
  --paper:#08110c; --surface:#0f1913; --ink:#e9f3eb; --muted:#9db3a6;
  --line:#1d2a21; --green:#2ec16d; --green-deep:#43d17f; --green-soft:#12281b; --gold:#f4b23c;
  --shadow:0 1px 2px rgba(0,0,0,.4), 0 16px 40px -16px rgba(0,0,0,.6);
}}
.dz *{box-sizing:border-box}
.dz h1,.dz h2,.dz h3{font-family:"Bricolage Grotesque","Figtree",sans-serif; line-height:1.05; margin:0; letter-spacing:-.02em}
.dz h1,.dz h2{text-wrap:balance}
.dz p{margin:0}
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
.dz .nav .login{background:none; border:none; cursor:pointer; color:var(--muted); font-weight:600; font-size:15px; font-family:inherit}
.dz .nav .login:hover{color:var(--ink)}
@media (max-width:760px){ .dz .links{display:none} }

.dz .hero{background:var(--hero-bg); color:var(--hero-ink); position:relative; overflow:hidden}
.dz .hero::before{content:""; position:absolute; inset:0; background:radial-gradient(900px 420px at 82% -10%, rgba(46,193,109,.22), transparent 60%); pointer-events:none}
.dz .hero .wrap{position:relative; display:grid; grid-template-columns:1.02fr .98fr; gap:48px; align-items:center; padding-block:64px}
.dz .hero .eyebrow{color:#7fe0a4}
.dz .hero h1{font-size:clamp(32px,4.6vw,52px); font-weight:800; margin:16px 0 18px}
.dz .hero h1 .hl{color:#5fd98e}
.dz .hero .lead{font-size:18px; color:var(--hero-muted); max-width:32ch}
.dz .hero .assure{display:flex; gap:18px; flex-wrap:wrap; margin-top:22px; font-size:14px; color:var(--hero-muted)}
.dz .hero .assure span{display:inline-flex; align-items:center; gap:7px}
.dz .tick{width:16px; height:16px; flex:none; fill:#5fd98e}
@media (max-width:900px){ .dz .hero .wrap{grid-template-columns:1fr; gap:32px; padding-block:44px} }

.dz .authcard{background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:26px; box-shadow:0 30px 60px -22px rgba(0,0,0,.5); color:var(--ink)}
.dz .tabs{display:grid; grid-template-columns:1fr 1fr; gap:6px; background:var(--paper); border:1px solid var(--line); border-radius:12px; padding:5px; margin-bottom:20px}
.dz .tabs button{border:none; background:none; font-family:inherit; font-weight:600; font-size:15px; padding:9px; border-radius:8px; cursor:pointer; color:var(--muted)}
.dz .tabs button.on{background:var(--green); color:#fff}
.dz .fld{display:block; margin-bottom:13px}
.dz .fld span{display:block; font-size:13px; font-weight:600; color:var(--muted); margin-bottom:5px}
.dz .fld input{width:100%; padding:12px 14px; font-size:15px; font-family:inherit; color:var(--ink); background:var(--paper); border:1px solid var(--line); border-radius:10px; outline:none}
.dz .fld input:focus{border-color:var(--green); box-shadow:0 0 0 3px rgba(15,157,78,.15)}
.dz .authcard .submit{width:100%; margin-top:8px}
.dz .authcard .submit:disabled{opacity:.6; cursor:default}
.dz .switch{text-align:center; font-size:14px; color:var(--muted); margin-top:16px}
.dz .switch button{background:none; border:none; cursor:pointer; font-family:inherit; font-size:14px; font-weight:700; color:var(--green-deep)}

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

.dz .prices{display:grid; grid-template-columns:repeat(2,1fr); gap:20px; max-width:820px; margin-inline:auto; align-items:start}
@media (max-width:640px){ .dz .prices{grid-template-columns:1fr} }
.dz .price{background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:30px}
.dz .price.feat{border-color:var(--green); box-shadow:var(--shadow); position:relative}
.dz .price .tag{position:absolute; top:-12px; right:22px; background:var(--gold); color:#241800; font-size:12px; font-weight:700; padding:5px 11px; border-radius:99px}
.dz .price h3{font-size:18px; font-weight:700}
.dz .price .amt{font-family:"Bricolage Grotesque",sans-serif; font-weight:800; font-size:44px; margin:10px 0 2px; letter-spacing:-.03em}
.dz .price .amt small{font-size:16px; font-weight:600; color:var(--muted); font-family:"Figtree"}
.dz .price .desc{color:var(--muted); font-size:15px; margin-bottom:20px}
.dz .price ul{list-style:none; padding:0; margin:0 0 24px; display:flex; flex-direction:column; gap:11px}
.dz .price li{display:flex; gap:10px; font-size:15.5px; align-items:flex-start}
.dz .price li svg{width:18px; height:18px; fill:var(--green); flex:none; margin-top:3px}
.dz .price .btn{width:100%}

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
