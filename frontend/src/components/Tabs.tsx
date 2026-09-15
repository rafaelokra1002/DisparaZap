'use client';

interface TabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  showWhatsApp?: boolean;
}

const baseTabs = [
  { id: 'overview', label: 'Visão Geral', icon: '📊' },
  { id: 'ads', label: 'Meus Anúncios', icon: '📝' },
  { id: 'clicks', label: 'Cliques', icon: '🖱️' },
  { id: 'history', label: 'Histórico', icon: '📋' },
];

export default function Tabs({ activeTab, onTabChange, showWhatsApp = false }: TabsProps) {
  const tabs = showWhatsApp
    ? [...baseTabs, { id: 'whatsapp', label: 'WhatsApp', icon: '📱' }]
    : baseTabs;

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex gap-1.5 overflow-x-auto py-3" aria-label="Tabs">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="text-base leading-none">{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
