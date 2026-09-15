'use client';

import { useState } from 'react';
import { LogOut, BookOpen } from 'lucide-react';

interface HeaderProps {
  userName: string;
  onLogout?: () => void;
}

export default function Header({ userName, onLogout }: HeaderProps) {
  const [showTutorial, setShowTutorial] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:py-0">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-600">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white">
                  <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20Zm4.4-5.6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.1-.2 0-.4.1-.5l.4-.5.2-.4v-.4l-.8-1.8c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4 0-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.4c.1.2 1.7 2.6 4.1 3.6 1.5.6 2 .7 2.7.6.5-.1 1.4-.6 1.5-1.1.2-.5.2-1 .1-1.1l-.3-.2Z" />
                </svg>
              </span>
              <span className="font-display text-xl font-extrabold text-gray-900">DisparaZap</span>
            </div>

            {/* Ações */}
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap sm:gap-3">
              <span className="mr-auto min-w-0 truncate text-sm text-gray-500 sm:mr-0">
                Olá, <strong className="text-gray-800">{userName}</strong>
              </span>

              <button
                onClick={() => setShowTutorial(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                <BookOpen className="h-4 w-4 text-emerald-600" />
                Tutorial
              </button>

              <button
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Modal Tutorial */}
      {showTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6">
            <h2 className="font-display mb-4 text-xl font-bold text-gray-900">Como usar o DisparaZap</h2>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">1</span>
                <p>Conecte seu WhatsApp na aba <strong>WhatsApp</strong> escaneando o QR Code.</p>
              </div>
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">2</span>
                <p>Crie seu anúncio na aba <strong>Meus Anúncios</strong> com texto e/ou imagem.</p>
              </div>
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">3</span>
                <p>Escolha os grupos e clique em <strong>Disparar</strong> para enviar.</p>
              </div>
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">4</span>
                <p>Acompanhe os resultados nas abas <strong>Visão Geral</strong>, <strong>Cliques</strong> e <strong>Histórico</strong>.</p>
              </div>
            </div>
            <button
              onClick={() => setShowTutorial(false)}
              className="mt-6 w-full rounded-lg bg-emerald-600 py-2.5 font-medium text-white transition hover:bg-emerald-700"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
