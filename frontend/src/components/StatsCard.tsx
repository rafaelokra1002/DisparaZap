'use client';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  subtitle?: string;
}

export default function StatsCard({ title, value, icon, color, subtitle }: StatsCardProps) {
  const colorClasses: Record<string, string> = {
    green: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    teal: 'bg-teal-50 border-teal-200 text-teal-700',
  };

  return (
    <div className={`rounded-xl border-2 p-5 ${colorClasses[color] || colorClasses.green}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-3xl font-bold">{value.toLocaleString()}</p>
      <p className="text-sm font-medium mt-1 opacity-80">{title}</p>
      {subtitle && <p className="text-xs mt-1 opacity-60">{subtitle}</p>}
    </div>
  );
}
