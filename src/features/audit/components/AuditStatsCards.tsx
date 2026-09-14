import React from 'react';
import { AuditLogEntry } from '@/types';
import { Activity, Calendar, PlusCircle, Edit3, Trash2 } from 'lucide-react';

interface AuditStatsCardsProps {
  logs: AuditLogEntry[];
}

export const AuditStatsCards: React.FC<AuditStatsCardsProps> = ({ logs }) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  const total = logs.length;
  const todayCount = logs.filter((l) => l.createdAt.startsWith(todayStr)).length;
  const createdCount = logs.filter((l) => l.action === 'CREATE').length;
  const updatedCount = logs.filter((l) => l.action === 'UPDATE').length;
  const deletedCount = logs.filter((l) => l.action === 'DELETE').length;

  const cards = [
    {
      title: 'Total Activities',
      value: total.toLocaleString('en-IN'),
      icon: Activity,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
    },
    {
      title: "Today's Activities",
      value: todayCount.toLocaleString('en-IN'),
      icon: Calendar,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/20',
    },
    {
      title: 'Created',
      value: createdCount.toLocaleString('en-IN'),
      icon: PlusCircle,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
    },
    {
      title: 'Updated',
      value: updatedCount.toLocaleString('en-IN'),
      icon: Edit3,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
    },
    {
      title: 'Deleted',
      value: deletedCount.toLocaleString('en-IN'),
      icon: Trash2,
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="bg-[#111726] border border-[#1F293D] rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400 truncate">{card.title}</span>
              <div className={`p-1.5 rounded-lg ${card.bgColor} ${card.borderColor} border`}>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-100 tracking-tight">{card.value}</div>
          </div>
        );
      })}
    </div>
  );
};
