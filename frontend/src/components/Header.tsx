'use client';

import { useState } from 'react';
import { LogOut, BookOpen, MessageSquare } from 'lucide-react';

interface HeaderProps {
  userName: string;
  onLogout?: () => void;
}

export default function Header({ userName, onLogout }: HeaderProps) {
  const [showTutorial, setShowTutorial] = useState(false);

  return (
    <>
      <header className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:py-0">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <MessageSquare className="w-7 h-7 sm:w-8 sm:h-8" />
              <h1 className="text-lg font-bold sm:text-xl">DisparaZap</h1>
            </div>

            {/* Ações */}
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap sm:gap-4">
              <span className="mr-auto min-w-0 truncate text-sm text-emerald-100 sm:mr-0">
                Olá, <strong>{userName}</strong>
              </span>

              <button
                onClick={() => setShowTutorial(true)}
                className="flex items-center gap-1 rounded-lg bg-white/20 px-3 py-2 text-xs transition hover:bg-white/30 sm:text-sm"
              >
                <BookOpen className="w-4 h-4" />
                Tutorial
              </button>

              <button
                onClick={onLogout}
                className="flex items-center gap-1 rounded-lg bg-red-500/80 px-3 py-2 text-xs transition hover:bg-red-500 sm:text-sm"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Modal Tutorial */}
      {showTutorial && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">📖 Tutorial</h2>
            <div className="space-y-3 text-gray-600 text-sm">
              <div className="flex gap-3">
                <span className="bg-emerald-100 text-emerald-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <p>Crie seu anúncio na aba <strong>"Meus Anúncios"</strong> com texto e/ou imagem.</p>
              </div>
              <div className="flex gap-3">
                <span className="bg-emerald-100 text-emerald-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <p>Conecte seu WhatsApp na página <strong>Admin</strong> escaneando o QR Code.</p>
              </div>
              <div className="flex gap-3">
                <span className="bg-emerald-100 text-emerald-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">3</span>
                <p>Clique em <strong>"Disparar"</strong> para enviar para todos os seus grupos.</p>
              </div>
              <div className="flex gap-3">
                <span className="bg-emerald-100 text-emerald-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">4</span>
                <p>Acompanhe os resultados nas abas <strong>"Visão Geral"</strong>, <strong>"Cliques"</strong> e <strong>"Histórico"</strong>.</p>
              </div>
            </div>
            <button
              onClick={() => setShowTutorial(false)}
              className="mt-6 w-full bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 transition font-medium"
            >
              Entendi!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
