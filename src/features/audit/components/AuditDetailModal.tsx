import React from 'react';
import { AuditLogEntry } from '@/types';
import {
  X,
  Clock,
  User,
  Shield,
  Globe,
  Laptop,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  FileText,
  KeyRound,
  Trash2,
  PlusCircle,
  Database,
} from 'lucide-react';

interface AuditDetailModalProps {
  log: AuditLogEntry | null;
  onClose: () => void;
}

export const AuditDetailModal: React.FC<AuditDetailModalProps> = ({ log, onClose }) => {
  if (!log) return null;

  const getActionBadgeClass = (action: string) => {
    if (action === 'CREATE') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (action === 'UPDATE') return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    if (action === 'DELETE') return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    if (action.startsWith('LOGIN')) return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    if (action.includes('PASSWORD') || action === 'LOGOUT') return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
  };

  const isAuthAction =
    log.module === 'Authentication' ||
    ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGED', 'PASSWORD_RESET'].includes(log.action);

  // Helper to render record data objects as clean key-value rows
  const renderRecordData = (data: Record<string, any>) => {
    const entries = Object.entries(data).filter(([key]) => {
      return !['password', 'passwordHash', 'schedule', 'auctions', 'monthStatuses', 'monthPayouts', 'monthOverrides', 'monthMemberAssignments'].includes(key);
    });

    if (entries.length === 0) {
      return <div className="text-slate-400 text-xs italic">No additional attributes recorded.</div>;
    }

    return (
      <div className="border border-[#1F293D] rounded-xl overflow-hidden bg-[#0D121F]">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#141B2D] text-slate-400 border-b border-[#1F293D] font-semibold">
            <tr>
              <th className="py-2.5 px-4 w-1/3">Property</th>
              <th className="py-2.5 px-4 w-2/3">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1F293D]/60 text-slate-200">
            {entries.map(([key, value]) => {
              let displayVal = String(value ?? '—');
              if (typeof value === 'object' && value !== null) {
                displayVal = JSON.stringify(value);
              }
              return (
                <tr key={key} className="hover:bg-slate-800/20">
                  <td className="py-2 px-4 font-semibold text-slate-300 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                  </td>
                  <td className="py-2 px-4 font-mono text-slate-200 break-all">{displayVal}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#111726] border border-[#1F293D] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F293D] bg-[#0D121F]/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">Audit Activity Details</h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getActionBadgeClass(log.action)}`}>
                  {log.action}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                    log.status === 'Success'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}
                >
                  {log.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Activity ID: {log.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#1F293D] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar text-sm">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0D121F] p-4 rounded-xl border border-[#1F293D]">
            <div>
              <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mb-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Date & Time
              </span>
              <span className="text-xs font-semibold text-slate-200 block">
                {new Date(log.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {new Date(log.createdAt).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mb-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                User & Role
              </span>
              <span className="text-xs font-semibold text-slate-200 block truncate">{log.userName}</span>
              <span className="text-[10px] text-blue-400 font-medium">{log.userRole}</span>
            </div>

            <div>
              <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mb-1">
                <Shield className="w-3.5 h-3.5 text-slate-400" />
                Module
              </span>
              <span className="text-xs font-semibold text-slate-200 block truncate">{log.module}</span>
              <span className="text-[10px] text-slate-400 font-mono block truncate">Action: {log.action}</span>
            </div>

            <div>
              <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mb-1">
                <Database className="w-3.5 h-3.5 text-slate-400" />
                Record
              </span>
              <span className="text-xs font-mono font-semibold text-slate-200 block truncate">
                {log.recordId || '—'}
              </span>
              <span className="text-[10px] text-slate-400 block truncate">{log.recordName || '—'}</span>
            </div>
          </div>

          {/* Network & Device Info Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#0D121F] p-3.5 rounded-xl border border-[#1F293D]">
            <div className="flex items-center gap-2.5">
              <Globe className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider block">IP Address</span>
                <span className="text-xs font-mono font-semibold text-slate-200">{log.ipAddress || '127.0.0.1'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Laptop className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider block">Device / Browser</span>
                <span className="text-xs text-slate-300 block truncate">{log.userAgent || 'Web Browser'}</span>
              </div>
            </div>
          </div>

          {/* Description & Failure Details */}
          <div className="bg-[#0D121F] p-4 rounded-xl border border-[#1F293D]">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Description</h4>
            <p className="text-sm text-slate-200 font-medium leading-relaxed">{log.description}</p>
            {log.failureReason && (
              <div className="mt-3 flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-rose-200 block mb-0.5">Failure Reason</span>
                  <span>{log.failureReason}</span>
                </div>
              </div>
            )}
          </div>

          {/* UPDATE Action: CHANGE DETAILS Table */}
          {log.action === 'UPDATE' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <span>CHANGE DETAILS</span>
                  {log.changedFields && log.changedFields.length > 0 && (
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-semibold border border-blue-500/20">
                      {log.changedFields.length} field(s) modified
                    </span>
                  )}
                </h4>
              </div>

              {log.changedFields && log.changedFields.length > 0 ? (
                <div className="border border-[#1F293D] rounded-xl overflow-hidden bg-[#0D121F]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#141B2D] text-slate-400 border-b border-[#1F293D] font-semibold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2.5 px-4 w-1/3">Field</th>
                        <th className="py-2.5 px-4 w-1/3">Previous Value</th>
                        <th className="py-2.5 px-4 w-1/3">New Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1F293D]/60 text-slate-200">
                      {log.changedFields.map((change, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/20 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-slate-300">
                            {change.label || change.field}
                            <span className="block text-[10px] text-slate-500 font-mono">{change.field}</span>
                          </td>
                          <td className="py-2.5 px-4 text-rose-300/90 font-mono break-all bg-rose-950/15">
                            {String(change.previousValue)}
                          </td>
                          <td className="py-2.5 px-4 text-emerald-300/90 font-mono break-all bg-emerald-950/15">
                            <div className="flex items-center gap-1.5">
                              <ArrowRight className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span>{String(change.newValue)}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 bg-[#0D121F] border border-[#1F293D] rounded-xl text-xs text-slate-400 italic">
                  Specific field diffs not captured for this update event.
                </div>
              )}
            </div>
          )}

          {/* CREATE Action: Created Record Information */}
          {log.action === 'CREATE' && (
            <div>
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Created Record Information</span>
              </h4>
              {log.afterData ? (
                renderRecordData(log.afterData)
              ) : (
                <div className="p-3 bg-[#0D121F] border border-[#1F293D] rounded-xl text-xs text-slate-400">
                  {log.description}
                </div>
              )}
            </div>
          )}

          {/* DELETE Action: Deleted Record Snapshot */}
          {log.action === 'DELETE' && (
            <div>
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Deleted Record Snapshot</span>
              </h4>
              {log.beforeData ? (
                renderRecordData(log.beforeData)
              ) : (
                <div className="p-3 bg-[#0D121F] border border-rose-500/20 rounded-xl text-xs text-slate-400">
                  {log.description}
                </div>
              )}
            </div>
          )}

          {/* LOGIN / Auth Actions: Login Session Information */}
          {isAuthAction && (
            <div>
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5 text-purple-400" />
                <span>Authentication Information</span>
              </h4>
              <div className="bg-[#0D121F] border border-purple-500/20 rounded-xl p-3.5 text-xs space-y-2">
                <div className="flex justify-between border-b border-[#1F293D]/60 pb-1.5">
                  <span className="text-slate-400">Session User:</span>
                  <span className="font-semibold text-slate-200">{log.userName}</span>
                </div>
                <div className="flex justify-between border-b border-[#1F293D]/60 pb-1.5">
                  <span className="text-slate-400">Assigned Role:</span>
                  <span className="font-semibold text-slate-200">{log.userRole}</span>
                </div>
                <div className="flex justify-between border-b border-[#1F293D]/60 pb-1.5">
                  <span className="text-slate-400">IP Address:</span>
                  <span className="font-mono text-slate-200">{log.ipAddress}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Client Agent:</span>
                  <span className="text-slate-300 truncate max-w-xs">{log.userAgent}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#1F293D] bg-[#0D121F]/90 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Immutable & Cryptographically Sealed System Log</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#1F293D] hover:bg-[#2D3A54] text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
