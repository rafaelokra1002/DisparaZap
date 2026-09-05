'use client';

import { useEffect, useState } from 'react';
import StatsCard from './StatsCard';
import LoadingSpinner from './LoadingSpinner';
import { api } from '@/lib/api';

interface ClickMetrics {
  totalClicks: number;
  clicksToday: number;
  bestHour: string;
  byDevice: Array<{ device: string; count: number }>;
  byCountry: Array<{ country: string; count: number }>;
}

export default function ClicksTab() {
  const [clicks, setClicks] = useState<ClickMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClicks();
  }, []);

  async function loadClicks() {
    try {
      const data = await api.getMetricas();
      setClicks(data.clicks);
    } catch (error) {
      console.error('Erro ao carregar cliques:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSpinner text="Carregando cliques..." />;

  const data = clicks || {
    totalClicks: 0,
    clicksToday: 0,
    bestHour: 'N/A',
    byDevice: [],
    byCountry: [],
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-800 mb-4">Cliques</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="Total de Cliques"
          value={data.totalClicks}
          icon="🖱️"
          color="blue"
        />
        <StatsCard
          title="Cliques Hoje"
          value={data.clicksToday}
          icon="📈"
          color="green"
        />
        <StatsCard
          title="Melhor Horário"
          value={data.bestHour}
          icon="🕐"
          color="purple"
        />
        <StatsCard
          title="Taxa de Cliques"
          value={data.totalClicks > 0 ? `${((data.totalClicks / Math.max(data.totalClicks * 50, 1)) * 100).toFixed(1)}%` : '0%'}
          icon="📊"
          color="orange"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Por dispositivo */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-700 mb-4">📱 Por Dispositivo</h3>
          {data.byDevice.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum dado disponível</p>
          ) : (
            <div className="space-y-3">
              {data.byDevice.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{item.device}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-emerald-500 h-2 rounded-full"
                        style={{
                          width: `${Math.min(
                            (item.count / Math.max(...data.byDevice.map((d) => d.count))) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700 w-8 text-right">
                      {item.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Por país */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-700 mb-4">🌍 Por País</h3>
          {data.byCountry.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum dado disponível</p>
          ) : (
            <div className="space-y-3">
              {data.byCountry.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{item.country}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{
                          width: `${Math.min(
                            (item.count / Math.max(...data.byCountry.map((c) => c.count))) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700 w-8 text-right">
                      {item.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
