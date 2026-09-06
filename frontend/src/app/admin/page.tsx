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
  Users,
  Send,
  MousePointerClick,
  CreditCard,
  Trash2,
  Phone,
} from 'lucide-react';
import Link from 'next/link';

interface AdminStats {
  summary: {
    totalUsers: number;
    usersWithActivePlan: number;
    conversionRate: string;
  };
  activity: {
    totalAds: number;
    totalSends: number;
    totalClicks: number;
    averageClicksPerAd: string;
  };
  revenue: {
    totalRevenue: number;
    pendingTransactions: number;
  };
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  dedicatedWhatsApp: boolean;
  isAdmin: boolean;
  plan: string;
  planExpiresAt: string | null;
  createdAt: string;
  hasAccess: boolean;
  requiresPlan: boolean;
  isTrialActive: boolean;
  trialExpired: boolean;
  trialHoursLeft: number;
  hasActivePaidPlan: boolean;
  isExpiredPaidPlan: boolean;
  accessMode: string;
  accessPlanLabel: string;
  daysLeft: number;
  usesDedicatedWhatsApp: boolean;
  _count?: {
    ads: number;
  };
}

interface WhatsAppGroup {
  id: string;
  name: string;
  participants: number;
}

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

const PLAN_LABELS: Record<string, string> = {
  free: 'Grátis',
  no_plan: 'Sem plano',
  days_3: '3 DIAS',
  days_7: '7 DIAS',
  days_15: '15 DIAS',
  days_30: '30 DIAS',
};

function getPlanBadgeClass(plan: string) {
  if (plan === 'free') {
    return 'bg-gray-100 text-gray-700';
  }
  if (plan === 'no_plan') {
    return 'bg-rose-100 text-rose-700';
  }
  if (plan === 'days_30') {
    return 'bg-amber-100 text-amber-700';
  }
  if (plan === 'days_15') {
    return 'bg-cyan-100 text-cyan-700';
  }
  return 'bg-emerald-100 text-emerald-700';
}

function formatAdminDate(value: string | null) {
  if (!value) {
    return 'Sem data';
  }

  return new Date(value).toLocaleDateString('pt-BR');
}

function formatPhoneDisplay(value: string | null) {
  const digits = String(value || '').replace(/\D/g, '');

  if (!digits) {
    return 'Nao informado';
  }

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  if (digits.length > 11) {
    return `+${digits.slice(0, digits.length - 11)} (${digits.slice(-11, -9)}) ${digits.slice(-9, -4)}-${digits.slice(-4)}`;
  }

  return digits;
}

function getWhatsAppContactLink(value: string | null) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : null;
}

function getPlanExpiryLabel(user: AdminUser) {
  if (user.isAdmin) {
    return 'Administrador';
  }

  if (user.planExpiresAt) {
    return formatAdminDate(user.planExpiresAt);
  }

  if (user.plan === 'free') {
    return 'Plano grátis';
  }

  if (user.plan === 'no_plan') {
    return 'Sem plano';
  }

  return 'Sem vencimento';
}

function getAccessBadge(user: AdminUser) {
  if (user.isAdmin) {
    return {
      label: 'Admin',
      className: 'bg-slate-100 text-slate-700',
      description: 'Acesso total liberado',
    };
  }

  if (user.hasActivePaidPlan) {
    return {
      label: 'Plano ativo',
      className: 'bg-emerald-100 text-emerald-700',
      description: user.daysLeft > 0
        ? `${user.daysLeft} dia(s) restantes`
        : 'Plano pago válido',
    };
  }

  if (user.isTrialActive) {
    return {
      label: 'Teste 24h',
      className: 'bg-cyan-100 text-cyan-700',
      description: `${user.trialHoursLeft}h restantes`,
    };
  }

  if (user.isExpiredPaidPlan) {
    return {
      label: 'Plano vencido',
      className: 'bg-rose-100 text-rose-700',
      description: 'Bloqueado até novo pagamento',
    };
  }

  if (user.plan === 'free') {
    return {
      label: 'Plano grátis',
      className: 'bg-amber-100 text-amber-700',
      description: 'Acesso com limite diário',
    };
  }

  if (user.trialExpired || user.requiresPlan) {
    return {
      label: 'Bloqueado',
      className: 'bg-rose-100 text-rose-700',
      description: 'Precisa escolher e pagar um plano',
    };
  }

  return {
    label: 'Indefinido',
    className: 'bg-gray-100 text-gray-700',
    description: user.accessPlanLabel || 'Sem classificação',
  };
}

