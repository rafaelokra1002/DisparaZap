'use client';

import { useEffect, useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { api } from '@/lib/api';
import { Clock, Image, Type, ChevronLeft, ChevronRight } from 'lucide-react';

interface SendLogItem {
  id: string;
  groupName: string;
  type: string;
  status: string;
  sentAt: string;
  ad?: {
    text?: string;
    caption?: string;
    imageUrl?: string;
  };
}

export default function HistoryTab() {
  const [logs, setLogs] = useState<SendLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadHistory();
  }, [page]);

  async function loadHistory() {
    setLoading(true);
    try {
      const data = await api.getHistorico(page);
      setLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSpinner text="Carregando histórico..." />;

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-800 mb-4">Histórico de Envios</h2>

      {logs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-400 text-lg mb-2">📋</p>
          <p className="text-gray-500">Nenhum envio realizado ainda</p>
          <p className="text-gray-400 text-sm mt-1">
            Crie um anúncio e dispare para seus grupos!
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-[640px] w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Grupo
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Tipo
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Data/Hora
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-800 font-medium">
                        {log.groupName}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                        {log.type === 'image' ? (
                          <>
                            <Image className="w-3 h-3" /> Foto
                          </>
                        ) : (
                          <>
                            <Type className="w-3 h-3" /> Texto
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center text-xs px-2 py-1 rounded-full ${
                          log.status === 'sent'
                            ? 'bg-green-100 text-green-700'
                            : log.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {log.status === 'sent'
                          ? '✅ Enviado'
                          : log.status === 'failed'
                          ? '❌ Falhou'
                          : '⏳ Pendente'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(log.sentAt).toLocaleString('pt-BR')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600">
                Página {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
