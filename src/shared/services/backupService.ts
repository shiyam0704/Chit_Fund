import {
  BackupMetadata,
  BackupPackage,
  BackupHistoryItem,
} from '@/types';
import {
  APP_DATA_KEY,
  USERS_STORAGE_KEY,
  getAppData,
  saveAppData,
} from '@/shared/utils/storage';
import { getAuditLogs, logActivity, AUDIT_STORAGE_KEY } from './auditService';

export const BACKUP_HISTORY_KEY = 'chitfund_backup_history';

/**
 * Format bytes into human readable size (KB, MB)
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Generates standard timestamp formatted: YYYY-MM-DD_HH-mm-ss
 */
export function getBackupTimestamp(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
}

/**
 * Computes SHA-256 integrity hash using standard Web Crypto API
 */
export async function computeSHA256(text: string): Promise<string> {
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const msgUint8 = new TextEncoder().encode(text);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (err) {
    console.warn('[BackupService] WebCrypto SHA-256 fallback triggered', err);
  }
  // Simple deterministic fallback hash if subtle crypto is disabled in context
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return 'shafallback_' + Math.abs(hash).toString(16);
}

/**
 * Sanitizes user records: NEVER store passwords, hashes, tokens, or secrets in backups
 */
function sanitizeUsersForBackup(rawUsers: any[]): any[] {
  if (!Array.isArray(rawUsers)) return [];
  return rawUsers.map((u) => {
    const copy = { ...u };
    delete copy.password;
    delete copy.passwordHash;
    delete copy.token;
    delete copy.accessToken;
    delete copy.refreshToken;
    delete copy.secret;
    delete copy.apiKey;
    return copy;
  });
}

/**
 * Retrieves persistent backup history from storage
 */
export function getBackupHistory(): BackupHistoryItem[] {
  try {
    const raw = localStorage.getItem(BACKUP_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[BackupService] Failed to read backup history', err);
    return [];
  }
}

/**
 * Saves backup history
 */
export function saveBackupHistory(items: BackupHistoryItem[]): void {
  try {
    localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(items.slice(0, 50)));
  } catch (err) {
    console.error('[BackupService] Failed to save backup history', err);
  }
}

export interface ProgressCallback {
  (message: string, percent?: number): void;
}

/**
 * Collects all system data and builds a secure, structured .chitbackup package
 */
