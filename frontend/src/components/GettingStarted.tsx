'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { CheckCircle2, Circle, ChevronRight, Lightbulb, X, GraduationCap } from 'lucide-react';

const HIDDEN_KEY = 'disparazap_tutorial_hidden';

interface Step {
  id: string;
  title: string;
  description: string;
  done: boolean;
  action?: { label: string; tab: string };
}

interface Props {
  totalSends: number;
  totalClicks: number;
  canManageWhatsApp: boolean;
  onNavigate: (tab: string) => void;
}

function readHidden() {
  try {
    return localStorage.getItem(HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

function writeHidden(hidden: boolean) {
  try {
    if (hidden) localStorage.setItem(HIDDEN_KEY, '1');
    else localStorage.removeItem(HIDDEN_KEY);
  } catch {
    // sem localStorage: o tutorial apenas volta a aparecer
  }
}

export default function GettingStarted({ totalSends, totalClicks, canManageWhatsApp, onNavigate }: Props) {
  const [hidden, setHidden] = useState(false);
  const [hasAd, setHasAd] = useState(false);
  const [whatsConnected, setWhatsConnected] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setHidden(readHidden());

    const loadAds = api.getAds()
      .then((ads) => {
        if (Array.isArray(ads)) {
          setHasAd(ads.some((ad) => (ad.text && ad.text.trim()) || ad.imageUrl));
        }
      })
      .catch(() => {});

    const loadWhats = canManageWhatsApp
      ? api.getWhatsAppStatus()
          .then((res) => setWhatsConnected(res?.status === 'connected'))
          .catch(() => {})
      : Promise.resolve();

    Promise.all([loadAds, loadWhats]).finally(() => setReady(true));
  }, [canManageWhatsApp]);

  const steps: Step[] = [
    canManageWhatsApp
      ? {
          id: 'whatsapp',
          title: 'Conecte seu WhatsApp',
          description: 'Abra a aba WhatsApp e escaneie o QR Code. No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho.',
          done: whatsConnected,
          action: { label: 'Conectar', tab: 'whatsapp' },
        }
      : {
          id: 'whatsapp',
          title: 'WhatsApp pronto',
          description: 'Seus anúncios saem pelo número do DisparaZap. Não precisa configurar nada.',
          done: true,
        },
    {
      id: 'ad',
      title: 'Crie seu anúncio',
      description: 'Escreva o texto da oferta, coloque uma foto (chama mais atenção) e o link para onde o cliente deve ir. Depois clique em "Salvar meus anúncios".',
      done: hasAd,
      action: { label: 'Criar anúncio', tab: 'ads' },
    },
    {
      id: 'send',
      title: 'Escolha os grupos e dispare',
      description: 'Na mesma aba, marque os grupos (ou "Selecionar todos") e clique em "Disparar". Para enviar sozinho, use "Ativar Disparo Automático".',
      done: totalSends > 0,
      action: { label: 'Ir para os grupos', tab: 'ads' },
    },
    {
      id: 'results',
      title: 'Acompanhe os resultados',
      description: 'Na aba Inteligência você vê quais grupos dão mais cliques e o melhor horário para postar. Os cliques aparecem em tempo real.',
      done: totalClicks > 0,
      action: { label: 'Ver resultados', tab: 'insights' },
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  const nextStep = steps.find((s) => !s.done);

  if (!ready) return null;

  if (hidden) {
    return (
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => { writeHidden(false); setHidden(false); }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800"
        >
          <GraduationCap className="h-4 w-4" /> Ver tutorial de como usar
        </button>
      </div>
    );
  }

  return (
    <section className="mb-6 rounded-2xl border border-emerald-200 bg-white p-5 sm:p-6" aria-labelledby="tutorial-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="tutorial-title" className="flex items-center gap-2 text-lg font-bold text-gray-800">
            <GraduationCap className="h-5 w-5 text-emerald-600" />
            {allDone ? 'Tudo pronto! 🎉' : 'Primeiros passos'}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {allDone
              ? 'Você já fez tudo. Agora é manter os disparos e acompanhar os melhores grupos.'
              : `Siga estes passos para começar a divulgar. ${doneCount} de ${steps.length} concluídos.`}
          </p>
        </div>
        <button
          onClick={() => { writeHidden(true); setHidden(true); }}
          className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Esconder tutorial"
          title="Esconder tutorial"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount}>
        <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>

      <ol className="mt-5 space-y-3">
        {steps.map((step, index) => {
          const isNext = step.id === nextStep?.id;
          return (
            <li
              key={step.id}
              className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center ${
                isNext ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'
              }`}
            >
              <div className="flex flex-1 items-start gap-3">
                {step.done ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-label="Concluído" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-gray-300" aria-label="Pendente" />
                )}
                <div>
                  <p className={`font-semibold ${step.done ? 'text-gray-500 line-through decoration-gray-300' : 'text-gray-800'}`}>
                    {index + 1}. {step.title}
                  </p>
                  {!step.done && <p className="mt-1 text-sm text-gray-600">{step.description}</p>}
                </div>
              </div>
              {!step.done && step.action && (
                <button
                  onClick={() => onNavigate(step.action!.tab)}
                  className={`inline-flex shrink-0 items-center justify-center gap-1 rounded-xl px-4 py-2 text-sm font-semibold ${
                    isNext
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {step.action.label} <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-5 flex gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="space-y-1">
          <p><strong>Dicas para vender mais:</strong></p>
          <ul className="list-disc space-y-0.5 pl-4">
            <li>Anúncio com foto recebe mais cliques que só texto.</li>
            <li>Poste nos horários de pico: perto do almoço (11h–12h) e no começo da noite (18h–20h).</li>
            <li>Ative o <strong>modo inteligente</strong> na aba Inteligência para pular grupos que não dão retorno.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
