import React from 'react';
import { Search, RotateCcw, Calendar, Filter } from 'lucide-react';

export interface AuditFiltersState {
  search: string;
  dateRange: string;
  startDate: string;
  endDate: string;
  user: string;
  role: string;
  action: string;
  module: string;
  status: string;
}

interface AuditFilterBarProps {
  filters: AuditFiltersState;
  onFilterChange: (key: keyof AuditFiltersState, value: string) => void;
  onReset: () => void;
  availableUsers: string[];
}

export const AuditFilterBar: React.FC<AuditFilterBarProps> = ({
  filters,
  onFilterChange,
  onReset,
  availableUsers,
}) => {
  const isFiltered =
    Boolean(filters.search) ||
    (filters.dateRange !== 'All' && Boolean(filters.dateRange)) ||
    Boolean(filters.user) ||
    Boolean(filters.role) ||
    Boolean(filters.action) ||
    Boolean(filters.module) ||
    Boolean(filters.status);

  const actionOptions = [
    { label: 'All Actions', value: '' },
    { label: 'CREATE', value: 'CREATE' },
    { label: 'UPDATE', value: 'UPDATE' },
    { label: 'DELETE', value: 'DELETE' },
    { label: 'LOGIN_SUCCESS', value: 'LOGIN_SUCCESS' },
    { label: 'LOGIN_FAILED', value: 'LOGIN_FAILED' },
    { label: 'LOGOUT', value: 'LOGOUT' },
    { label: 'PASSWORD_CHANGED', value: 'PASSWORD_CHANGED' },
    { label: 'PASSWORD_RESET', value: 'PASSWORD_RESET' },
    { label: 'CANCEL', value: 'CANCEL' },
    { label: 'REVERSE', value: 'REVERSE' },
    { label: 'EXPORT', value: 'EXPORT' },
    { label: 'PRINT', value: 'PRINT' },
  ];

  const moduleOptions = [
    { label: 'All Modules', value: '' },
    { label: 'Authentication', value: 'Authentication' },
    { label: 'Members', value: 'Members' },
    { label: 'Chits', value: 'Chits' },
    { label: 'Payments', value: 'Payments' },
    { label: 'Collections', value: 'Collections' },
    { label: 'Receipts', value: 'Receipts' },
    { label: 'Expenses', value: 'Expenses' },
    { label: 'Users', value: 'Users' },
    { label: 'Staff', value: 'Staff' },
    { label: 'Reports', value: 'Reports' },
    { label: 'Settings', value: 'Settings' },
  ];

  const roleOptions = [
    { label: 'All Roles', value: '' },
    { label: 'Super Admin', value: 'Super Admin' },
    { label: 'Admin / Manager', value: 'Admin / Manager' },
    { label: 'Staff', value: 'Staff' },
    { label: 'Custom Role', value: 'Custom Role' },
  ];

  const dateRangeOptions = [
    { label: 'All Dates', value: 'All' },
    { label: 'Today', value: 'Today' },
    { label: 'Yesterday', value: 'Yesterday' },
    { label: 'Last 7 Days', value: 'Last 7 Days' },
    { label: 'Last 30 Days', value: 'Last 30 Days' },
    { label: 'This Month', value: 'This Month' },
    { label: 'Last Month', value: 'Last Month' },
    { label: 'Custom Range', value: 'Custom' },
  ];

  return (
    <div className="bg-[#111726] border border-[#1F293D] rounded-xl p-4 mb-5 shadow-sm space-y-3.5">
      {/* Search and Primary Filters Row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Search Input */}
        <div className="md:col-span-4 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search user, member, record ID, action..."
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 bg-[#0D121F] border border-[#1F293D] rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Date Range Selector */}
        <div className="md:col-span-3">
          <div className="relative">
            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={filters.dateRange}
              onChange={(e) => onFilterChange('dateRange', e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-[#0D121F] border border-[#1F293D] rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer"
            >
              {dateRangeOptions.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#0D121F] text-slate-200">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Module Filter */}
        <div className="md:col-span-2">
          <select
            value={filters.module}
            onChange={(e) => onFilterChange('module', e.target.value)}
            className="w-full px-3 py-2 bg-[#0D121F] border border-[#1F293D] rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer"
          >
            {moduleOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#0D121F] text-slate-200">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Action Filter */}
        <div className="md:col-span-2">
          <select
            value={filters.action}
            onChange={(e) => onFilterChange('action', e.target.value)}
            className="w-full px-3 py-2 bg-[#0D121F] border border-[#1F293D] rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer"
          >
            {actionOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#0D121F] text-slate-200">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Reset Button */}
        <div className="md:col-span-1 flex items-center">
          {isFiltered && (
            <button
              onClick={onReset}
              title="Reset Filters"
              className="w-full h-full py-2 px-3 bg-[#1F293D]/60 hover:bg-[#1F293D] text-slate-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-[#2D3A54]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Secondary Row: User, Role, Status & Custom Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-[#1F293D]/60">
        {/* User Filter */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">User</label>
          <select
            value={filters.user}
            onChange={(e) => onFilterChange('user', e.target.value)}
            className="w-full px-3 py-1.5 bg-[#0D121F] border border-[#1F293D] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
          >
            <option value="">All Users</option>
            {availableUsers.map((u) => (
              <option key={u} value={u} className="bg-[#0D121F] text-slate-200">
                {u}
              </option>
            ))}
          </select>
        </div>

        {/* Role Filter */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">Role</label>
          <select
            value={filters.role}
            onChange={(e) => onFilterChange('role', e.target.value)}
            className="w-full px-3 py-1.5 bg-[#0D121F] border border-[#1F293D] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
          >
            {roleOptions.map((r) => (
              <option key={r.value} value={r.value} className="bg-[#0D121F] text-slate-200">
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">Status</label>
          <select
            value={filters.status}
            onChange={(e) => onFilterChange('status', e.target.value)}
            className="w-full px-3 py-1.5 bg-[#0D121F] border border-[#1F293D] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="Success">Success</option>
            <option value="Failed">Failed</option>
          </select>
        </div>

        {/* Custom Date Pickers */}
        {filters.dateRange === 'Custom' ? (
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Custom Dates</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => onFilterChange('startDate', e.target.value)}
                className="w-1/2 px-2 py-1 bg-[#0D121F] border border-[#1F293D] rounded text-xs text-slate-200 focus:outline-none"
              />
              <span className="text-slate-500 text-xs">to</span>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => onFilterChange('endDate', e.target.value)}
                className="w-1/2 px-2 py-1 bg-[#0D121F] border border-[#1F293D] rounded text-xs text-slate-200 focus:outline-none"
              />
            </div>
          </div>
        ) : (
          <div className="flex items-end">
            <div className="text-[11px] text-slate-500 italic pb-1.5 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" />
              <span>Filter events across all system modules</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