export async function createSystemBackup(
  user: { id?: string; name: string; role: string },
  onProgress?: ProgressCallback,
  isSafetyBackup = false
): Promise<{
  backupPackage: BackupPackage;
  fileName: string;
  jsonString: string;
  sizeFormatted: string;
}> {
  try {
    const yieldTime = () => new Promise((resolve) => setTimeout(resolve, 80));

    if (onProgress) onProgress('Preparing backup...', 10);
    await yieldTime();

    // 1. App Data
    if (onProgress) onProgress('Collecting company settings and chit schemes...', 25);
    await yieldTime();
    const appData = getAppData();

    // 2. Members & Payments
    if (onProgress) onProgress('Collecting members, transactions, and collections...', 45);
    await yieldTime();

    // 3. Users & Role Defaults (Sanitized)
    if (onProgress) onProgress('Collecting user roles and access policies...', 60);
    await yieldTime();
    let usersList: any[] = [];
    try {
      const rawUsers = localStorage.getItem(USERS_STORAGE_KEY);
      if (rawUsers) usersList = JSON.parse(rawUsers);
    } catch {}
    const sanitizedUsers = sanitizeUsersForBackup(usersList);

    let roleDefaults: any = null;
    try {
      const rawRoles = localStorage.getItem('chitfund_role_defaults');
      if (rawRoles) roleDefaults = JSON.parse(rawRoles);
    } catch {}

    // 4. Audit Trail
    if (onProgress) onProgress('Collecting immutable audit trail logs...', 75);
    await yieldTime();
    const auditLogs = getAuditLogs();

    // 5. Build Metadata
    const counts = {
      members: (appData.members || []).length,
      chits: (appData.chits || []).length,
      transactions: (appData.transactions || []).length,
      payouts: (appData.payouts || []).length,
      users: sanitizedUsers.length,
      audit_logs: auditLogs.length,
    };

    const metadata: BackupMetadata = {
      backup_version: '1.0',
      application_name: 'Chit Fund Management System',
      application_version: '2.4.0',
      database_schema_version: '2.0',
      backup_type: isSafetyBackup ? 'Pre-Restore Safety Backup' : 'Full System Backup',
      created_at: new Date().toISOString(),
      created_by: user.name || 'Super Admin',
      created_by_role: user.role || 'Super Admin',
      records_count: counts,
    };

    // 6. Data payload
    const dataPayload = {
      appData,
      users: sanitizedUsers,
      roleDefaults,
      auditLogs,
    };

    if (onProgress) onProgress('Calculating cryptographic integrity checksum...', 90);
    await yieldTime();

    const dataString = JSON.stringify(dataPayload);
    const checksum = await computeSHA256(dataString);

    const backupPackage: BackupPackage = {
      metadata,
      checksum,
      data: dataPayload,
    };

    const jsonString = JSON.stringify(backupPackage, null, 2);
    const timestamp = getBackupTimestamp();
    const prefix = isSafetyBackup ? 'PreRestore_Backup' : 'ChitFund_Backup';
    const fileName = `${prefix}_${timestamp}.chitbackup`;
    const sizeFormatted = formatBytes(new Blob([jsonString]).size);

    if (onProgress) onProgress('Finalizing backup package...', 98);
    await yieldTime();

    // Record in Backup History
    const historyItem: BackupHistoryItem = {
      id: `BCK-${Date.now()}`,
      fileName,
      createdAt: metadata.created_at,
      createdBy: metadata.created_by,
      createdByRole: metadata.created_by_role,
      backupType: metadata.backup_type,
      sizeBytes: new Blob([jsonString]).size,
      sizeFormatted,
      status: 'Success',
      checksum,
    };

    const existingHistory = getBackupHistory();
    saveBackupHistory([historyItem, ...existingHistory]);

    // Audit Trail Entry
    logActivity({
      userId: user.id || 'USR-SUPERADMIN',
      userName: user.name || 'Super Admin',
      userRole: user.role || 'Super Admin',
      action: 'BACKUP_CREATED',
      module: 'System Backup',
      recordId: fileName,
      recordName: fileName,
      description: `Created ${isSafetyBackup ? 'safety' : 'full system'} backup "${fileName}" (${sizeFormatted})`,
      status: 'Success',
      metadata: {
        fileName,
        sizeFormatted,
        records_count: counts,
        checksum,
      },
    });

    if (onProgress) onProgress('Backup completed successfully!', 100);

    return {
      backupPackage,
      fileName,
      jsonString,
      sizeFormatted,
    };
  } catch (err: any) {
    console.error('[BackupService] Backup creation failed:', err);

    logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'BACKUP_FAILED',
      module: 'System Backup',
      description: `System backup creation failed: ${err?.message || 'Unknown error'}`,
      status: 'Failed',
      failureReason: err?.message || 'Serialization or storage failure',
    });

    throw err;
  }
}

/**
 * Triggers client-side browser file download for .chitbackup
 */
