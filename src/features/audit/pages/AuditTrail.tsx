import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AuditLogEntry } from '@/types';
import {
  getAuditLogs,
  exportAuditLogsToCSV,
  exportAuditLogsToPDF,
} from '@/shared/services/auditService';
import { useAuth, PERMISSIONS } from '@/features/auth';
import { useChit } from '@/shared/context';
import { AuditStatsCards } from '../components/AuditStatsCards';
import { AuditFilterBar, AuditFiltersState } from '../components/AuditFilterBar';
import { AuditDetailModal } from '../components/AuditDetailModal';
import {
  Download,
  FileSpreadsheet,
  Printer,
  ChevronLeft,
  ChevronRight,
  Eye,
  ShieldAlert,
  Inbox,
} from 'lucide-react';

export const AuditTrail: React.FC = () => {
  const { hasPermission, isSuperAdmin } = useAuth();
  const { companySettings } = useChit();

  const canView = isSuperAdmin() || hasPermission(PERMISSIONS.AUDIT_TRAIL_VIEW);
  const canExport = isSuperAdmin() || hasPermission(PERMISSIONS.AUDIT_TRAIL_EXPORT);
  const canPrint = isSuperAdmin() || hasPermission(PERMISSIONS.AUDIT_TRAIL_PRINT);

  const [logs, setLogs] = useState<AuditLogEntry[]>(() => getAuditLogs());
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  // Pagination state: Default 25 records per page
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Filter state
  const [filters, setFilters] = useState<AuditFiltersState>({
    search: '',
    dateRange: 'All',
    startDate: '',
    endDate: '',
    user: '',
    role: '',
    action: '',
    module: '',
    status: '',
  });

  // Reload logs and subscribe to live custom audit events and cross-tab storage updates
  const loadLogs = useCallback(() => {
    setLogs(getAuditLogs());
  }, []);

  useEffect(() => {
    loadLogs();
    const handleUpdate = () => loadLogs();
    window.addEventListener('chitfund_audit_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('chitfund_audit_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [loadLogs]);

  // Unique list of actors across all logs
  const availableUsers = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.userName) set.add(l.userName);
    });
    return Array.from(set).sort();
  }, [logs]);

  const handleFilterChange = (key: keyof AuditFiltersState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to page 1 on filter
  };

  const handleResetFilters = () => {
    setFilters({
      search: '',
      dateRange: 'All',
      startDate: '',
      endDate: '',
      user: '',
      role: '',
      action: '',
      module: '',
      status: '',
    });
    setCurrentPage(1);
  };

  // Filter evaluation logic
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Search Query
      if (filters.search) {
        const query = filters.search.toLowerCase().trim();
        const matchesUser = (log.userName || '').toLowerCase().includes(query);
        const matchesRecord =
          (log.recordId || '').toLowerCase().includes(query) ||
          (log.recordName || '').toLowerCase().includes(query);
        const matchesAction = (log.action || '').toLowerCase().includes(query);
        const matchesModule = (log.module || '').toLowerCase().includes(query);
        const matchesDesc = (log.description || '').toLowerCase().includes(query);
        const matchesRole = (log.userRole || '').toLowerCase().includes(query);
        if (!matchesUser && !matchesRecord && !matchesAction && !matchesModule && !matchesDesc && !matchesRole) {
          return false;
        }
      }

      // 2. User
      if (filters.user && log.userName !== filters.user) {
        return false;
      }

      // 3. Role
      if (filters.role && log.userRole !== filters.role) {
        return false;
      }

      // 4. Action
      if (filters.action && log.action !== filters.action) {
        return false;
      }

      // 5. Module
      if (filters.module && log.module !== filters.module) {
        return false;
      }

      // 6. Status
      if (filters.status && log.status !== filters.status) {
        return false;
      }

      // 7. Date Range Filter
      const logDate = new Date(log.createdAt);
      const now = new Date();

      if (filters.dateRange === 'Today') {
        const todayStr = now.toISOString().slice(0, 10);
        if (!log.createdAt.startsWith(todayStr)) return false;
      } else if (filters.dateRange === 'Yesterday') {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        const yStr = y.toISOString().slice(0, 10);
        if (!log.createdAt.startsWith(yStr)) return false;
      } else if (filters.dateRange === 'Last 7 Days') {
        const limit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (logDate < limit) return false;
      } else if (filters.dateRange === 'Last 30 Days') {
        const limit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (logDate < limit) return false;
      } else if (filters.dateRange === 'This Month') {
        if (logDate.getMonth() !== now.getMonth() || logDate.getFullYear() !== now.getFullYear()) {
          return false;
        }
      } else if (filters.dateRange === 'Last Month') {
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        if (
          logDate.getMonth() !== lastMonthDate.getMonth() ||
          logDate.getFullYear() !== lastMonthDate.getFullYear()
        ) {
          return false;
        }
      } else if (filters.dateRange === 'Custom') {
        if (filters.startDate) {
          const s = new Date(filters.startDate + 'T00:00:00');
          if (logDate < s) return false;
        }
        if (filters.endDate) {
          const e = new Date(filters.endDate + 'T23:59:59');
          if (logDate > e) return false;
        }
      }

      return true;
    });
  }, [logs, filters]);

  // Pagination calculation
  const totalRecords = filteredLogs.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const clampedPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedLogs = useMemo(() => {
    const start = (clampedPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, clampedPage, pageSize]);

  // Export handlers (export only filtered records)
  const handleExportCSV = () => {
    exportAuditLogsToCSV(filteredLogs);
  };

  const handleExportPDF = () => {
    exportAuditLogsToPDF(filteredLogs, companySettings.companyName || 'Chit Fund Management');
  };

  const handlePrint = () => {
    window.print();
  };

  const getActionBadgeClass = (action: string) => {
    if (action === 'CREATE') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (action === 'UPDATE') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (action === 'DELETE') return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    if (action.startsWith('LOGIN')) return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    if (action.includes('PASSWORD') || action === 'LOGOUT') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    if (action === 'CANCEL' || action === 'REVERSE') return 'bg-red-500/10 text-red-400 border-red-500/20';
    if (action === 'EXPORT' || action === 'PRINT') return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    return 'bg-slate-500/10 text-slate-300 border-slate-500/20';
  };

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-100">Access Restricted</h2>
        <p className="text-sm text-slate-400 max-w-md mt-1.5">
          You do not have permission to view the system Audit Trail. Please contact your Super Admin to request access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1F293D] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            <span>Audit Trail</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold font-mono">
              Live Feed
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track all user activities and changes made in the system.
          </p>
        </div>

        {/* Action Export Buttons */}
        <div className="flex items-center gap-2.5">
          {canExport && (
            <>
              <button
                onClick={handleExportCSV}
                title="Export Filtered Logs as Excel / CSV"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#111726] border border-[#1F293D] text-xs font-semibold text-slate-200 hover:bg-[#182032] hover:text-white transition-colors cursor-pointer shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Export Excel</span>
              </button>

              <button
                onClick={handleExportPDF}
                title="Export Filtered Logs as PDF"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#111726] border border-[#1F293D] text-xs font-semibold text-slate-200 hover:bg-[#182032] hover:text-white transition-colors cursor-pointer shadow-sm"
              >
                <Download className="w-4 h-4 text-blue-400" />
                <span>Export PDF</span>
              </button>
            </>
          )}

          {canPrint && (
            <button
              onClick={handlePrint}
              title="Print Current View"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#111726] border border-[#1F293D] text-xs font-semibold text-slate-200 hover:bg-[#182032] hover:text-white transition-colors cursor-pointer shadow-sm"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span>Print</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <AuditStatsCards logs={logs} />

      {/* Filter and Search Bar */}
      <AuditFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
        availableUsers={availableUsers}
      />

      {/* Audit Log Table Container */}
      <div className="bg-[#111726] border border-[#1F293D] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0D121F] text-slate-400 border-b border-[#1F293D] uppercase tracking-wider font-semibold text-[11px]">
                <th className="py-3 px-4">DATE & TIME</th>
                <th className="py-3 px-4">USER</th>
                <th className="py-3 px-4">ROLE</th>
                <th className="py-3 px-4">ACTION</th>
                <th className="py-3 px-4">MODULE</th>
                <th className="py-3 px-4">RECORD</th>
                <th className="py-3 px-4">DESCRIPTION</th>
                <th className="py-3 px-4 text-center">STATUS</th>
                <th className="py-3 px-4 text-center">VIEW</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F293D]/60 text-slate-200">
              {paginatedLogs.length > 0 ? (
                paginatedLogs.map((log) => {
                  const logDate = new Date(log.createdAt);
                  const datePart = logDate.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  });
                  const timePart = logDate.toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  });

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-[#182032]/60 transition-colors group cursor-default"
                    >
                      {/* DATE & TIME (2 lines: date on top, time below) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="text-slate-200 font-semibold text-xs">{datePart}</div>
                        <div className="text-slate-400 text-[11px] font-mono mt-0.5">{timePart}</div>
                      </td>

                      {/* USER */}
                      <td className="py-3 px-4 font-semibold text-slate-100 whitespace-nowrap">
                        {log.userName}
                      </td>

                      {/* ROLE */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                        <span className="px-2 py-0.5 rounded bg-slate-800/60 border border-slate-700/40 text-[11px]">
                          {log.userRole}
                        </span>
                      </td>

                      {/* ACTION */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded font-semibold text-[10px] border tracking-wider ${getActionBadgeClass(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>

                      {/* MODULE */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-300 font-medium">
                        {log.module}
                      </td>

                      {/* RECORD */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-400">
                        {log.recordId || log.recordName || '—'}
                      </td>

                      {/* DESCRIPTION */}
                      <td className="py-3 px-4 max-w-xs md:max-w-sm truncate text-slate-300" title={log.description}>
                        {log.description}
                      </td>

                      {/* STATUS */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold border ${
                            log.status === 'Success'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>

                      {/* VIEW BUTTON */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 text-blue-400 hover:text-blue-300 font-medium text-xs transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Inbox className="w-8 h-8 text-slate-500" />
                      <p className="text-sm font-medium text-slate-300">No activity logs found</p>
                      <p className="text-xs text-slate-500">
                        Try adjusting your search query, module filter, or date range.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Footer Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-[#1F293D] bg-[#0D121F]/60 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              Showing {totalRecords === 0 ? 0 : (clampedPage - 1) * pageSize + 1}–
              {Math.min(clampedPage * pageSize, totalRecords)} of {totalRecords.toLocaleString('en-IN')} activities
            </span>
            <div className="flex items-center gap-1.5 ml-3">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-0.5 bg-[#111726] border border-[#1F293D] rounded text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Page Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={clampedPage <= 1}
              className="p-1.5 rounded-lg border border-[#1F293D] bg-[#111726] text-slate-300 hover:bg-[#182032] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 text-slate-300 font-medium">
              Page {clampedPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={clampedPage >= totalPages}
              className="p-1.5 rounded-lg border border-[#1F293D] bg-[#111726] text-slate-300 hover:bg-[#182032] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Details Inspection Modal */}
      {selectedLog && (
        <AuditDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
};
