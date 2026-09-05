'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Tabs from '@/components/Tabs';
import OverviewTab from '@/components/OverviewTab';
import AdsTab from '@/components/AdsTab';
import ClicksTab from '@/components/ClicksTab';
import HistoryTab from '@/components/HistoryTab';
import WhatsAppTab from '@/components/WhatsAppTab';

export default function HomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('disparazap_token');
    if (!token) {
      router.push('/login');
      return;
    }

    const user = localStorage.getItem('disparazap_user');
    if (user) {
      try {
        const parsed = JSON.parse(user);
        setUserName(parsed.name || 'Usuário');
      } catch {
        setUserName('Usuário');
      }
    }
    setLoading(false);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('disparazap_token');
    localStorage.removeItem('disparazap_user');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  function renderTab() {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab />;
      case 'whatsapp':
        return <WhatsAppTab />;
      case 'ads':
        return <AdsTab />;
      case 'clicks':
        return <ClicksTab />;
      case 'history':
        return <HistoryTab />;
      default:
        return <OverviewTab />;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userName={userName} onLogout={handleLogout} />
      <Tabs activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderTab()}
      </main>
    </div>
  );
}
