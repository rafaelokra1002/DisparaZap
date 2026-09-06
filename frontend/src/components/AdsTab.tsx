'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import Toggle from './Toggle';
import WhatsAppPreview from './WhatsAppPreview';
import LoadingSpinner from './LoadingSpinner';
import { api } from '@/lib/api';
import { Save, Send, Upload, Image as ImageIcon, Clock, StopCircle, RefreshCw, Users, Calendar, Zap } from 'lucide-react';

function normalizeUrl(url: string) {
  const trimmed = url.trim();

  if (!trimmed) {
    return '';
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(withProtocol).toString();
  } catch {
    return '';
  }
}

function extractFirstUrl(...contents: string[]) {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/i;

  for (const content of contents) {
    const match = content.match(urlRegex);
    if (!match?.[0]) {
      continue;
    }

    const normalized = normalizeUrl(match[0]);
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

const INTERVAL_OPTIONS = [
  { value: 3, label: '3 minutos (recomendado)' },
  { value: 20, label: '20 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: 120, label: '2 horas' },
  { value: 180, label: '3 horas' },
  { value: 240, label: '4 horas' },
  { value: 360, label: '6 horas' },
  { value: 720, label: '12 horas' },
  { value: 1440, label: '24 horas' },
];

export default function AdsTab() {
  // Estado do Passo 1 - Texto
  const [text, setText] = useState('');
  const [textActive, setTextActive] = useState(false);

  // Estado do Passo 2 - Foto + Legenda
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [captionActive, setCaptionActive] = useState(false);

  // Estado do Passo 3 - Upload
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados gerais
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [savedAdId, setSavedAdId] = useState<string | null>(null);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState('');

  // Agendamento (por intervalo)
  const [intervalMinutes, setIntervalMinutes] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('scheduleIntervalMinutes');
      return saved ? parseInt(saved, 10) : 3;
    } catch { return 3; }
  });
  const [scheduleActive, setScheduleActive] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleRemaining, setScheduleRemaining] = useState(0);
  const [scheduleTotal, setScheduleTotal] = useState(0);

  // Agendamento Diário
  const [dailyActive, setDailyActive] = useState(false);
  const [dailyMode, setDailyMode] = useState<'single' | 'triple'>('single');
  const [dailyStartHour, setDailyStartHour] = useState(8);
  const [dailyInterval, setDailyInterval] = useState(3);
  const [dailySentToday, setDailySentToday] = useState(0);
  const [dailyLoading, setDailyLoading] = useState(false);

  // Limite diário
  const [dailyLimit, setDailyLimit] = useState<number | null>(150);
  const [dailyUsed, setDailyUsed] = useState(0);
  const [isUnlimitedPlan, setIsUnlimitedPlan] = useState(false);

  // Seleção de grupos
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupLoadError, setGroupLoadError] = useState('');
  const [usesDedicatedWhatsApp, setUsesDedicatedWhatsApp] = useState(false);
  const [sendToAll, setSendToAll] = useState(true);
  const [postStatus, setPostStatus] = useState<boolean>(() => {
    try {
      return localStorage.getItem('postStatus') === 'true';
    } catch { return false; }
  });

  // Carregar último anúncio salvo, agendamento e grupos ao montar
  useEffect(() => {
    api.getAds().then((ads: any[]) => {
      if (ads && ads.length > 0) {
        const ad = ads[0]; // mais recente
        setSavedAdId(ad.id);
        setTrackingId(ad.trackingId || null);
        setText(ad.text || '');
        setTextActive(ad.textActive || false);
        setCaption(ad.caption || '');
        setImageUrl(ad.imageUrl || '');
        setCaptionActive(ad.captionActive || false);
        setTargetUrl(ad.targetUrl || '');
      }
    }).catch(() => {});

    api.getAgendamento().then(data => {
      setScheduleActive(data.active || false);
      if (data.active) {
        const mins = data.intervalMinutes || 3;
        setIntervalMinutes(mins);
        try { localStorage.setItem('scheduleIntervalMinutes', String(mins)); } catch {}
        setScheduleRemaining(data.remaining || 0);
        setScheduleTotal(data.total || 0);
      }
    }).catch(() => {});

    api.getLimiteDiario().then(data => {
      setDailyLimit(data.limit ?? null);
      setDailyUsed(data.used || 0);
      setIsUnlimitedPlan(!!data.isUnlimited);
    }).catch(() => {});

    api.getStatusDiario().then(data => {
      setDailyActive(data.active || false);
      if (data.active) {
        setDailyMode((data.scheduleMode === 'triple' ? 'triple' : 'single') as 'single' | 'triple');
        setDailyStartHour(data.startHour || 8);
        setDailyInterval(data.intervalMinutes || 3);
        setDailySentToday(data.sentToday || 0);
      }
    }).catch(() => {});

    api.getMe().then((me) => {
      const dedicated = !!me?.usesDedicatedWhatsApp;
      setUsesDedicatedWhatsApp(dedicated);
      loadGroups(dedicated);
    }).catch(() => {
      loadGroups(false);
    });
  }, []);

  // Polling para atualizar progresso do agendamento
  useEffect(() => {
    if (!scheduleActive) return;
    const interval = setInterval(async () => {
      try {
        const data = await api.getAgendamento();
        if (!data.active) {
          setScheduleActive(false);
          clearInterval(interval);
          return;
        }
        setIntervalMinutes(data.intervalMinutes || 3);
        setScheduleRemaining(data.remaining || 0);
        setScheduleTotal(data.total || 0);
      } catch {}
    }, 15000);
    return () => clearInterval(interval);
  }, [scheduleActive]);

  async function loadGroups(dedicated = usesDedicatedWhatsApp) {
    setLoadingGroups(true);
    setGroupLoadError('');

    try {
      const data = dedicated
        ? await api.getWhatsAppGroups()
        : await api.getGrupos();

      if (data.groups) {
        setGroups(data.groups);
      } else {
        setGroups([]);
      }
      if (data?.error) {
        setGroupLoadError(data.error);
      }
    } catch (error: any) {
      setGroups([]);
      setGroupLoadError(error?.message || 'Conecte seu WhatsApp para carregar os grupos.');
    } finally {
      setLoadingGroups(false);
    }
  }

  function toggleGroup(groupId: string) {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  }

  function selectAllGroups() {
    setSelectedGroups(groups.map(g => g.id));
  }

  function deselectAllGroups() {
    setSelectedGroups([]);
  }

  const resolvedTargetUrl = normalizeUrl(targetUrl) || extractFirstUrl(text, caption);
  const trackingBaseUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const trackingLink = trackingId && trackingBaseUrl ? `${trackingBaseUrl}/r/${trackingId}` : '';
  const dailyLimitValue = dailyLimit ?? 150;
  const dailyUsagePercent = Math.min((dailyUsed / dailyLimitValue) * 100, 100);

  // Salvar anúncio
  async function handleSave() {
    if (!text && !caption && !imageUrl) {
      toast.error('Preencha ao menos um campo do anúncio');
      return;
    }

    setSaving(true);
    try {
      if (savedAdId) {
        const ad = await api.updateAd(savedAdId, {
          text,
          textActive,
          caption,
          imageUrl,
          captionActive,
          targetUrl,
        });
        setTrackingId(ad.trackingId || trackingId);
        setTargetUrl(ad.targetUrl || '');
        toast.success('Anúncio atualizado com sucesso!');
      } else {
        const ad = await api.createAd({
          text,
          textActive,
          caption,
          imageUrl,
          captionActive,
          targetUrl,
        });
        setSavedAdId(ad.id);
        setTrackingId(ad.trackingId || null);
        setTargetUrl(ad.targetUrl || '');
        toast.success('Anúncio salvo com sucesso!');
      }
    } catch (error) {
      toast.error('Erro ao salvar anúncio');
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  // Disparar
  async function handleSend() {
    if (!savedAdId) {
      toast.error('Salve o anúncio primeiro!');
      return;
    }

    if (!sendToAll && selectedGroups.length === 0) {
      toast.error('Selecione pelo menos um grupo!');
      return;
    }

    setSending(true);
    try {
      const groupIds = sendToAll ? [] : [...selectedGroups];
      const result = await api.disparar(savedAdId, {
        sendToAll,
        groupIds,
        postStatus,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${result.totalGroups} grupos na fila de envio!${postStatus ? ' Publicando no status...' : ''}`);
        api.getLimiteDiario().then(data => {
          setDailyLimit(data.limit ?? null);
          setDailyUsed(data.used || 0);
          setIsUnlimitedPlan(!!data.isUnlimited);
        }).catch(() => {});
      }
    } catch (error) {
      toast.error('Erro ao disparar mensagens');
      console.error(error);
    } finally {
      setSending(false);
    }
  }

  // Upload de imagem
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setUploading(true);
    try {
      const result = await api.uploadImage(file);
      if (result.imageUrl) {
        setImageUrl(result.imageUrl);
        toast.success('Imagem enviada com sucesso!');
      } else {
        toast.error('Erro ao fazer upload');
      }
    } catch (error) {
      toast.error('Erro ao fazer upload da imagem');
      console.error(error);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Formulário */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold text-gray-800">Meus Anúncios</h2>

        {/* PASSO 1 - Texto */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-semibold text-gray-700">
              <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs mr-2">
                Passo 1
              </span>
              Texto do Anúncio
            </h3>
            <Toggle
              enabled={textActive}
              onChange={setTextActive}
              label="Ativar envio"
            />
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Digite o texto do seu anúncio aqui...&#10;&#10;Exemplo: 🔥 Promoção imperdível! Acesse agora!"
            className="w-full h-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            maxLength={4000}
          />
          <p className="text-xs text-gray-400 mt-1">{text.length}/4000 caracteres</p>
        </div>

        {/* PASSO 2 - Foto + Legenda */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-semibold text-gray-700">
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs mr-2">
                Passo 2
              </span>
              Foto + Legenda
            </h3>
            <Toggle
              enabled={captionActive}
              onChange={setCaptionActive}
              label="Ativar envio"
            />
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 font-medium">Legenda da imagem</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Digite a legenda da imagem..."
                className="w-full h-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none mt-1"
                maxLength={1000}
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 font-medium">URL da imagem</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://exemplo.com/imagem.jpg"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent mt-1"
              />
            </div>
          </div>
        </div>

        {/* PASSO 3 - Upload (Opcional) */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-700 mb-3">
            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs mr-2">
              Passo 3
            </span>
            Upload de Imagem <span className="text-xs text-gray-400">(opcional)</span>
          </h3>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition text-sm disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Escolher imagem
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleUpload}
              className="hidden"
            />
            {imageUrl && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <ImageIcon className="w-3 h-3" /> Imagem carregada
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Formatos: JPG, PNG, GIF, WebP. Máximo 5MB.
          </p>
        </div>

        {/* URL de destino (para rastreamento) */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-700 mb-3">
            🔗 URL de Destino <span className="text-xs text-gray-400">(para rastreamento de cliques)</span>
          </h3>
          <input
            type="url"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://seu-site.com/oferta"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />

          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <p className="font-semibold text-emerald-800">Destino final do clique</p>
            {resolvedTargetUrl ? (
              <>
                <p className="mt-2 break-all text-gray-700">{resolvedTargetUrl}</p>
                {!targetUrl.trim() && (
                  <p className="mt-2 text-xs text-emerald-700">
                    Como a URL de destino está vazia, o sistema vai usar automaticamente o primeiro link encontrado no texto ou na legenda.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-amber-700">
                Nenhuma URL válida foi encontrada ainda. Preencha a URL de destino ou coloque um link no texto/legenda antes de disparar.
              </p>
            )}

            {trackingLink && (
              <div className="mt-4 border-t border-emerald-200 pt-4">
                <p className="font-semibold text-emerald-800">Link rastreado que será enviado</p>
                <p className="mt-2 break-all text-gray-700">{trackingLink}</p>
              </div>
            )}
          </div>
        </div>

        {/* SELEÇÃO DE GRUPOS */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-500" />
              Grupos para envio
            </h3>
            <button
              onClick={() => loadGroups()}
              disabled={loadingGroups}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              <RefreshCw className={`w-3 h-3 ${loadingGroups ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>

          {/* Toggle todos/selecionar */}
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => { setSendToAll(true); setSelectedGroups([]); }}
              className={`flex-1 py-2 text-sm rounded-lg font-medium transition ${
                sendToAll
                  ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                  : 'bg-gray-50 text-gray-500 border-2 border-transparent hover:bg-gray-100'
              }`}
            >
              Todos os grupos
            </button>
            <button
              onClick={() => setSendToAll(false)}
              className={`flex-1 py-2 text-sm rounded-lg font-medium transition ${
                !sendToAll
                  ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                  : 'bg-gray-50 text-gray-500 border-2 border-transparent hover:bg-gray-100'
              }`}
            >
              Escolher grupos
            </button>
          </div>

          {!sendToAll && (
            <>
              {groups.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-sm">
                  {loadingGroups ? (
                    <p>Carregando grupos...</p>
                  ) : (
                    <p>{groupLoadError || 'Nenhum grupo encontrado. Conecte seu WhatsApp primeiro.'}</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs text-gray-500">
                      {selectedGroups.length} de {groups.length} selecionados
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={selectAllGroups}
                        className="text-xs text-emerald-600 hover:underline"
                      >
                        Selecionar todos
                      </button>
                      <button
                        onClick={deselectAllGroups}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-100 rounded-lg p-2">
                    {groups.map((group: any) => (
                      <label
                        key={group.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition ${
                          selectedGroups.includes(group.id)
                            ? 'bg-emerald-50 border border-emerald-200'
                            : 'hover:bg-gray-50 border border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedGroups.includes(group.id)}
                          onChange={() => toggleGroup(group.id)}
                          className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-700 truncate">{group.name}</p>
                          <p className="text-xs text-gray-400">{group.participants || 0} participantes</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Publicar no Status do WhatsApp */}
        <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={postStatus}
            onChange={(e) => {
              setPostStatus(e.target.checked);
              try { localStorage.setItem('postStatus', String(e.target.checked)); } catch {}
            }}
            className="mt-1 h-4 w-4 accent-emerald-600"
          />
          <span className="text-sm text-gray-700">
            <span className="font-medium">Publicar também no meu Status do WhatsApp</span>
            <span className="block text-xs text-gray-500">
              Posta o mesmo anúncio no seu Status (visível para seus contatos), além do envio aos grupos.
            </span>
          </span>
        </label>

        {/* Botões de ação */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl hover:bg-emerald-700 transition font-medium disabled:opacity-50"
          >
            {saving ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Salvando...' : 'Salvar meus anúncios'}
          </button>

          <button
            onClick={handleSend}
            disabled={sending || !savedAdId}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-white transition font-medium hover:bg-blue-700 disabled:opacity-50 sm:px-6"
          >
            {sending ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <Send className="w-4 h-4" />
            )}
            {sending ? 'Enviando...' : sendToAll ? 'Disparar Todos' : `Disparar (${selectedGroups.length})`}
          </button>
        </div>

        {savedAdId && (
          <p className="text-xs text-green-600 text-center">
            ✅ Anúncio salvo! ID: {savedAdId.slice(0, 8)}...
          </p>
        )}

        {/* LIMITE DIÁRIO */}
        {!isUnlimitedPlan ? (
          <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
            <div className="p-5 sm:p-6">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[15px] font-semibold text-teal-800">Limite diário em grupos (conta grátis)</p>
                </div>
                <Link
                  href="/#planos"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-4 py-3 text-sm font-bold text-amber-950 shadow-[0_10px_25px_rgba(245,158,11,0.35)] transition hover:bg-amber-300 sm:w-auto"
                >
                  <Zap className="h-4 w-4" />
                  Turbinar
                </Link>
              </div>

              <p className="mb-4 text-[18px] font-bold text-slate-800">
                {dailyUsed} de {dailyLimitValue} disparos usados hoje
              </p>

              <div className="mb-4 h-4 overflow-hidden rounded-full bg-red-100">
                <div
                  className="h-full rounded-full bg-red-600 transition-all"
                  style={{ width: `${dailyUsagePercent}%` }}
                />
              </div>

              <p className="text-sm leading-6 text-slate-600">
                Contagem no horário de <span className="font-semibold text-slate-800">Brasília</span> (meia-noite reinicia o limite).{' '}
                <span className="font-semibold text-slate-800">Turbinar</span> libera os planos de <span className="font-semibold text-slate-800">3</span>,{' '}
                <span className="font-semibold text-slate-800">7</span>, <span className="font-semibold text-slate-800">15</span> e{' '}
                <span className="font-semibold text-slate-800">30 dias</span> com disparos ilimitados nos grupos e mais recursos.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border-2 border-blue-200 p-4 mb-4">
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
                🛡️ Proteção Anti-Ban
              </h3>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                {dailyUsed} hoje · Ilimitado
              </span>
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <p>✅ Variação automática no texto de cada envio</p>
              <p>✅ Intervalo de 3 min entre grupos (manual)</p>
              <p>✅ Plano pago com envios ilimitados</p>
            </div>
          </div>
        )}

        {/* AGENDAMENTO */}
        <div className="bg-white rounded-xl border-2 border-orange-200 p-5">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-500" />
            Agendamento Automático
          </h3>

          {scheduleActive ? (
            <div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
                <p className="text-sm text-orange-700 font-medium">
                  ⏰ Disparo automático ATIVO — 1 grupo a cada {intervalMinutes} min
                </p>
                <p className="text-xs text-orange-500 mt-1">
                  {scheduleTotal - scheduleRemaining} de {scheduleTotal} grupos enviados neste ciclo — restam {scheduleRemaining}
                </p>
                <p className="text-xs text-orange-500 mt-1">
                  Ao concluir todos os grupos, o disparo reinicia automaticamente do primeiro grupo.
                </p>
                {scheduleTotal > 0 && (
                  <div className="mt-2 w-full bg-orange-200 rounded-full h-2">
                    <div
                      className="bg-orange-500 h-2 rounded-full transition-all"
                      style={{ width: `${((scheduleTotal - scheduleRemaining) / scheduleTotal) * 100}%` }}
                    />
                  </div>
                )}
              </div>
              <button
                onClick={async () => {
                  setScheduling(true);
                  try {
                    await api.pararAgendamento();
                    setScheduleActive(false);
                    toast.success('Agendamento parado!');
                  } catch {
                    toast.error('Erro ao parar agendamento');
                  } finally {
                    setScheduling(false);
                  }
                }}
                disabled={scheduling}
                className="w-full flex items-center justify-center gap-2 bg-red-600 text-white py-3 rounded-xl hover:bg-red-700 transition font-medium disabled:opacity-50"
              >
                <StopCircle className="w-4 h-4" />
                {scheduling ? 'Parando...' : 'Parar Agendamento'}
              </button>
            </div>
          ) : (
            <div>
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <label className="text-sm text-gray-600">Enviar a cada:</label>
                <select
                  value={intervalMinutes}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setIntervalMinutes(val);
                    try { localStorage.setItem('scheduleIntervalMinutes', String(val)); } catch {}
                  }}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  {INTERVAL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={async () => {
                  if (!savedAdId) {
                    toast.error('Salve o anúncio primeiro!');
                    return;
                  }
                  setScheduling(true);
                  try {
                    if (!sendToAll && selectedGroups.length === 0) {
                      toast.error('Selecione pelo menos um grupo!');
                      return;
                    }

                    const result = await api.agendarDisparo(savedAdId, intervalMinutes, {
                      sendToAll,
                      groupIds: sendToAll ? [] : [...selectedGroups],
                    });
                    if (result.error) {
                      toast.error(result.error);
                    } else {
                      const data = await api.getAgendamento();
                      const resolvedInterval = result.intervalMinutes || intervalMinutes;
                      setIntervalMinutes(resolvedInterval);
                      setScheduleActive(!!data.active);
                      setScheduleRemaining(data.remaining || 0);
                      setScheduleTotal(data.total || 0);
                      try { localStorage.setItem('scheduleIntervalMinutes', String(resolvedInterval)); } catch {}
                      toast.success(`Disparo agendado a cada ${resolvedInterval} minutos!`);
                    }
                  } catch {
                    toast.error('Erro ao agendar disparo');
                  } finally {
                    setScheduling(false);
                  }
                }}
                disabled={scheduling || !savedAdId}
                className="w-full flex items-center justify-center gap-2 bg-orange-500 text-white py-3 rounded-xl hover:bg-orange-600 transition font-medium disabled:opacity-50"
              >
                <Clock className="w-4 h-4" />
                {scheduling ? 'Agendando...' : 'Ativar Disparo Automático'}
              </button>
            </div>
          )}
        </div>

        {/* AGENDAMENTO DIÁRIO */}
        <div className="bg-white rounded-xl border-2 border-green-200 p-5">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-green-500" />
            Disparo Diário Automático
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Envia para todos os grupos todos os dias no horário configurado. Sobrevive a reinícios do servidor.
          </p>

          {dailyActive ? (
            <div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                {dailyMode === 'triple' ? (
                  <p className="text-sm text-green-700 font-medium">
                    📅 Disparo diário ATIVO — 3x ao dia: <strong>8h, 12h e 19h</strong>
                  </p>
                ) : (
                  <p className="text-sm text-green-700 font-medium">
                    📅 Disparo diário ATIVO — Todos os dias às {dailyStartHour}h
                  </p>
                )}
                <p className="text-xs text-green-500 mt-1">
                  Intervalo entre grupos: {dailyInterval} min — Enviados hoje: {dailySentToday}
                </p>
              </div>
              <button
                onClick={async () => {
                  setDailyLoading(true);
                  try {
                    await api.desativarDiario();
                    setDailyActive(false);
                    setDailySentToday(0);
                    toast.success('Agendamento diário desativado!');
                  } catch {
                    toast.error('Erro ao desativar');
                  } finally {
                    setDailyLoading(false);
                  }
                }}
                disabled={dailyLoading}
                className="w-full flex items-center justify-center gap-2 bg-red-600 text-white py-3 rounded-xl hover:bg-red-700 transition font-medium disabled:opacity-50"
              >
                <StopCircle className="w-4 h-4" />
                {dailyLoading ? 'Desativando...' : 'Desativar Disparo Diário'}
              </button>
            </div>
          ) : (
            <div>
              {/* Seletor de modo */}
              <div className="mb-4">
                <label className="text-sm text-gray-600 font-medium block mb-2">Frequência de envio:</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={() => setDailyMode('single')}
                    className={`flex-1 py-2 px-3 text-sm rounded-lg font-medium transition text-left ${
                      dailyMode === 'single'
                        ? 'bg-green-100 text-green-700 border-2 border-green-400'
                        : 'bg-gray-50 text-gray-500 border-2 border-transparent hover:bg-gray-100'
                    }`}
                  >
                    <span className="block font-semibold">1x por dia</span>
                    <span className="text-xs opacity-75">Escolha o horário</span>
                  </button>
                  <button
                    onClick={() => setDailyMode('triple')}
                    className={`flex-1 py-2 px-3 text-sm rounded-lg font-medium transition text-left ${
                      dailyMode === 'triple'
                        ? 'bg-green-100 text-green-700 border-2 border-green-400'
                        : 'bg-gray-50 text-gray-500 border-2 border-transparent hover:bg-gray-100'
                    }`}
                  >
                    <span className="block font-semibold">3x por dia</span>
                    <span className="text-xs opacity-75">8h, 12h e 19h</span>
                  </button>
                </div>
              </div>

              {/* Horário inicial — só para modo single */}
              {dailyMode === 'single' && (
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <label className="text-sm text-gray-600 whitespace-nowrap">Começar às:</label>
                  <select
                    value={dailyStartHour}
                    onChange={(e) => setDailyStartHour(Number(e.target.value))}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Aviso visual quando triple */}
              {dailyMode === 'triple' && (
                <div className="mb-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
                  Disparos automáticos todos os dias às <strong>8h</strong>, <strong>12h</strong> e <strong>19h</strong>.
                </div>
              )}

              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <label className="text-sm text-gray-600 whitespace-nowrap">Intervalo entre grupos:</label>
                <select
                  value={dailyInterval}
                  onChange={(e) => setDailyInterval(Number(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  {INTERVAL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={async () => {
                  if (!savedAdId) {
                    toast.error('Salve o anúncio primeiro!');
                    return;
                  }
                  setDailyLoading(true);
                  try {
                    const result = await api.ativarDiario(savedAdId, dailyStartHour, dailyInterval, dailyMode);
                    if (result.error) {
                      toast.error(result.error);
                    } else {
                      const data = await api.getStatusDiario();
                      setDailyActive(!!data.active);
                      setDailyMode((data.scheduleMode === 'triple' ? 'triple' : 'single') as 'single' | 'triple');
                      setDailyStartHour(data.startHour || dailyStartHour);
                      setDailyInterval(data.intervalMinutes || dailyInterval);
                      setDailySentToday(data.sentToday || 0);
                      const msg = dailyMode === 'triple'
                        ? 'Disparo diário ativado! 3x ao dia: 8h, 12h e 19h'
                        : `Disparo diário ativado! Todos os dias às ${data.startHour || dailyStartHour}h`;
                      toast.success(msg);
                    }
                  } catch {
                    toast.error('Erro ao ativar disparo diário');
                  } finally {
                    setDailyLoading(false);
                  }
                }}
                disabled={dailyLoading || !savedAdId}
                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl hover:bg-green-700 transition font-medium disabled:opacity-50"
              >
                <Calendar className="w-4 h-4" />
                {dailyLoading ? 'Ativando...' : 'Ativar Disparo Diário'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Preview WhatsApp */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 mb-3">PREVIEW</h3>
        <WhatsAppPreview
          text={text}
          imageUrl={imageUrl}
          caption={caption}
          showText={textActive}
          showImage={captionActive}
        />
      </div>
    </div>
  );
}
