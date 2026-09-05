'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  QrCode,
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';

export default function AdminPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string>('disconnected');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('disparazap_token');
    if (!token) {
      router.push('/login');
      return;
    }
    checkStatus();
  }, []);

  // Polling para QR code quando conectando
  useEffect(() => {
    if (!polling) return;

    const interval = setInterval(async () => {
      try {
        const data = await api.getQRCode();
        setStatus(data.status);
        if (data.qrCode) {
          setQrCode(data.qrCode);
        }
        if (data.status === 'connected') {
          setPolling(false);
          setQrCode(null);
          toast.success('WhatsApp conectado com sucesso!');
        }
      } catch (error) {
        console.error('Erro no polling:', error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [polling]);

  async function checkStatus() {
    try {
      const data = await api.getWhatsAppStatus();
      setStatus(data.status);
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    }
  }

  async function handleConnect() {
    setLoading(true);
    try {
      await api.startWhatsApp();
      setPolling(true);
      toast.success('Iniciando sessão... Aguarde o QR Code.');
    } catch (error) {
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
      toast.success('WhatsApp desconectado');
    } catch (error) {
      toast.error('Erro ao desconectar');
      console.error(error);
    }
  }

  const statusConfig = {
    connected: {
      color: 'bg-green-100 text-green-700 border-green-200',
      icon: <CheckCircle className="w-5 h-5 text-green-600" />,
      text: 'Conectado',
    },
    connecting: {
      color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      icon: <Loader2 className="w-5 h-5 text-yellow-600 animate-spin" />,
      text: 'Conectando...',
    },
    disconnected: {
      color: 'bg-red-100 text-red-700 border-red-200',
      icon: <XCircle className="w-5 h-5 text-red-600" />,
      text: 'Desconectado',
    },
  };

  const currentStatus = statusConfig[status as keyof typeof statusConfig] || statusConfig.disconnected;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Admin */}
      <header className="bg-gradient-to-r from-gray-800 to-gray-900 text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-400 hover:text-white transition">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-lg font-bold">⚙️ Painel Admin</h1>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${currentStatus.color}`}>
              {currentStatus.icon}
              {currentStatus.text}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Status Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              {status === 'connected' ? (
                <Wifi className="w-5 h-5 text-green-500" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-500" />
              )}
              Status WhatsApp
            </h2>

            <div className={`p-4 rounded-xl border-2 mb-4 ${currentStatus.color}`}>
              <div className="flex items-center gap-3">
                {currentStatus.icon}
                <div>
                  <p className="font-bold">{currentStatus.text}</p>
                  <p className="text-xs opacity-70">
                    {status === 'connected'
                      ? 'Pronto para enviar mensagens'
                      : status === 'connecting'
                      ? 'Escaneie o QR Code com seu WhatsApp'
                      : 'Clique em conectar para iniciar'}
                  </p>
                </div>
              </div>
            </div>

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
                <button
                  onClick={handleDisconnect}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-3 rounded-xl hover:bg-red-700 transition font-medium"
                >
                  <WifiOff className="w-4 h-4" />
                  Desconectar
                </button>
              )}

              {status === 'connecting' && (
                <button
                  onClick={handleDisconnect}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-600 text-white py-3 rounded-xl hover:bg-gray-700 transition font-medium"
                >
                  <XCircle className="w-4 h-4" />
                  Cancelar
                </button>
              )}

              <button
                onClick={checkStatus}
                className="p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                title="Atualizar status"
              >
                <RefreshCw className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* QR Code Card */}
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
                  <p className="text-sm text-gray-400 mt-1">
                    Seu dispositivo está vinculado
                  </p>
                </div>
              ) : qrCode ? (
                <div className="text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrCode}
                    alt="QR Code WhatsApp"
                    className="w-64 h-64 mx-auto"
                  />
                  <p className="text-sm text-gray-500 mt-3">
                    Escaneie com seu WhatsApp
                  </p>
                </div>
              ) : status === 'connecting' ? (
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">Gerando QR Code...</p>
                  <p className="text-xs text-gray-400 mt-1">Isso pode levar alguns segundos</p>
                </div>
              ) : (
                <div className="text-center">
                  <QrCode className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-400">
                    Clique em "Conectar WhatsApp" para gerar o QR Code
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Instruções */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="font-semibold text-blue-800 mb-2">💡 Como conectar</h3>
          <ol className="text-sm text-blue-700 space-y-1.5 list-decimal list-inside">
            <li>Clique no botão <strong>"Conectar WhatsApp"</strong></li>
            <li>Aguarde o QR Code aparecer na tela</li>
            <li>Abra o WhatsApp no seu celular</li>
            <li>Vá em <strong>Configurações → Aparelhos conectados → Conectar aparelho</strong></li>
            <li>Escaneie o QR Code exibido nesta página</li>
            <li>Pronto! O status mudará para <strong>"Conectado"</strong></li>
          </ol>
        </div>
      </main>
    </div>
  );
}