function getWhatsAppBadge(user: AdminUser) {
  if (user.isAdmin) {
    return {
      label: 'Global admin',
      className: 'bg-slate-100 text-slate-700',
      description: 'Sessão principal',
    };
  }

  if (user.dedicatedWhatsApp) {
    return {
      label: 'Individual',
      className: 'bg-blue-100 text-blue-700',
      description: user.usesDedicatedWhatsApp ? 'Liberado para esta conta' : 'Disponível na conta',
    };
  }

  return {
    label: 'Global',
    className: 'bg-gray-100 text-gray-700',
    description: 'Usa sessão compartilhada',
  };
}

export default function AdminPage() {
  const router = useRouter();
  const [status, setStatus] = useState<WhatsAppStatus>('disconnected');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [updatingDedicatedUserId, setUpdatingDedicatedUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const isPendingConnection = status === 'connecting' || status === 'qr_ready';

  useEffect(() => {
    validateAccess();
  }, [router]);

  // Polling para QR code quando conectando
  useEffect(() => {
    if (!polling) return;

    const interval = setInterval(async () => {
      await refreshConnection();
    }, 3000);

    return () => clearInterval(interval);
  }, [polling]);

  async function validateAccess() {
    const token = localStorage.getItem('disparazap_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const user = await api.getMe();
      if (!user?.isAdmin) {
        toast.error('Acesso restrito ao administrador');
        router.push('/painel');
        return;
      }

      await checkStatus();
      await loadAdminData();
    } catch (error) {
      console.error('Erro ao validar acesso admin:', error);
      router.push('/login');
      return;
    } finally {
      setCheckingAccess(false);
    }
  }

  async function loadAdminData(search = searchQuery) {
    setLoadingUsers(true);
    try {
      const [statsData, usersData] = await Promise.all([
        api.getAdminStats(),
        api.getAdminUsers(1, 50, search),
      ]);

      setStats(statsData);
      setUsers(usersData.users || []);
    } catch (error) {
      console.error('Erro ao carregar dados do admin:', error);
      toast.error('Erro ao carregar usuários do sistema');
    } finally {
      setLoadingUsers(false);
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
      console.error('Erro ao carregar grupos globais:', error);
      toast.error('Erro ao carregar grupos do WhatsApp global');
    } finally {
      setLoadingGroups(false);
    }
  }

  async function handleDedicatedWhatsAppToggle(user: AdminUser) {
    if (user.isAdmin) {
      toast.error('O administrador sempre usa a sessão global');
      return;
    }

    setUpdatingDedicatedUserId(user.id);

    try {
      const enabled = !user.dedicatedWhatsApp;
      const data = await api.setDedicatedWhatsApp(user.id, enabled);

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setUsers((currentUsers) => currentUsers.map((currentUser) => (
        currentUser.id === user.id
          ? { ...currentUser, dedicatedWhatsApp: enabled }
          : currentUser
      )));

      toast.success(enabled
        ? `WhatsApp individual liberado para ${user.email}`
        : `WhatsApp individual removido de ${user.email}`);
    } catch (error) {
      console.error('Erro ao atualizar WhatsApp individual:', error);
      toast.error('Erro ao atualizar liberação do WhatsApp individual');
    } finally {
      setUpdatingDedicatedUserId(null);
    }
  }

  async function handleDeleteUser(user: AdminUser) {
    if (user.isAdmin) {
      toast.error('O administrador não pode ser excluído');
      return;
    }

    const confirmed = window.confirm(`Excluir o usuário ${user.email}? Essa ação remove anúncios, histórico, transações e não pode ser desfeita.`);
    if (!confirmed) {
      return;
    }

    setDeletingUserId(user.id);

    try {
      const data = await api.deleteAdminUser(user.id);

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setUsers((currentUsers) => currentUsers.filter((currentUser) => currentUser.id !== user.id));
      await loadAdminData();
      toast.success(`Usuário ${user.email} excluído com sucesso`);
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      toast.error('Erro ao excluir usuário');
    } finally {
      setDeletingUserId(null);
    }
  }

  async function checkStatus() {
    try {
      const data = await api.getWhatsAppStatus();
      const normalizedStatus = normalizeWhatsAppStatus(data?.status);
      setStatus(normalizedStatus);

      if (normalizedStatus === 'connected') {
        setPolling(false);
        setQrCode(null);
        await loadGroups();
      } else if (normalizedStatus === 'connecting' || normalizedStatus === 'qr_ready') {
        setPolling(true);
        await refreshConnection();
      } else {
        setPolling(false);
        setQrCode(null);
        setGroups([]);
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
        await loadGroups();
        return {
          ...data,
          status: normalizedStatus,
        };
      }

      if (normalizedStatus === 'connecting' || normalizedStatus === 'qr_ready') {
        setPolling(true);
        return {
          ...data,
          status: normalizedStatus,
        };
      }

      setPolling(false);
      setQrCode(null);
      setGroups([]);
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
    qr_ready: {
      color: 'bg-blue-100 text-blue-700 border-blue-200',
      icon: <QrCode className="w-5 h-5 text-blue-600" />,
      text: 'QR Code pronto',
    },
    disconnected: {
      color: 'bg-red-100 text-red-700 border-red-200',
      icon: <XCircle className="w-5 h-5 text-red-600" />,
      text: 'Desconectado',
    },
  };

  const currentStatus = statusConfig[status];

  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <Users className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-800">Usuários</h2>
            </div>
            <p className="text-3xl font-black text-gray-900">{stats?.summary.totalUsers ?? 0}</p>
            <p className="text-sm text-gray-500 mt-1">Total de clientes cadastrados</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              <h2 className="font-semibold text-gray-800">Planos Ativos</h2>
            </div>
            <p className="text-3xl font-black text-gray-900">{stats?.summary.usersWithActivePlan ?? 0}</p>
            <p className="text-sm text-gray-500 mt-1">Conversão: {stats?.summary.conversionRate ?? '0.00%'}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <Send className="w-5 h-5 text-orange-600" />
              <h2 className="font-semibold text-gray-800">Envios</h2>
            </div>
            <p className="text-3xl font-black text-gray-900">{stats?.activity.totalSends ?? 0}</p>
            <p className="text-sm text-gray-500 mt-1">Anúncios: {stats?.activity.totalAds ?? 0}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <MousePointerClick className="w-5 h-5 text-purple-600" />
              <h2 className="font-semibold text-gray-800">Cliques</h2>
            </div>
            <p className="text-3xl font-black text-gray-900">{stats?.activity.totalClicks ?? 0}</p>
            <p className="text-sm text-gray-500 mt-1">Média/anúncio: {stats?.activity.averageClicksPerAd ?? '0.00'}</p>
          </div>
        </div>

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
                      : isPendingConnection
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

                  await loadAdminData();
                }}
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
              ) : isPendingConnection ? (
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

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Grupos do WhatsApp Global</h3>
              <p className="text-sm text-gray-500">Lista de grupos disponíveis na sessão global do admin.</p>
            </div>
            <button
              onClick={loadGroups}
              disabled={status !== 'connected' || loadingGroups}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingGroups ? 'Atualizando...' : 'Atualizar grupos'}
            </button>
          </div>

          {status !== 'connected' ? (
            <p className="text-sm text-gray-500">Conecte o WhatsApp global para visualizar os grupos.</p>
          ) : loadingGroups ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            </div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum grupo encontrado na sessão global.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
              {groups.map((group) => (
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

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Usuários do Sistema</h3>
              <p className="text-sm text-gray-500">Clientes com plano, status real de acesso, WhatsApp e vencimento do acesso.</p>
            </div>
            <button
              onClick={() => loadAdminData()}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              Atualizar lista
            </button>
          </div>

          <div className="mb-4 flex gap-2">
            <input
              type="text"
              placeholder="Buscar por e-mail ou nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') loadAdminData(searchQuery); }}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <button
              onClick={() => loadAdminData(searchQuery)}
              disabled={loadingUsers}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {loadingUsers ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
            </button>
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); loadAdminData(''); }}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Limpar
              </button>
            )}
          </div>

          {loadingUsers ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum usuário encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="py-3 pr-4 font-medium">Nome</th>
                    <th className="py-3 pr-4 font-medium">Email</th>
                    <th className="py-3 pr-4 font-medium">Telefone</th>
                    <th className="py-3 pr-4 font-medium">WhatsApp</th>
                    <th className="py-3 pr-4 font-medium">Plano</th>
                    <th className="py-3 pr-4 font-medium">Status</th>
                    <th className="py-3 pr-4 font-medium">Anúncios</th>
                    <th className="py-3 pr-4 font-medium">Vencimento</th>
                    <th className="py-3 pr-0 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const accessBadge = getAccessBadge(user);
                    const whatsappBadge = getWhatsAppBadge(user);
                    const contactLink = getWhatsAppContactLink(user.phone);

                    return (
                    <tr key={user.id} className="border-b border-gray-100 last:border-0 align-top">
                      <td className="py-3 pr-4 font-medium text-gray-800">{user.name}</td>
                      <td className="py-3 pr-4 text-gray-600">{user.email}</td>
                      <td className="py-3 pr-4 text-gray-600">
                        <div className="space-y-1">
                          <div>{formatPhoneDisplay(user.phone)}</div>
                          {contactLink ? (
                            <a
                              href={contactLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                            >
                              <Phone className="h-3.5 w-3.5" />
                              Abrir conversa
                            </a>
                          ) : (
                            <div className="text-xs text-gray-400">Sem telefone cadastrado</div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="space-y-1">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${whatsappBadge.className}`}>
                            {whatsappBadge.label}
                          </span>
                          <div className="text-xs text-gray-400">{whatsappBadge.description}</div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="space-y-1">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getPlanBadgeClass(user.plan)}`}>
                            {PLAN_LABELS[user.plan] || user.plan}
                          </span>
                          <div className="text-xs text-gray-400">{user.accessPlanLabel}</div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="space-y-1">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${accessBadge.className}`}>
                            {accessBadge.label}
                          </span>
                          <div className="text-xs text-gray-400">{accessBadge.description}</div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-gray-600">{user._count?.ads ?? 0}</td>
                      <td className="py-3 pr-4 text-gray-600">
                        <div>{getPlanExpiryLabel(user)}</div>
                        <div className="text-xs text-gray-400">
                          Cadastro: {formatAdminDate(user.createdAt)}
                        </div>
                      </td>
                      <td className="py-3 pr-0 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleDedicatedWhatsAppToggle(user)}
                            disabled={user.isAdmin || updatingDedicatedUserId === user.id || deletingUserId === user.id}
                            className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold transition ${
                              user.isAdmin
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : user.dedicatedWhatsApp
                                ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            } disabled:opacity-60`}
                          >
                            {updatingDedicatedUserId === user.id
                              ? 'Salvando...'
                              : user.dedicatedWhatsApp
                              ? 'Usar global'
                              : 'Liberar individual'}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            disabled={user.isAdmin || deletingUserId === user.id || updatingDedicatedUserId === user.id}
                            className="inline-flex items-center justify-center gap-1 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {deletingUserId === user.id ? 'Excluindo...' : 'Excluir'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
