'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';
import Toggle from './Toggle';
import { api } from '@/lib/api';
import {
  Brain, ShieldCheck, ShieldAlert, ShieldX, Trophy, Ban, Clock, FlaskConical,
  Send, MousePointerClick, Percent, Table2, BarChart3,
} from 'lucide-react';

interface GroupRow {
  groupId: string;
  groupName: string;
  sends: number;
  clicks: number;
  ctr: number;
  clickShare: number;
  dead: boolean;
  lastSentAt: string;
}

interface HourRow { hour: number; sends: number; clicks: number; ctr: number }

interface VariantRow {
  index: number;
  label: string;
  body: string;
  sends: number;
  clicks: number;
  ctr: number;
  ready: boolean;
}

interface Health {
  score: number;
  level: 'baixo' | 'medio' | 'alto';
  sent24h: number;
  failed24h: number;
  sentLastHour: number;
  failureRate: number;
  sessionStatus: string | null;
  sharedNumber: boolean;
  alerts: string[];
  tips: string[];
}

interface Insights {
  days: number;
  smartGroupsEnabled: boolean;
  thresholds: { deadGroupMinSends: number; variantMinSends: number };
  totals: { trackedSends: number; clicks: number; ctr: number; groups: number; deadGroups: number };
  groups: GroupRow[];
  hours: { hours: HourRow[]; best: HourRow | null; worst: HourRow | null };
  variants: VariantRow[];
  health: Health;
}

const MIN_HOUR_SAMPLE = 5;

