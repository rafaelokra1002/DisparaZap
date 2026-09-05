'use client';

import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ text = 'Carregando...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}
