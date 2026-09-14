import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  HardDriveDownload,
  ShieldAlert,
  CheckCircle2,
  FileCheck,
  AlertTriangle,
  History,
  Download,
  RefreshCw,
  Clock,
  User,
  Shield,
  UploadCloud,
  FileText,
  Lock,
} from 'lucide-react';
import { useAuth, PERMISSIONS } from '@/features/auth';
import { useChit } from '@/shared/context';
import {
  createSystemBackup,
  downloadBackupFile,
  validateBackupFile,
  createPreRestoreSafetyBackup,
  restoreSystemBackup,
  getBackupHistory,
} from '@/shared/services/backupService';
import { BackupMetadata, BackupPackage, BackupHistoryItem } from '@/types';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'backup' | 'restore' | 'history';
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'backup',
}) => {
  const { currentUser, isSuperAdmin, hasPermission } = useAuth();
  const { addToast } = useChit();

  const canCreate = isSuperAdmin() || hasPermission(PERMISSIONS.BACKUP_CREATE);
  const canRestore = isSuperAdmin() || hasPermission(PERMISSIONS.BACKUP_RESTORE);
  const canViewHistory = isSuperAdmin() || hasPermission(PERMISSIONS.BACKUP_VIEW);

  const [activeTab, setActiveTab] = useState<'backup' | 'restore' | 'history'>(initialTab);

  // Backup state
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgressMsg, setBackupProgressMsg] = useState('');
  const [backupProgressPercent, setBackupProgressPercent] = useState(0);
  const [backupSuccessResult, setBackupSuccessResult] = useState<{
    fileName: string;
    sizeFormatted: string;
  } | null>(null);

  // Restore state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [restorePreview, setRestorePreview] = useState<BackupMetadata | null>(null);
  const [validatedPackage, setValidatedPackage] = useState<BackupPackage | null>(null);
  const [confirmRiskChecked, setConfirmRiskChecked] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgressMsg, setRestoreProgressMsg] = useState('');
  const [restoreSuccessMsg, setRestoreSuccessMsg] = useState<string | null>(null);

  // History state
  const [historyList, setHistoryList] = useState<BackupHistoryItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setBackupSuccessResult(null);
      setValidationError(null);
      setRestorePreview(null);
      setValidatedPackage(null);
      setSelectedFile(null);
      setConfirmRiskChecked(false);
      setRestoreSuccessMsg(null);
      setHistoryList(getBackupHistory());
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const currentActor = {
    id: currentUser?.id,
    name: currentUser?.name || 'Super Admin',
    role: currentUser?.role || 'Super Admin',
  };

  // Handle Backup Creation
  const handleCreateBackup = async () => {
    if (!canCreate) {
      addToast('Permission Denied', 'You do not have permission to create system backups.', 'error');
      return;
    }

    try {
      setIsBackingUp(true);
      setBackupProgressMsg('Initializing backup...');
      setBackupProgressPercent(5);

      const result = await createSystemBackup(
        currentActor,
        (msg, pct) => {
          setBackupProgressMsg(msg);
          if (pct !== undefined) setBackupProgressPercent(pct);
        }
      );

      // Download file to user device
      downloadBackupFile(result.jsonString, result.fileName);

      setBackupSuccessResult({
        fileName: result.fileName,
        sizeFormatted: result.sizeFormatted,
      });

      setHistoryList(getBackupHistory());
      addToast('Backup Created', `Successfully saved ${result.fileName}`, 'success');
    } catch (err: any) {
      addToast('Backup Failed', err?.message || 'Could not create system backup', 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Handle File Selected for Restore
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setValidationError(null);
    setRestorePreview(null);
    setValidatedPackage(null);
    setConfirmRiskChecked(false);
    setIsValidating(true);

    try {
      const content = await file.text();
      const validation = await validateBackupFile(content);

      if (!validation.isValid || !validation.backupPackage || !validation.preview) {
        setValidationError(validation.error || 'Invalid backup file structure.');
      } else {
        setRestorePreview(validation.preview);
        setValidatedPackage(validation.backupPackage);
      }
    } catch (err: any) {
      setValidationError('Failed to read backup file: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsValidating(false);
    }
  };

  // Handle Restore Execution
  const handleExecuteRestore = async () => {
    if (!canRestore) {
      addToast('Permission Denied', 'Only Super Admin can restore system backups.', 'error');
      return;
    }
    if (!validatedPackage) {
      addToast('Error', 'Please select a valid backup package.', 'error');
      return;
    }
    if (!confirmRiskChecked) {
      addToast('Confirmation Required', 'You must acknowledge the replacement risk checkbox.', 'warning');
      return;
    }

    try {
      setIsRestoring(true);
      setRestoreProgressMsg('Creating automatic pre-restore safety backup...');

      // 1. Mandatory Safety Backup
      let safetyBackupName = '';
      try {
        const safetyResult = await createPreRestoreSafetyBackup(currentActor);
        safetyBackupName = safetyResult.fileName;
      } catch (safetyErr: any) {
        throw new Error(
          'Automated safety backup failed! Restore was safely aborted to protect your data. ' +
            (safetyErr?.message || '')
        );
      }

      setRestoreProgressMsg(`Safety backup (${safetyBackupName}) secured. Restoring database tables...`);
      await new Promise((res) => setTimeout(res, 300));

      // 2. Perform Restore
      const restoreResult = await restoreSystemBackup(validatedPackage, currentActor);
      setRestoreSuccessMsg(restoreResult.message);
      setHistoryList(getBackupHistory());
      addToast('System Restored', 'Database restored successfully!', 'success');
    } catch (err: any) {
      console.error(err);
      setValidationError(err?.message || 'Restore procedure failed.');
      addToast('Restore Failed', err?.message || 'Could not restore backup', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#111726] border border-[#1F293D] rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F293D] bg-[#0D121F]/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400">
              <HardDriveDownload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">System Backup & Restore</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Securely snapshot, download, or restore complete business data
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#1F293D] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-0 border-b border-[#1F293D] bg-[#0D121F]/50">
          <button
            onClick={() => setActiveTab('backup')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'backup'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Backup
          </button>

          {canRestore && (
            <button
              onClick={() => setActiveTab('restore')}
              className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'restore'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Restore Backup
            </button>
          )}

          {canViewHistory && (
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'history'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Backup History ({historyList.length})
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar text-sm space-y-5">
          {/* TAB 1: CREATE BACKUP */}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              {backupSuccessResult ? (
                <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-3 animate-fade-in">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-300">Backup Created & Downloaded</h4>
                    <p className="text-xs text-slate-300 font-mono mt-1">{backupSuccessResult.fileName}</p>
                    <span className="inline-block mt-2 px-2.5 py-0.5 rounded text-[11px] bg-emerald-950/60 text-emerald-300 border border-emerald-500/20">
                      File Size: {backupSuccessResult.sizeFormatted}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    The encrypted snapshot was saved to your browser downloads. Keep this file in a secure location.
                  </p>
                  <div className="pt-2 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setBackupSuccessResult(null)}
                      className="px-4 py-2 bg-[#1F293D] hover:bg-[#2D3A54] text-slate-200 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                    >
                      Create Another Backup
                    </button>
                    <button
                      onClick={() => setActiveTab('history')}
                      className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                    >
                      View Backup History
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Backup Type Card */}
                  <div className="p-4 bg-[#0D121F] border border-[#1F293D] rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">Backup Type</span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-400 text-xs font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                        Full System Backup
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Create a complete backup of your Chit Fund Management System data.
                    </p>
                  </div>

                  {/* Included Data Checklist */}
                  <div className="p-4 bg-[#0D121F] border border-[#1F293D] rounded-xl space-y-2.5">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Included in this snapshot:
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      {[
                        'Company Settings',
                        'Chit Schemes',
                        'Chits',
                        'Members',
                        'Staff',
                        'Users & Roles',
                        'Payments',
                        'Collections',
                        'Receipts',
                        'Expenses',
                        'Transactions',
                        'Audit Trail',
                        'System Settings',
                      ].map((item) => (
                        <div key={item} className="flex items-center gap-2 text-slate-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-xs">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Security Notice */}
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-start gap-2.5 text-xs text-amber-200">
                    <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-300 block mb-0.5">Security Notice:</span>
                      Your backup contains sensitive business data. Keep the downloaded backup file secure. Passwords, API tokens, and secrets are automatically redacted.
                    </div>
                  </div>

                  {/* Progress Indicator */}
                  {isBackingUp && (
                    <div className="p-4 bg-[#0D121F] border border-purple-500/30 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-purple-300 font-medium">{backupProgressMsg}</span>
                        <span className="font-mono text-purple-400 font-bold">{backupProgressPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#1F293D] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-200"
                          style={{ width: `${backupProgressPercent}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 2: RESTORE BACKUP */}
          {activeTab === 'restore' && canRestore && (
            <div className="space-y-4">
              {restoreSuccessMsg ? (
                <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-300">System Restored Successfully</h4>
                    <p className="text-xs text-slate-300 mt-1">{restoreSuccessMsg}</p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => window.location.reload()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors shadow-lg shadow-emerald-600/30 inline-flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Refresh Application View</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* High-Risk Warning */}
                  <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-3 text-xs text-rose-200">
                    <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-rose-300 text-sm block mb-1">
                        High-Risk Administrative Operation
                      </span>
                      Restoring this backup may replace current system data. Make sure you have a recent backup before continuing. An automatic safety snapshot will be downloaded before restoration begins.
                    </div>
                  </div>

                  {/* Upload Drop Area */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#1F293D] hover:border-purple-500/50 rounded-2xl p-6 text-center cursor-pointer bg-[#0D121F]/60 hover:bg-[#0D121F] transition-all group"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".chitbackup,.json"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-purple-400 mx-auto mb-2 transition-colors" />
                    <p className="text-xs font-semibold text-slate-200">
                      {selectedFile ? selectedFile.name : 'Click to select .chitbackup file'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Supports encrypted ChitFund system backup archives (*.chitbackup)
                    </p>
                  </div>

                  {isValidating && (
                    <div className="flex items-center justify-center gap-2 p-3 text-xs text-purple-300 bg-[#0D121F] rounded-xl border border-[#1F293D]">
                      <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                      <span>Verifying structure, compatibility, and cryptographic hash...</span>
                    </div>
                  )}

                  {validationError && (
                    <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-xs text-rose-300">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-rose-200 block mb-0.5">Validation Failed:</span>
                        <span>{validationError}</span>
                      </div>
                    </div>
                  )}

                  {/* Restore Preview */}
                  {restorePreview && (
                    <div className="p-4 bg-[#0D121F] border border-[#1F293D] rounded-xl space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between border-b border-[#1F293D] pb-2">
                        <span className="text-xs font-bold text-slate-200">Restore Package Preview</span>
                        <span className="text-[11px] font-mono text-purple-400">
                          Version {restorePreview.backup_version}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[11px] text-slate-400 block">Created At:</span>
                          <span className="font-semibold text-slate-200">
                            {new Date(restorePreview.created_at).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block">Created By:</span>
                          <span className="font-semibold text-slate-200">
                            {restorePreview.created_by} ({restorePreview.created_by_role})
                          </span>
                        </div>
                      </div>

                      {/* Data counts */}
                      <div className="pt-2 border-t border-[#1F293D]/60">
                        <span className="text-[11px] text-slate-400 block mb-2 font-medium uppercase tracking-wider">
                          Data Records Found:
                        </span>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="p-2 rounded-lg bg-[#111726] border border-[#1F293D]">
                            <span className="text-slate-400 text-[10px] block">Members</span>
                            <span className="font-bold text-slate-100 font-mono">
                              {restorePreview.records_count.members.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-[#111726] border border-[#1F293D]">
                            <span className="text-slate-400 text-[10px] block">Chits</span>
                            <span className="font-bold text-slate-100 font-mono">
                              {restorePreview.records_count.chits.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-[#111726] border border-[#1F293D]">
                            <span className="text-slate-400 text-[10px] block">Transactions</span>
                            <span className="font-bold text-slate-100 font-mono">
                              {restorePreview.records_count.transactions.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-[#111726] border border-[#1F293D]">
                            <span className="text-slate-400 text-[10px] block">Payouts</span>
                            <span className="font-bold text-slate-100 font-mono">
                              {restorePreview.records_count.payouts.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-[#111726] border border-[#1F293D]">
                            <span className="text-slate-400 text-[10px] block">Users</span>
                            <span className="font-bold text-slate-100 font-mono">
                              {restorePreview.records_count.users.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-[#111726] border border-[#1F293D]">
                            <span className="text-slate-400 text-[10px] block">Audit Logs</span>
                            <span className="font-bold text-slate-100 font-mono">
                              {restorePreview.records_count.audit_logs.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Confirmation Checkbox */}
                      <div className="pt-3 border-t border-[#1F293D]/60">
                        <label className="flex items-start gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={confirmRiskChecked}
                            onChange={(e) => setConfirmRiskChecked(e.target.checked)}
                            className="mt-0.5 rounded bg-[#111726] border-[#1F293D] text-purple-600 focus:ring-0 cursor-pointer"
                          />
                          <span className="text-xs text-slate-200 font-medium">
                            I understand that restoring this backup may replace current system data.
                          </span>
                        </label>
                      </div>
                    </div>
                  )}

                  {isRestoring && (
                    <div className="p-4 bg-[#0D121F] border border-purple-500/30 rounded-xl space-y-2 animate-fade-in">
                      <div className="flex items-center gap-2 text-xs text-purple-300">
                        <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                        <span>{restoreProgressMsg}</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 3: BACKUP HISTORY */}
          {activeTab === 'history' && canViewHistory && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Backup History ({historyList.length})
                </span>
                <span className="text-[11px] text-slate-500">Snapshots captured on this system</span>
              </div>

              {historyList.length > 0 ? (
                <div className="border border-[#1F293D] rounded-xl overflow-hidden bg-[#0D121F]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#141B2D] text-slate-400 border-b border-[#1F293D] uppercase tracking-wider text-[10px] font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Date & Time</th>
                        <th className="py-2.5 px-3">Created By</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">File Name</th>
                        <th className="py-2.5 px-3">Size</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1F293D]/60 text-slate-200">
                      {historyList.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/20">
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-300">
                            {new Date(item.createdAt).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-100">
                            {item.createdBy}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-slate-400">
                            {item.backupType}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-300 max-w-xs truncate" title={item.fileName}>
                            {item.fileName}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                            {item.sizeFormatted}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center bg-[#0D121F] border border-[#1F293D] rounded-xl text-slate-400 space-y-1">
                  <History className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-300">No backup records found</p>
                  <p className="text-[11px] text-slate-500">Create your first full system backup from the Create Backup tab.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-[#1F293D] bg-[#0D121F]/90 flex items-center justify-between">
          <div>
            {activeTab === 'backup' && (
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className="text-xs text-purple-400 hover:text-purple-300 font-medium cursor-pointer transition-colors"
              >
                View Backup History →
              </button>
            )}
            {activeTab === 'restore' && (
              <span className="text-[11px] text-slate-500">
                Safety backup is automatically captured before restore begins
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#1F293D] hover:bg-[#2D3A54] text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {activeTab === 'backup' && !backupSuccessResult && (
              <button
                onClick={handleCreateBackup}
                disabled={isBackingUp || !canCreate}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-purple-600/30 cursor-pointer flex items-center gap-1.5"
              >
                {isBackingUp ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating Backup...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Create Secure Backup</span>
                  </>
                )}
              </button>
            )}

            {activeTab === 'restore' && !restoreSuccessMsg && (
              <button
                onClick={handleExecuteRestore}
                disabled={isRestoring || !confirmRiskChecked || !validatedPackage || !canRestore}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-rose-600/30 cursor-pointer flex items-center gap-1.5"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Restoring System...</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Restore Backup</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
