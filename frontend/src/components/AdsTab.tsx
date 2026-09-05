'use client';

import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import Toggle from './Toggle';
import WhatsAppPreview from './WhatsAppPreview';
import LoadingSpinner from './LoadingSpinner';
import { api } from '@/lib/api';
import { Save, Send, Upload, Image as ImageIcon, Clock, StopCircle, RefreshCw, Users } from 'lucide-react';

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
  const [targetUrl, setTargetUrl] = useState('');

  // Agendamento
  const [intervalMinutes, setIntervalMinutes] = useState(120);
  const [scheduleActive, setScheduleActive] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleRemaining, setScheduleRemaining] = useState(0);
  const [scheduleTotal, setScheduleTotal] = useState(0);

  // Limite diário
  const [dailyLimit, setDailyLimit] = useState(50);
  const [dailyUsed, setDailyUsed] = useState(0);

  // Seleção de grupos
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [sendToAll, setSendToAll] = useState(true);

  // Carregar último anúncio salvo, agendamento e grupos ao montar
  useEffect(() => {
    api.getAds().then((ads: any[]) => {
      if (ads && ads.length > 0) {
        const ad = ads[0]; // mais recente
        setSavedAdId(ad.id);
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
        setScheduleRemaining(data.remaining || 0);
        setScheduleTotal(data.total || 0);
      }
    }).catch(() => {});

    api.getLimiteDiario().then(data => {
      setDailyLimit(data.limit || 50);
      setDailyUsed(data.used || 0);
    }).catch(() => {});

    loadGroups();
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
        setScheduleRemaining(data.remaining || 0);
        setScheduleTotal(data.total || 0);
      } catch {}
    }, 15000);
    return () => clearInterval(interval);
  }, [scheduleActive]);

  async function loadGroups() {
    setLoadingGroups(true);
    try {
      const data = await api.getGrupos();
      if (data.groups) {
        setGroups(data.groups);
      }
    } catch {
      // WhatsApp pode não estar conectado
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

  // Salvar anúncio
  async function handleSave() {
    if (!text && !caption && !imageUrl) {
      toast.error('Preencha ao menos um campo do anúncio');
      return;
    }

    setSaving(true);
    try {
      if (savedAdId) {
        await api.updateAd(savedAdId, {
          text,
          textActive,
          caption,
          imageUrl,
          captionActive,
          targetUrl,
        });
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
      const groupIds = sendToAll ? undefined : selectedGroups;
      const result = await api.disparar(savedAdId, groupIds);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${result.totalGroups} grupos na fila de envio!`);
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
          <div className="flex items-center justify-between mb-3">
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
          <div className="flex items-center justify-between mb-3">
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

          <div className="flex items-center gap-3">
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
        </div>

        {/* SELEÇÃO DE GRUPOS */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-500" />
              Grupos para envio
            </h3>
            <button
              onClick={loadGroups}
              disabled={loadingGroups}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              <RefreshCw className={`w-3 h-3 ${loadingGroups ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>

          {/* Toggle todos/selecionar */}
          <div className="flex gap-2 mb-3">
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
                    <p>Nenhum grupo encontrado. Conecte seu WhatsApp primeiro.</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
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

        {/* Botões de ação */}
        <div className="flex gap-3">
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
            className="flex items-center justify-center gap-2 px-6 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition font-medium disabled:opacity-50"
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
        <div className="bg-white rounded-xl border-2 border-blue-200 p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
              🛡️ Proteção Anti-Ban
            </h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
              {dailyUsed}/{dailyLimit} hoje
            </span>
          </div>
          <div className="w-full bg-blue-100 rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full transition-all ${dailyUsed >= dailyLimit ? 'bg-red-500' : dailyUsed >= dailyLimit * 0.8 ? 'bg-yellow-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min((dailyUsed / dailyLimit) * 100, 100)}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <p>✅ Variação automática no texto de cada envio</p>
            <p>✅ Intervalo de 5-10 min entre grupos (manual)</p>
            <p>✅ Limite de {dailyLimit} envios por dia</p>
            {dailyUsed >= dailyLimit && (
              <p className="text-red-600 font-medium mt-1">🚫 Limite diário atingido. Aguarde até amanhã.</p>
            )}
          </div>
        </div>

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
                  {scheduleTotal - scheduleRemaining} de {scheduleTotal} grupos enviados — restam {scheduleRemaining}
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
              <div className="flex items-center gap-3 mb-3">
                <label className="text-sm text-gray-600">Enviar a cada:</label>
                <select
                  value={intervalMinutes}
                  onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value={60}>1 hora</option>
                  <option value={120}>2 horas (recomendado)</option>
                  <option value={180}>3 horas</option>
                  <option value={240}>4 horas</option>
                  <option value={360}>6 horas</option>
                  <option value={720}>12 horas</option>
                  <option value={1440}>24 horas</option>
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
                    const result = await api.agendarDisparo(savedAdId, intervalMinutes);
                    if (result.error) {
                      toast.error(result.error);
                    } else {
                      setScheduleActive(true);
                      toast.success(`Disparo agendado a cada ${intervalMinutes} minutos!`);
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
