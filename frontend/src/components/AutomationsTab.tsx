'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';
import Toggle from './Toggle';
import { api } from '@/lib/api';
import { MessageCircleReply, CalendarClock, Lock, Send, Eye } from 'lucide-react';

interface Settings {
  autoReplyEnabled: boolean;
  autoReplyMessage: string;
  defaultAutoReplyMessage: string;
  canUseAutoReply: boolean;
  weeklyReportEnabled: boolean;
  lastWeeklyReportAt: string | null;
  phone: string;
  phoneValid: boolean;
}

export default function AutomationsTab() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    api.getConfiguracoes()
      .then((res) => {
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        setSettings(res);
        setMessage(res.autoReplyMessage || res.defaultAutoReplyMessage || '');
        setPhone(res.phone || '');
      })
      .catch(() => toast.error('Erro ao carregar automações'))
      .finally(() => setLoading(false));
  }, []);

  async function save(data: Record<string, unknown>, success: string) {
    setSaving(true);
    try {
      const res = await api.saveConfiguracoes(data);
      if (res?.error) {
        toast.error(res.error);
        return false;
      }
      setSettings(res);
      toast.success(success);
      return true;
    } catch {
      toast.error('Erro ao salvar');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    setLoadingPreview(true);
    try {
      const res = await api.getPreviaRelatorio();
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setPreview(res.text);
    } catch {
      toast.error('Erro ao montar a prévia');
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleTest() {
    setSendingTest(true);
    try {
      const res = await api.testarRelatorio();
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message || 'Relatório enviado!');
    } catch {
      toast.error('Erro ao enviar o teste');
    } finally {
      setSendingTest(false);
    }
  }

  if (loading) return <LoadingSpinner text="Carregando automações..." />;
  if (!settings) return null;

  const messageChanged = message.trim() !== (settings.autoReplyMessage || settings.defaultAutoReplyMessage || '').trim();
  const phoneChanged = phone.replace(/\D/g, '') !== (settings.phone || '');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-800">Automações</h2>
        <p className="text-sm text-gray-500">Coisas que o DisparaZap faz sozinho por você.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Resposta automática */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="flex items-center gap-2 font-semibold text-gray-800">
            <MessageCircleReply className="h-4 w-4 text-emerald-600" /> Resposta automática no privado
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Quando alguém chama seu WhatsApp por causa do anúncio, recebe na hora a sua mensagem com o link. Assim nenhum contato esfria esperando resposta.
          </p>

          {!settings.canUseAutoReply ? (
            <div className="mt-4 flex gap-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <span>Disponível para quem divulga com o próprio número de WhatsApp. Hoje seus anúncios saem pelo número do sistema, então as respostas não chegam no seu celular.</span>
            </div>
          ) : (
            <>
              <div className="mt-4">
                <Toggle
                  enabled={settings.autoReplyEnabled}
                  onChange={(v) => { if (!saving) save({ autoReplyEnabled: v, autoReplyMessage: message }, v ? 'Resposta automática ativada!' : 'Resposta automática desativada'); }}
                  label={settings.autoReplyEnabled ? 'Ativada' : 'Desativada'}
                />
              </div>

              <label className="mt-4 block text-xs font-medium text-gray-500" htmlFor="auto-reply-message">Mensagem</label>
              <textarea
                id="auto-reply-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={1000}
                className="mt-1 h-32 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-emerald-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Use <code className="rounded bg-gray-100 px-1">{'{nome}'}</code> para o primeiro nome da pessoa e <code className="rounded bg-gray-100 px-1">{'{link}'}</code> para o link do seu anúncio. Cada contato recebe no máximo 1 resposta automática por dia.
              </p>
              {messageChanged && (
                <button
                  onClick={() => save({ autoReplyMessage: message }, 'Mensagem salva!')}
                  disabled={saving}
                  className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar mensagem'}
                </button>
              )}
            </>
          )}
        </div>

        {/* Relatório semanal */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="flex items-center gap-2 font-semibold text-gray-800">
            <CalendarClock className="h-4 w-4 text-emerald-600" /> Relatório semanal no WhatsApp
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Toda segunda às 9h você recebe no WhatsApp um resumo da semana: envios, cliques, melhor grupo, melhor horário e grupos sem retorno.
          </p>

          <div className="mt-4">
            <Toggle
              enabled={settings.weeklyReportEnabled}
              onChange={(v) => { if (!saving) save({ weeklyReportEnabled: v }, v ? 'Relatório semanal ativado!' : 'Relatório semanal desativado'); }}
              label={settings.weeklyReportEnabled ? 'Ativado' : 'Desativado'}
            />
          </div>

          <label className="mt-4 block text-xs font-medium text-gray-500" htmlFor="report-phone">WhatsApp que recebe o relatório</label>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <input
              id="report-phone"
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="11999998888"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-emerald-500"
            />
            {phoneChanged && (
              <button
                onClick={() => save({ phone }, 'Telefone salvo!')}
                disabled={saving}
                className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Salvar
              </button>
            )}
          </div>
          {!settings.phoneValid && !phoneChanged && (
            <p className="mt-1 text-xs text-amber-700">Cadastre um telefone com DDD para receber o relatório.</p>
          )}
          {settings.lastWeeklyReportAt && (
            <p className="mt-2 text-xs text-gray-500">Último relatório: {new Date(settings.lastWeeklyReportAt).toLocaleString('pt-BR')}</p>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={handlePreview}
              disabled={loadingPreview}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Eye className="h-4 w-4" /> {loadingPreview ? 'Montando...' : 'Ver prévia'}
            </button>
            <button
              onClick={handleTest}
              disabled={sendingTest || !settings.phoneValid || phoneChanged}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> {sendingTest ? 'Enviando...' : 'Enviar teste agora'}
            </button>
          </div>

          {preview && (
            <pre className="mt-4 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl bg-[#e7f7e1] p-4 font-sans text-sm text-gray-800">
              {preview}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
