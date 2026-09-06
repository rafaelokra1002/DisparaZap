'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  QrCode,
  Loader2,
  CheckCircle,
  XCircle,
  Smartphone,
} from 'lucide-react';

type WhatsAppStatus = 'connected' | 'connecting' | 'qr_ready' | 'disconnected';

function isRecoverableGroupsState(error?: string) {
  return error === 'WhatsApp exige nova autenticação por QR Code'
    || error === 'WhatsApp não está conectado';
}

function normalizeWhatsAppStatus(rawStatus?: string, qrCode?: string | null): WhatsAppStatus {
  if (rawStatus === 'connected') {
    return 'connected';
  }

  if (qrCode || rawStatus === 'qr_ready') {
    return 'qr_ready';
  }

  if (rawStatus === 'connecting') {
    return 'connecting';
  }

  return 'disconnected';
}

export default function WhatsAppTab() {
  const [status, setStatus] = useState<WhatsAppStatus>('disconnected');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const isPendingConnection = status === 'connecting' || status === 'qr_ready';

  useEffect(() => {
    checkStatus();
  }, []);

  // Continua atualizando status/QR enquanto a sessão estiver conectando.
  useEffect(() => {
    if (!polling) return;

    refreshConnection();

    const interval = setInterval(() => {
      refreshConnection();
    }, 4000);

    return () => clearInterval(interval);
  }, [polling]);

  // Carregar grupos quando conectado
  useEffect(() => {
    if (status === 'connected') {
      loadGroups();
    }
  }, [status]);

  async function checkStatus() {
    try {
      const data = await api.getWhatsAppStatus();
      const normalizedStatus = normalizeWhatsAppStatus(data?.status);
      setStatus(normalizedStatus);

      if (normalizedStatus === 'connected') {
        setQrCode(null);
        setPolling(false);
      }

      if (normalizedStatus === 'connecting' || normalizedStatus === 'qr_ready') {
        setPolling(true);
      }

      if (normalizedStatus === 'disconnected') {
        setPolling(false);
      }

      return {
        ...data,
        status: normalizedStatus,
      };
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      return null;
    }
  }

  async function refreshConnection(showFeedback = false) {
    try {
      const data = await api.getQRCode();
      const normalizedStatus = normalizeWhatsAppStatus(data?.status, data?.qrCode || null);
      setStatus(normalizedStatus);
      setQrCode(data?.qrCode || null);

      if (normalizedStatus === 'connected') {
        setPolling(false);
        setQrCode(null);
        if (showFeedback) {
          toast.success('WhatsApp conectado com sucesso!');
        }
        loadGroups();
        return;
      }

      if (normalizedStatus === 'disconnected') {
        setPolling(false);
        setQrCode(null);
        return;
      }

      if (normalizedStatus === 'connecting' || normalizedStatus === 'qr_ready') {
        setPolling(true);
      }

        if (showFeedback && !data?.qrCode) {
        toast('A sessao ainda esta iniciando. Atualize novamente em alguns segundos.');
      }

      return {
        ...data,
        status: normalizedStatus,
      };
    } catch (error) {
      console.error('Erro ao atualizar conexao:', error);
      if (showFeedback) {
        toast.error('Erro ao atualizar o status do WhatsApp');
      }
      return null;
    }
  }

  async function loadGroups() {
    setLoadingGroups(true);
    try {
      const data = await api.getWhatsAppGroups();

      if (isRecoverableGroupsState(data?.error)) {
        setGroups([]);
        await refreshConnection();
        return;
      }

      setGroups(data.groups || []);
    } catch (error) {
      console.error('Erro ao carregar grupos:', error);
    } finally {
      setLoadingGroups(false);
    }
  }

  async function handleConnect() {
    setLoading(true);
    try {
      setStatus('connecting');
      setQrCode(null);
      setPolling(true);

      await api.startWhatsApp();
      await refreshConnection();

      toast.success('Iniciando sessão... Aguarde o QR Code.');
    } catch (error) {
      setStatus('disconnected');
      setQrCode(null);
      setPolling(false);
      toast.error('Erro ao iniciar WhatsApp');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    try {
      await api.disconnectWhatsApp();
      setStatus('disconnected');
      setQrCode(null);
      setPolling(false);
      setGroups([]);
      toast.success('WhatsApp desconectado');
    } catch (error) {
      toast.error('Erro ao desconectar');
      console.error(error);
    }
  }

  async function handleLogout() {
    try {
      await api.logoutWhatsApp();
      setStatus('disconnected');
      setQrCode(null);
      setPolling(false);
      setGroups([]);
      toast.success('Número desvinculado! Agora você pode conectar outro.');
    } catch (error) {
      toast.error('Erro ao desvincular número');
      console.error(error);
    }
  }

  const statusConfig = {
    connected: {
      color: 'bg-green-100 text-green-700 border-green-200',
      icon: <CheckCircle className="w-5 h-5 text-green-600" />,
      text: 'Conectado',
      desc: 'Pronto para enviar mensagens',
    },
    connecting: {
      color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      icon: <Loader2 className="w-5 h-5 text-yellow-600 animate-spin" />,
      text: 'Conectando...',
      desc: 'Escaneie o QR Code com seu WhatsApp',
    },
    qr_ready: {
      color: 'bg-blue-100 text-blue-700 border-blue-200',
      icon: <QrCode className="w-5 h-5 text-blue-600" />,
      text: 'QR Code pronto',
      desc: 'Escaneie o QR Code com seu WhatsApp',
    },
    disconnected: {
      color: 'bg-red-100 text-red-700 border-red-200',
      icon: <XCircle className="w-5 h-5 text-red-600" />,
      text: 'Desconectado',
      desc: 'Conecte seu WhatsApp para começar',
    },
  };

  const currentStatus = statusConfig[status];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status + Ações */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-500" />
            Minha Conexão WhatsApp
          </h2>

          {/* Status Badge */}
          <div className={`p-4 rounded-xl border-2 mb-5 ${currentStatus.color}`}>
            <div className="flex items-center gap-3">
              {currentStatus.icon}
              <div>
                <p className="font-bold">{currentStatus.text}</p>
                <p className="text-xs opacity-70">{currentStatus.desc}</p>
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3">
            {status === 'disconnected' && (
              <button
                onClick={handleConnect}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl hover:bg-emerald-700 transition font-medium disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wifi className="w-4 h-4" />
                )}
                {loading ? 'Iniciando...' : 'Conectar WhatsApp'}
              </button>
            )}

            {status === 'connected' && (
              <>
                <button
                  onClick={handleDisconnect}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-3 rounded-xl hover:bg-red-700 transition font-medium"
                >
                  <WifiOff className="w-4 h-4" />
                  Desconectar
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 flex items-center justify-center gap-2 bg-orange-600 text-white py-3 rounded-xl hover:bg-orange-700 transition font-medium"
                >
                  <Smartphone className="w-4 h-4" />
                  Trocar Número
                </button>
              </>
            )}

            {isPendingConnection && (
              <button
                onClick={handleDisconnect}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-600 text-white py-3 rounded-xl hover:bg-gray-700 transition font-medium"
              >
                <XCircle className="w-4 h-4" />
                Cancelar
              </button>
            )}

            <button
              onClick={async () => {
                const statusData = await checkStatus();

                if (statusData?.status === 'connecting' || statusData?.status === 'qr_ready' || polling) {
                  await refreshConnection(true);
                }
              }}
              className="p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
              title="Atualizar status"
            >
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Instruções */}
          {status !== 'connected' && (
            <div className="mt-5 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="font-semibold text-blue-800 mb-2 text-sm">💡 Como conectar</h3>
              <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                <li>Clique em <strong>"Conectar WhatsApp"</strong></li>
                <li>Aguarde o QR Code aparecer</li>
                <li>No celular: <strong>WhatsApp → Aparelhos conectados → Conectar</strong></li>
                <li>Escaneie o QR Code</li>
              </ol>
            </div>
          )}
        </div>

        {/* QR Code */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-gray-500" />
            QR Code
          </h2>

          <div className="flex items-center justify-center min-h-[280px] bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            {status === 'connected' ? (
              <div className="text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-3" />
                <p className="text-green-700 font-medium">WhatsApp Conectado!</p>
                <p className="text-sm text-gray-400 mt-1">Seu dispositivo está vinculado</p>
              </div>
            ) : qrCode ? (
              <div className="text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCode} alt="QR Code WhatsApp" className="w-64 h-64 mx-auto" />
                <p className="text-sm text-gray-500 mt-3">Escaneie com seu WhatsApp</p>
              </div>
            ) : isPendingConnection ? (
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Gerando QR Code...</p>
                <p className="text-xs text-gray-400 mt-1">Use o botao de atualizar para buscar o QR Code sem recarregamento automatico</p>
              </div>
            ) : (
              <div className="text-center">
                <QrCode className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">
                  Clique em "Conectar WhatsApp" para gerar o QR Code
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lista de Grupos */}
      {status === 'connected' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              👥 Seus Grupos ({groups.length})
            </h2>
            <button
              onClick={loadGroups}
              disabled={loadingGroups}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingGroups ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>

          {loadingGroups ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
              <span className="ml-2 text-gray-500">Carregando grupos...</span>
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>Nenhum grupo encontrado</p>
              <p className="text-xs mt-1">Os grupos do seu WhatsApp aparecerão aqui</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
              {groups.map((group: any) => (
                <div
                  key={group.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold text-sm flex-shrink-0">
                    {group.name?.charAt(0)?.toUpperCase() || 'G'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{group.name}</p>
                    <p className="text-xs text-gray-400">{group.participants || 0} participantes</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
