'use client';

import { useEffect, useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { api } from '@/lib/api';
import { Megaphone, BarChart3, Users, MessageSquare } from 'lucide-react';

interface Metrics {
  overview: {
    sendsToday: number;
    totalSends: number;
    peopleReached: number;
    privateMessages: number;
    totalGroups: number;
    lastSend: { groupName: string; sentAt: string } | null;
  };
}

export default function OverviewTab() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  async function loadMetrics() {
    try {
      const data = await api.getMetricas();
      setMetrics(data);
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSpinner text="Carregando métricas..." />;

  const overview = metrics?.overview || {
    sendsToday: 0,
    totalSends: 0,
    peopleReached: 0,
    privateMessages: 0,
    totalGroups: 0,
    lastSend: null,
  };

  return (
    <div className="bg-gray-50 rounded-2xl p-6">
      <h2 className="text-lg font-bold text-gray-800">Como está indo</h2>
      <p className="text-sm text-gray-500 mb-5">
        Números aproximados para você acompanhar. Quanto mais você usa o serviço, mais eles sobem.
      </p>

      {/* Cards 2x2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Envios hoje */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <Megaphone className="w-5 h-5 text-gray-500 mb-3" />
          <p className="text-3xl font-bold text-gray-800">{overview.sendsToday.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">Envios para grupos hoje</p>
        </div>

        {/* Total de envios */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <BarChart3 className="w-5 h-5 text-gray-500 mb-3" />
          <p className="text-3xl font-bold text-gray-800">{overview.totalSends.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">Total de envios (grupos)</p>
        </div>

        {/* Pessoas alcançadas */}
        <div className="bg-emerald-700 rounded-xl p-5 text-white">
          <Users className="w-5 h-5 text-emerald-200 mb-3" />
          <p className="text-3xl font-bold">{overview.peopleReached.toLocaleString()}</p>
          <p className="text-sm text-emerald-200 mt-1">Pessoas alcançadas (estimativa)</p>
        </div>

        {/* Mensagens privadas */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <MessageSquare className="w-5 h-5 text-gray-500 mb-3" />
          <p className="text-3xl font-bold text-gray-800">{overview.privateMessages.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">Mensagens no WhatsApp privado hoje</p>
        </div>
      </div>

      {/* Info section */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2 text-sm text-gray-600">
        {overview.lastSend && (
          <p>
            <strong className="text-gray-800">Último envio nos grupos:</strong>{' '}
            {new Date(overview.lastSend.sentAt).toLocaleString('pt-BR')} — {overview.lastSend.groupName}
          </p>
        )}
        <p>
          Grupos em que você aparece: <strong className="text-gray-800">{overview.totalGroups}</strong>
          {' '}· Alcance total estimado: <strong className="text-gray-800">{overview.peopleReached.toLocaleString()} pessoas</strong>
        </p>
        <p>
          Campanhas já feitas no privado (total): <strong className="text-gray-800">{overview.privateMessages > 0 ? Math.floor(overview.privateMessages / 50) : 0}</strong>
        </p>
      </div>
    </div>
  );
}
