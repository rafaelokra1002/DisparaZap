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
        <nav className="-mb-px flex gap-1 overflow-x-auto pb-1" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-all sm:px-4
                ${
                  activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