function pct(value: number) {
  return `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

// Cliques por envio: um envio para um grupo grande pode gerar vários cliques,
// então isso passa de 1 (não é porcentagem).
function perSend(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function relativeDate(iso: string) {
  const diffDays = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diffDays <= 0) return 'hoje';
  if (diffDays === 1) return 'ontem';
  return `há ${diffDays} dias`;
}

const HEALTH_STYLE = {
  baixo: { label: 'Risco baixo', Icon: ShieldCheck, text: 'text-emerald-700', bar: 'bg-emerald-600', chip: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  medio: { label: 'Risco médio', Icon: ShieldAlert, text: 'text-amber-700', bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-900 border-amber-200' },
  alto: { label: 'Risco alto', Icon: ShieldX, text: 'text-red-700', bar: 'bg-red-600', chip: 'bg-red-50 text-red-800 border-red-200' },
} as const;

function HealthCard({ health }: { health: Health }) {
  const style = HEALTH_STYLE[health.level];
  const { Icon } = style;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-800">Saúde do número</h3>
          <p className="text-xs text-gray-500">Risco de bloqueio pelo WhatsApp nas últimas 24h</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${style.chip}`}>
          <Icon className="h-3.5 w-3.5" />
          {style.label}
        </span>
      </div>

      <div className="mt-4 flex items-end gap-2">
        <span className="text-4xl font-black text-gray-900">{health.score}</span>
        <span className="mb-1 text-sm text-gray-500">/ 100</span>
      </div>
      <div
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-100"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={health.score}
        aria-label="Saúde do número"
      >
        <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${health.score}%` }} />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-gray-50 p-2">
          <dt className="text-[11px] text-gray-500">Última hora</dt>
          <dd className="text-sm font-bold text-gray-800">{health.sentLastHour}</dd>
        </div>
        <div className="rounded-xl bg-gray-50 p-2">
          <dt className="text-[11px] text-gray-500">Envios 24h</dt>
          <dd className="text-sm font-bold text-gray-800">{health.sent24h}</dd>
        </div>
        <div className="rounded-xl bg-gray-50 p-2">
          <dt className="text-[11px] text-gray-500">Falhas 24h</dt>
          <dd className="text-sm font-bold text-gray-800">{health.failed24h}</dd>
        </div>
      </dl>

      {health.alerts.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm text-gray-700">
          {health.alerts.map((alert) => (
            <li key={alert} className="flex gap-2">
              <ShieldAlert className={`mt-0.5 h-4 w-4 shrink-0 ${style.text}`} />
              <span>{alert}</span>
            </li>
          ))}
        </ul>
      )}

      {health.sharedNumber && (
        <p className="mt-3 text-xs text-gray-500">
          Você envia pelo número do sistema. O DisparaZap protege o número automaticamente; estes dados mostram só os seus envios.
        </p>
      )}
      <p className="mt-3 text-xs text-gray-500">
        Proteção automática: se 5 envios seguidos falharem, o disparo pausa sozinho.
      </p>
    </div>
  );
}

function HourChart({ hours, best }: { hours: HourRow[]; best: HourRow | null }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const maxCtr = Math.max(...hours.map((h) => (h.sends >= MIN_HOUR_SAMPLE ? h.ctr : 0)), 0.0001);
  const hoveredRow = hovered !== null ? hours[hovered] : null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="mb-1 flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-gray-800">
            <Clock className="h-4 w-4 text-emerald-600" /> Melhor horário para postar
          </h3>
          <p className="text-xs text-gray-500">Cliques por envio, conforme a hora em que o anúncio foi enviado (horário de Brasília)</p>
        </div>
        <button
          onClick={() => setShowTable((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
        >
          {showTable ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
          {showTable ? 'Gráfico' : 'Tabela'}
        </button>
      </div>

      {best && best.clicks > 0 ? (
        <p className="mb-4 text-sm text-gray-700">
          Seus anúncios rendem mais às <strong className="text-gray-900">{best.hour}h</strong> ({perSend(best.ctr)} cliques por envio).
        </p>
      ) : (
        <p className="mb-4 text-sm text-gray-500">
          Ainda faltam dados. Cada horário precisa de pelo menos {MIN_HOUR_SAMPLE} envios para entrar na comparação.
        </p>
      )}

      {showTable ? (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white text-left text-xs text-gray-500">
              <tr><th className="py-1">Hora</th><th className="py-1 text-right">Envios</th><th className="py-1 text-right">Cliques</th><th className="py-1 text-right">Cliques/envio</th></tr>
            </thead>
            <tbody>
              {hours.filter((h) => h.sends > 0).map((h) => (
                <tr key={h.hour} className="border-t border-gray-100">
                  <td className="py-1.5 text-gray-700">{String(h.hour).padStart(2, '0')}h</td>
                  <td className="py-1.5 text-right tabular-nums text-gray-700">{h.sends}</td>
                  <td className="py-1.5 text-right tabular-nums text-gray-700">{h.clicks}</td>
                  <td className="py-1.5 text-right tabular-nums text-gray-900">{perSend(h.ctr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <div className="pointer-events-none absolute -top-1 left-0 right-0 h-6">
            {hoveredRow && (
              <div
                className="absolute -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2 py-1 text-[11px] text-white shadow"
                style={{ left: `${((hoveredRow.hour + 0.5) / 24) * 100}%` }}
              >
                {hoveredRow.hour}h · {hoveredRow.sends} envios · {hoveredRow.clicks} cliques · {perSend(hoveredRow.ctr)} por envio
              </div>
            )}
          </div>
          <div className="flex h-36 items-end gap-[2px] border-b border-gray-200 pt-7" role="img" aria-label="Cliques por envio em cada hora">
            {hours.map((h) => {
              const enough = h.sends >= MIN_HOUR_SAMPLE;
              const isBest = best?.hour === h.hour && best.clicks > 0;
              const height = enough ? Math.max(4, (h.ctr / maxCtr) * 100) : h.sends > 0 ? 4 : 0;
              return (
                <div
                  key={h.hour}
                  className="flex h-full flex-1 cursor-default items-end"
                  onMouseEnter={() => setHovered(h.hour)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div
                    className={`w-full rounded-t-[4px] transition-colors ${
                      isBest ? 'bg-emerald-700' : enough ? 'bg-emerald-300' : 'bg-gray-200'
                    } ${hovered === h.hour ? 'opacity-80' : ''}`}
                    style={{ height: `${height}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex text-[10px] text-gray-400">
            {hours.map((h) => (
              <span key={h.hour} className="flex-1 text-center">{h.hour % 3 === 0 ? `${h.hour}h` : ''}</span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-gray-400">Barras cinzas: menos de {MIN_HOUR_SAMPLE} envios naquele horário.</p>
        </div>
      )}
    </div>
  );
}

