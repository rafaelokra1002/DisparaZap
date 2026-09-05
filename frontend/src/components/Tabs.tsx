'use client';

interface TabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'overview', label: 'Visão Geral', icon: '📊' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '📱' },
  { id: 'ads', label: 'Meus Anúncios', icon: '📝' },
  { id: 'clicks', label: 'Cliques', icon: '🖱️' },
  { id: 'history', label: 'Histórico', icon: '📋' },
];

export default function Tabs({ activeTab, onTabChange }: TabsProps) {
  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex gap-1 -mb-px" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all
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