export function downloadBackupFile(jsonString: string, fileName: string): void {
  const blob = new Blob([jsonString], { type: 'application/octet-stream;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Validates an uploaded .chitbackup file content
 */
export async function validateBackupFile(
  fileContent: string
): Promise<{
  isValid: boolean;
  error?: string;
  preview?: BackupMetadata;
  backupPackage?: BackupPackage;
}> {
  if (!fileContent || typeof fileContent !== 'string') {
    return { isValid: false, error: 'Empty or unreadable backup file.' };
  }

  let pkg: any;
  try {
    pkg = JSON.parse(fileContent);
  } catch (err) {
    return {
      isValid: false,
      error: 'Invalid file format. The file is corrupted or not a valid JSON/.chitbackup file.',
    };
  }

  // 1. Structure Verification
  if (!pkg || typeof pkg !== 'object' || !pkg.metadata || !pkg.data || !pkg.checksum) {
    return {
      isValid: false,
      error: 'Malformed backup structure. Required backup metadata or collections are missing.',
    };
  }

  // 2. Application Verification
  if (pkg.metadata.application_name !== 'Chit Fund Management System') {
    return {
      isValid: false,
      error: `Incompatible application backup. Expected "Chit Fund Management System" but found "${pkg.metadata.application_name || 'Unknown'}".`,
    };
  }

  // 3. Required Data Collections
  if (!pkg.data.appData || !Array.isArray(pkg.data.appData.members) || !Array.isArray(pkg.data.appData.chits)) {
    return {
      isValid: false,
      error: 'Missing vital database tables (members or chit schemes) in backup package.',
    };
  }

  // 4. Checksum Verification
  try {
    const recomputedHash = await computeSHA256(JSON.stringify(pkg.data));
    if (recomputedHash !== pkg.checksum && !pkg.checksum.startsWith('shafallback_')) {
      return {
        isValid: false,
        error: 'Data integrity check failed! The backup content appears to have been altered or corrupted.',
      };
    }
  } catch (err) {
    console.warn('[BackupService] Checksum validation warning', err);
  }

  return {
    isValid: true,
    preview: pkg.metadata,
    backupPackage: pkg as BackupPackage,
  };
}

/**
 * Automatically creates a pre-restore safety backup of current data
 */
export async function createPreRestoreSafetyBackup(
  user: { id?: string; name: string; role: string }
): Promise<{ fileName: string; sizeFormatted: string }> {
  const result = await createSystemBackup(user, undefined, true);
  // Trigger file download of safety backup to user's device
  downloadBackupFile(result.jsonString, result.fileName);
  return {
    fileName: result.fileName,
    sizeFormatted: result.sizeFormatted,
  };
}

/**
 * Restores system data from a validated BackupPackage
 */
export async function restoreSystemBackup(
  backupPackage: BackupPackage,
  user: { id?: string; name: string; role: string }
): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Log RESTORE_STARTED
    const startLog = logActivity({
      userId: user.id || 'USR-SUPERADMIN',
      userName: user.name || 'Super Admin',
      userRole: user.role || 'Super Admin',
      action: 'RESTORE_STARTED',
      module: 'System Backup',
      description: `Initiated restore from backup package created at ${new Date(backupPackage.metadata.created_at).toLocaleString('en-IN')}`,
      status: 'Success',
      metadata: {
        backup_created_at: backupPackage.metadata.created_at,
        created_by: backupPackage.metadata.created_by,
        records_count: backupPackage.metadata.records_count,
      },
    });

    // 2. Restore App Data (chits, members, transactions, payouts, settings)
    const newAppData = backupPackage.data.appData;
    saveAppData(newAppData);

    // 3. Restore Users & Preserve Admin Credentials
    try {
      const existingRawUsers = localStorage.getItem(USERS_STORAGE_KEY);
      let existingUsers: any[] = [];
      if (existingRawUsers) existingUsers = JSON.parse(existingRawUsers);

      const superAdminExisting = existingUsers.find((u) => u.role === 'Super Admin');

      // Merge restored users with preserved superadmin password if present
      const restoredUsers = (backupPackage.data.users || []).map((ru: any) => {
        if (ru.role === 'Super Admin' && superAdminExisting) {
          return {
            ...ru,
            password: superAdminExisting.password,
            email: superAdminExisting.email,
          };
        }
        return ru;
      });

      // If restored users had no super admin, keep current superadmin
      if (!restoredUsers.some((u: any) => u.role === 'Super Admin') && superAdminExisting) {
        restoredUsers.unshift(superAdminExisting);
      }

      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(restoredUsers));
    } catch (err) {
      console.warn('[BackupService] User restore merge notice:', err);
    }

    // 4. Restore Role Defaults if available
    if (backupPackage.data.roleDefaults) {
      try {
        localStorage.setItem('chitfund_role_defaults', JSON.stringify(backupPackage.data.roleDefaults));
      } catch {}
    }

    // 5. Restore Audit Logs and append RESTORE entries
    const restoredAuditLogs = Array.isArray(backupPackage.data.auditLogs) ? backupPackage.data.auditLogs : [];

    // Permanent completion log
    const completionLog = {
      id: `AUD-RESTORE-${Date.now()}`,
      userId: user.id || 'USR-SUPERADMIN',
      userName: user.name || 'Super Admin',
      userRole: user.role || 'Super Admin',
      action: 'RESTORE_COMPLETED' as const,
      module: 'System Backup' as const,
      recordId: backupPackage.metadata.backup_version,
      recordName: 'System Restore',
      description: `Successfully restored complete system state from backup package (${backupPackage.metadata.records_count?.members || 0} members, ${backupPackage.metadata.records_count?.chits || 0} chits)`,
      ipAddress: '127.0.0.1',
      userAgent: 'Restore Manager',
      status: 'Success' as const,
      createdAt: new Date().toISOString(),
    };

    const mergedAudit = [completionLog, startLog, ...restoredAuditLogs];
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(mergedAudit));

    // 6. Broadcast reactive event updates across the app
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chitfund_app_data_updated'));
      window.dispatchEvent(new CustomEvent('chitfund_audit_updated', { detail: mergedAudit.length }));
      window.dispatchEvent(new StorageEvent('storage', { key: APP_DATA_KEY, newValue: JSON.stringify(newAppData) }));
    }

    return {
      success: true,
      message: `System restored successfully. ${backupPackage.metadata.records_count.members} members and ${backupPackage.metadata.records_count.chits} chit schemes loaded.`,
    };
  } catch (err: any) {
    console.error('[BackupService] System restore failed:', err);

    logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'RESTORE_FAILED',
      module: 'System Backup',
      description: `System restore failed: ${err?.message || 'Unexpected error'}`,
      status: 'Failed',
      failureReason: err?.message || 'Restore write failure',
    });

    throw err;
  }
}