function GroupRanking({ groups, minSends }: { groups: GroupRow[]; minSends: number }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? groups : groups.slice(0, 10);
  const maxShare = Math.max(...groups.map((g) => g.clickShare), 0.0001);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="flex items-center gap-2 font-semibold text-gray-800">
        <Trophy className="h-4 w-4 text-emerald-600" /> Ranking de grupos
      </h3>
      <p className="mb-4 text-xs text-gray-500">Quais grupos trazem cliques de verdade. Cada envio leva um link exclusivo do grupo.</p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs text-gray-500">
            <tr>
              <th className="pb-2 font-medium">#</th>
              <th className="pb-2 font-medium">Grupo</th>
              <th className="pb-2 text-right font-medium">Envios</th>
              <th className="pb-2 text-right font-medium">Cliques</th>
              <th className="pb-2 text-right font-medium">Cliques/envio</th>
              <th className="pb-2 pl-4 font-medium">Parte dos cliques</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((g, i) => (
              <tr key={g.groupId} className="border-t border-gray-100">
                <td className="py-2 pr-2 tabular-nums text-gray-400">{i + 1}</td>
                <td className="max-w-[220px] py-2 pr-2">
                  <p className="truncate font-medium text-gray-800">{g.groupName}</p>
                  <p className="text-[11px] text-gray-400">
                    {g.dead ? (
                      <span className="inline-flex items-center gap-1 text-red-700"><Ban className="h-3 w-3" /> sem cliques</span>
                    ) : g.sends < minSends && g.clicks === 0 ? (
                      'testando'
                    ) : (
                      `último envio ${relativeDate(g.lastSentAt)}`
                    )}
                  </p>
                </td>
                <td className="py-2 text-right tabular-nums text-gray-700">{g.sends}</td>
                <td className="py-2 text-right tabular-nums text-gray-700">{g.clicks}</td>
                <td className="py-2 text-right tabular-nums font-semibold text-gray-900">{perSend(g.ctr)}</td>
                <td className="py-2 pl-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-emerald-600" style={{ width: `${(g.clickShare / maxShare) * 100}%` }} />
                    </div>
                    <span className="w-10 text-right text-xs tabular-nums text-gray-600">{pct(g.clickShare)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {groups.length > 10 && (
        <button onClick={() => setShowAll((v) => !v)} className="mt-3 text-sm font-medium text-emerald-700 hover:underline">
          {showAll ? 'Mostrar só os 10 primeiros' : `Ver todos os ${groups.length} grupos`}
        </button>
      )}
    </div>
  );
}

function VariantsCard({ variants, minSends }: { variants: VariantRow[]; minSends: number }) {
  const allReady = variants.length > 1 && variants.every((v) => v.ready);
  const winner = allReady ? variants.reduce((a, b) => (b.ctr > a.ctr ? b : a)) : null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="flex items-center gap-2 font-semibold text-gray-800">
        <FlaskConical className="h-4 w-4 text-emerald-600" /> Teste A/B do anúncio
      </h3>
      {variants.length <= 1 ? (
        <p className="mt-2 text-sm text-gray-600">
          Crie variações do texto na aba <strong>Meus Anúncios</strong> (dá para gerar com IA). O sistema envia versões diferentes e passa a usar a que tem mais cliques.
        </p>
      ) : (
        <>
          <p className="mb-4 text-xs text-gray-500">
            {allReady
              ? 'Todas as versões já foram testadas. A vencedora é enviada na maioria das vezes (80%).'
              : `Cada versão é enviada pelo menos ${minSends} vezes antes de o sistema escolher a melhor.`}
          </p>
          <ul className="space-y-3">
            {variants.map((v) => (
              <li key={v.index} className={`rounded-xl border p-3 ${winner?.index === v.index ? 'border-emerald-300 bg-emerald-50' : 'border-gray-100'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-800">
                    {v.label}
                    {winner?.index === v.index && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                        <Trophy className="h-3 w-3" /> vencendo
                      </span>
                    )}
                  </span>
                  <span className="text-xs tabular-nums text-gray-600">
                    {v.sends} envios · {v.clicks} cliques · <strong className="text-gray-900">{perSend(v.ctr)}</strong> por envio
                    {!v.ready && <span className="text-gray-400"> · testando ({v.sends}/{minSends})</span>}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-gray-500">{v.body}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default function InsightsTab() {
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [savingSmart, setSavingSmart] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getInteligencia(days)
      .then((res) => {
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        setData(res);
      })
      .catch(() => toast.error('Erro ao carregar a inteligência'))
      .finally(() => setLoading(false));
  }, [days]);

  const deadGroups = useMemo(() => (data?.groups || []).filter((g) => g.dead), [data]);

  async function toggleSmart(enabled: boolean) {
    setSavingSmart(true);
    try {
      const res = await api.saveConfiguracoes({ smartGroupsEnabled: enabled });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setData((prev) => (prev ? { ...prev, smartGroupsEnabled: !!res.smartGroupsEnabled } : prev));
      toast.success(enabled ? 'Modo inteligente ativado!' : 'Modo inteligente desativado');
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSavingSmart(false);
    }
  }

  if (loading && !data) return <LoadingSpinner text="Analisando seus envios..." />;
  if (!data) return null;

  const hasData = data.totals.trackedSends > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
            <Brain className="h-5 w-5 text-emerald-600" /> Inteligência
          </h2>
          <p className="text-sm text-gray-500">Descubra quais grupos e horários dão resultado, e deixe o sistema priorizar sozinho.</p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm sm:w-auto"
          aria-label="Período"
        >
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <HealthCard health={data.health} />

        <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-gray-800">Modo inteligente</h3>
              <p className="mt-1 text-sm text-gray-600">
                Envia primeiro para os grupos que mais dão cliques e pula os grupos que receberam {data.thresholds.deadGroupMinSends}+ envios sem nenhum clique.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Toggle
              enabled={data.smartGroupsEnabled}
              onChange={(v) => { if (!savingSmart) toggleSmart(v); }}
              label={data.smartGroupsEnabled ? 'Ativado' : 'Desativado'}
            />
          </div>
          <ul className="mt-4 space-y-1 text-xs text-gray-600">
            <li>• Vale para disparo manual, automático e diário.</li>
            <li>• Grupos novos (nunca testados) continuam recebendo.</li>
            <li>• Se todos os grupos estiverem sem cliques, nenhum é pulado.</li>
          </ul>
          {deadGroups.length > 0 && (
            <p className="mt-4 rounded-xl bg-white/70 p-3 text-sm text-gray-700">
              <strong>{deadGroups.length}</strong> {deadGroups.length === 1 ? 'grupo seria pulado' : 'grupos seriam pulados'} hoje.
            </p>
          )}
        </div>
      </div>

      {!hasData ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <Send className="mx-auto mb-3 h-8 w-8 text-gray-300" />
          <p className="font-semibold text-gray-700">Ainda não há envios com rastreamento por grupo</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
            A partir do próximo disparo, cada grupo recebe um link exclusivo. Em poucos dias aparecem aqui o ranking de grupos e os melhores horários.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: 'Envios rastreados', value: data.totals.trackedSends.toLocaleString('pt-BR'), Icon: Send },
              { label: 'Cliques únicos', value: data.totals.clicks.toLocaleString('pt-BR'), Icon: MousePointerClick },
              { label: 'Cliques por envio', value: perSend(data.totals.ctr), Icon: Percent },
              { label: 'Grupos sem cliques', value: `${data.totals.deadGroups} de ${data.totals.groups}`, Icon: Ban },
            ].map(({ label, value, Icon }) => (
              <div key={label} className="rounded-2xl border border-gray-200 bg-white p-4">
                <Icon className="mb-2 h-4 w-4 text-gray-400" />
                <p className="text-2xl font-black text-gray-900">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            ))}
          </div>

          {deadGroups.length > 0 && !data.smartGroupsEnabled && (
            <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-amber-900">
                <strong>{deadGroups.length} grupos</strong> receberam {data.thresholds.deadGroupMinSends} ou mais envios e não deram nenhum clique. Quer parar de mandar para eles?
              </p>
              <button
                onClick={() => toggleSmart(true)}
                disabled={savingSmart}
                className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-amber-950 hover:bg-amber-400 disabled:opacity-50"
              >
                Ativar modo inteligente
              </button>
            </div>
          )}

          <GroupRanking groups={data.groups} minSends={data.thresholds.deadGroupMinSends} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <HourChart hours={data.hours.hours} best={data.hours.best} />
            <VariantsCard variants={data.variants} minSends={data.thresholds.variantMinSends} />
          </div>
        </>
      )}

      {!hasData && data.variants.length > 1 && (
        <VariantsCard variants={data.variants} minSends={data.thresholds.variantMinSends} />
      )}
    </div>
  );
}
