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
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <MessageSquare className="w-8 h-8" />
              <h1 className="text-xl font-bold">DisparaZap</h1>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-emerald-100">
                Olá, <strong>{userName}</strong>
              </span>

              <button
                onClick={() => setShowTutorial(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-white/20 rounded-lg text-sm hover:bg-white/30 transition"
              >
                <BookOpen className="w-4 h-4" />
                Tutorial
              </button>

              <button
                onClick={onLogout}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-500/80 rounded-lg text-sm hover:bg-red-500 transition"
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
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl">
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
