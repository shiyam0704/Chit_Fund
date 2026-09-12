import React from 'react';

export interface StatusBadgeProps {
  status: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '', size = 'sm' }) => {
  const getBadgeStyle = () => {
    switch (status) {
      case 'Active':
      case 'Paid':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'Pending':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'Partial':
      case 'Partial Paid':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'Overdue':
      case 'Inactive':
      case 'Disabled':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'Completed':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  const sizeClass = size === 'md' ? 'px-3 py-1 text-xs' : size === 'lg' ? 'px-3.5 py-1.5 text-sm' : 'px-2.5 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold border ${sizeClass} ${getBadgeStyle()} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75" />
      {status}
    </span>
  );
};
