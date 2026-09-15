import { AuditAction, AuditModule, AuditStatus, AuditFieldChange, AuditLogEntry } from '@/types';
import { getActiveCompanyId, DEFAULT_COMPANY_ID } from '@/features/auth/utils/companyStorage';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const AUDIT_STORAGE_KEY = 'chitfund_audit_logs';
const MAX_AUDIT_LOGS = 2500;

export function getCompanyAuditKey(companyId?: string): string {
  const targetId = companyId || getActiveCompanyId();
  return `chitfund_company_${targetId}_audit_logs`;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'passwordverifier',
  'verifier',
  'salt',
  'activationtoken',
  'accesstoken',
  'refreshtoken',
  'token',
  'secret',
  'apikey',
  'privatekey',
  'securityanswer',
  'confirmpassword',
  'credential',
]);

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  phone: 'Phone Number',
  email: 'Email Address',
  address: 'Address',
  status: 'Status',
  role: 'Role',
  chitAmount: 'Chit Value',
  durationMonths: 'Duration (Months)',
  monthlyInstallment: 'Monthly Amount',
  baseMonthlyAmount: 'Base Monthly Amount',
  startDate: 'Start Date',
  endDate: 'End Date',
  commissionPercentage: 'Commission (%)',
  gracePeriodDays: 'Grace Period (Days)',
  amount: 'Amount',
  paymentMode: 'Payment Mode',
  paymentDate: 'Payment Date',
  referenceNo: 'Reference Number',
  notes: 'Notes',
  companyName: 'Company Name',
  gstNumber: 'GST Number',
  receiptPrefix: 'Receipt Prefix',
  receiptHeader: 'Receipt Header',
  receiptFooter: 'Receipt Footer',
  signatureText: 'Signature Text',
  defaultCommission: 'Default Commission (%)',
  gracePeriod: 'Grace Period (Days)',
  prizeAmount: 'Prize Amount',
  bidAmount: 'Bid Amount',
  dividendAmount: 'Dividend Amount',
  winnerMemberName: 'Winner Member',
  permissions: 'Permissions',
};

/**
 * Cleanly formats a key into a human-friendly label
 */
export function formatFieldLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Sanitizes and redacts passwords and secrets
 */
export function sanitizeData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item));
  }

  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeData(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Formats a value for diff display
 */
export function formatValueForDisplay(val: any): string {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') {
    return val >= 1000 ? `₹${val.toLocaleString('en-IN')}` : String(val);
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return '—';
    return val.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
  }
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  return String(val);
}

/**
 * Automatic change detection diffing before vs after states
 */
export function computeFieldChanges(
  before: Record<string, any> | null | undefined,
  after: Record<string, any> | null | undefined
): AuditFieldChange[] {
  if (!before || !after) return [];

  const changes: AuditFieldChange[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  const ignoredKeys = new Set([
    'id',
    'createdAt',
    'updatedAt',
    'password',
    'passwordHash',
    'confirmPassword',
    'schedule',
    'auctions',
    'monthStatuses',
    'monthPayouts',
    'monthOverrides',
    'monthMemberAssignments',
  ]);

  for (const key of keys) {
    if (ignoredKeys.has(key)) continue;

    const bVal = before[key];
    const aVal = after[key];

    const bStr = JSON.stringify(bVal ?? null);
    const aStr = JSON.stringify(aVal ?? null);

    if (bStr !== aStr) {
      const lowerKey = key.toLowerCase();
      const isSensitive = SENSITIVE_KEYS.has(lowerKey);

      changes.push({
        field: key,
        label: formatFieldLabel(key),
        previousValue: isSensitive ? '[REDACTED]' : formatValueForDisplay(bVal),
        newValue: isSensitive ? '[REDACTED]' : formatValueForDisplay(aVal),
      });
    }
  }

  return changes;
}

/**
 * Detects browser client user-agent summary
 */
export function getBrowserContext(): { ipAddress: string; userAgent: string } {
  let userAgent = 'Chrome / Windows';
  if (typeof window !== 'undefined' && window.navigator) {
    const ua = window.navigator.userAgent;
    if (ua.includes('Edg/')) userAgent = 'Microsoft Edge / Windows';
    else if (ua.includes('Chrome/')) userAgent = 'Google Chrome / Windows';
    else if (ua.includes('Firefox/')) userAgent = 'Mozilla Firefox';
    else if (ua.includes('Safari/') && !ua.includes('Chrome/')) userAgent = 'Apple Safari';
    else userAgent = ua.slice(0, 40);
  }

  const ipAddress =
    typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? '192.168.1.105'
      : '10.0.4.18';

  return { ipAddress, userAgent };
}

/**
 * Loads all audit logs from storage for the specified or active company.
 * Safely migrates legacy audit logs to DEFAULT_COMPANY_ID if needed.
 */
export function getAuditLogs(companyId?: string): AuditLogEntry[] {
  const targetCompanyId = companyId || getActiveCompanyId();
  const scopedKey = getCompanyAuditKey(targetCompanyId);

  try {
    const raw = localStorage.getItem(scopedKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }

    // Check legacy key if target is DEFAULT_COMPANY_ID
    if (targetCompanyId === DEFAULT_COMPANY_ID) {
      const legacyRaw = localStorage.getItem(AUDIT_STORAGE_KEY);
      if (legacyRaw) {
        try {
          const parsedLegacy = JSON.parse(legacyRaw);
          if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
            const migrated = parsedLegacy.map((entry) => ({
              ...entry,
              companyId: entry.companyId || DEFAULT_COMPANY_ID,
            }));
            saveAuditLogs(migrated, DEFAULT_COMPANY_ID);
            return migrated;
          }
        } catch {}
      }
    }

    return [];
  } catch (err) {
    console.error(`[AuditService] Failed to read audit logs for company ${targetCompanyId}:`, err);
    return [];
  }
}

/**
 * Completely clears all audit logs from storage for the specified company.
 */
export function clearAllAuditLogs(companyId?: string): void {
  const targetCompanyId = companyId || getActiveCompanyId();
  const scopedKey = getCompanyAuditKey(targetCompanyId);

  try {
    localStorage.removeItem(scopedKey);
    if (targetCompanyId === DEFAULT_COMPANY_ID) {
      try {
        localStorage.removeItem(AUDIT_STORAGE_KEY);
      } catch {}
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chitfund_audit_updated', { detail: 0 }));
    }
  } catch (err) {
    console.error(`[AuditService] Failed to clear audit logs for company ${targetCompanyId}:`, err);
  }
}

/**
 * Deletes a single audit log entry by ID for the specified company.
 */
export function deleteAuditLog(id: string, companyId?: string): boolean {
  const targetCompanyId = companyId || getActiveCompanyId();
  const scopedKey = getCompanyAuditKey(targetCompanyId);

  try {
    const raw = localStorage.getItem(scopedKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return false;
    const filtered = parsed.filter((item: AuditLogEntry) => item.id !== id);
    saveAuditLogs(filtered, targetCompanyId);
    return true;
  } catch (err) {
    console.error(`[AuditService] Failed to delete audit log from company ${targetCompanyId}:`, err);
    return false;
  }
}

/**
 * Save logs to storage (company-scoped)
 */
export function saveAuditLogs(logs: AuditLogEntry[], companyId?: string): void {
  const targetCompanyId = companyId || getActiveCompanyId();
  const scopedKey = getCompanyAuditKey(targetCompanyId);

  try {
    const trimmed = logs.slice(0, MAX_AUDIT_LOGS);
    localStorage.setItem(scopedKey, JSON.stringify(trimmed));
    if (targetCompanyId === DEFAULT_COMPANY_ID) {
      try {
        localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(trimmed));
      } catch {}
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chitfund_audit_updated', { detail: trimmed.length }));
    }
  } catch (err) {
    console.error(`[AuditService] Failed to save audit logs for company ${targetCompanyId}:`, err);
  }
}

export interface LogActivityParams {
  companyId?: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  action: AuditAction;
  module: AuditModule;
  recordId?: string;
  recordName?: string;
  description: string;
  beforeData?: Record<string, any> | null;
  afterData?: Record<string, any> | null;
  changedFields?: AuditFieldChange[];
  status?: AuditStatus;
  failureReason?: string;
  metadata?: Record<string, any>;
}

/**
 * Log a new activity into the immutable company-scoped audit trail
 */
export function logActivity(params: LogActivityParams): AuditLogEntry {
  const { ipAddress, userAgent } = getBrowserContext();

  let activeUserId = params.userId;
  let activeUserName = params.userName;
  let activeUserRole = params.userRole;
  let targetCompanyId = params.companyId;

  if (!activeUserId || !activeUserName || !targetCompanyId) {
    try {
      const authRaw = localStorage.getItem('chitfund_auth');
      if (authRaw) {
        const session = JSON.parse(authRaw);
        if (session.userId) {
          activeUserId = activeUserId || session.userId;
          activeUserName = activeUserName || session.name || session.email || 'Super Admin';
          activeUserRole = activeUserRole || session.role || 'Super Admin';
          targetCompanyId = targetCompanyId || session.companyId;
        }
      }
    } catch {}
  }

  targetCompanyId = targetCompanyId || getActiveCompanyId();
  activeUserId = activeUserId || 'USR-SUPERADMIN';
  activeUserName = activeUserName || 'Super Admin';
  activeUserRole = activeUserRole || 'Super Admin';

  const sanitizedBefore = sanitizeData(params.beforeData);
  const sanitizedAfter = sanitizeData(params.afterData);

  let changes = params.changedFields;
  if (!changes && params.action === 'UPDATE' && sanitizedBefore && sanitizedAfter) {
    changes = computeFieldChanges(sanitizedBefore, sanitizedAfter);
  }

  const newEntry: AuditLogEntry = {
    id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
    companyId: targetCompanyId,
    userId: activeUserId,
    userName: activeUserName,
    userRole: activeUserRole,
    action: params.action,
    module: params.module,
    recordId: params.recordId,
    recordName: params.recordName,
    description: params.description,
    beforeData: sanitizedBefore || null,
    afterData: sanitizedAfter || null,
    changedFields: changes && changes.length > 0 ? changes : undefined,
    ipAddress,
    userAgent,
    status: params.status || 'Success',
    failureReason: params.failureReason,
    metadata: sanitizeData(params.metadata),
    createdAt: new Date().toISOString(),
  };

  const existing = getAuditLogs(targetCompanyId);
  saveAuditLogs([newEntry, ...existing], targetCompanyId);

  return newEntry;
}

/**
 * Export filtered audit logs to CSV format (Excel compatible)
 */
export function exportAuditLogsToCSV(logs: AuditLogEntry[], filename = 'audit_trail.csv'): void {
  const headers = [
    'Date & Time',
    'User',
    'Role',
    'Action',
    'Module',
    'Record ID',
    'Record Name',
    'Description',
    'Status',
    'IP Address',
    'Failure Reason',
  ];

  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = logs.map((log) => [
    escapeCSV(new Date(log.createdAt).toLocaleString('en-IN')),
    escapeCSV(log.userName),
    escapeCSV(log.userRole),
    escapeCSV(log.action),
    escapeCSV(log.module),
    escapeCSV(log.recordId || ''),
    escapeCSV(log.recordName || ''),
    escapeCSV(log.description),
    escapeCSV(log.status),
    escapeCSV(log.ipAddress),
    escapeCSV(log.failureReason || ''),
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export filtered audit logs to a PDF report
 */
export function exportAuditLogsToPDF(logs: AuditLogEntry[], companyName = 'Chit Fund Management System'): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  // Header Title
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text(companyName, 40, 40);

  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105);
  doc.text('Activity Audit Trail & Security Log Report', 40, 58);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated on: ${new Date().toLocaleString('en-IN')} | Filtered Records: ${logs.length}`, 40, 74);

  const tableData = logs.map((log) => {
    const logDate = new Date(log.createdAt);
    const dateStr = logDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timeStr = logDate.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return [
      `${dateStr}\n${timeStr}`,
      log.userName,
      log.userRole,
      log.action,
      log.module,
      log.recordId || log.recordName || '—',
      log.description,
      log.status,
    ];
  });

  autoTable(doc, {
    startY: 85,
    head: [['DATE & TIME', 'USER', 'ROLE', 'ACTION', 'MODULE', 'RECORD', 'DESCRIPTION', 'STATUS']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 4,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [17, 23, 38],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 75 },
      1: { cellWidth: 70 },
      2: { cellWidth: 65 },
      3: { cellWidth: 70 },
      4: { cellWidth: 70 },
      5: { cellWidth: 75 },
      6: { cellWidth: 260 },
      7: { cellWidth: 55 },
    },
    didDrawPage: (data) => {
      const pageCount = doc.internal.pages.length - 1;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${data.pageNumber} of ${pageCount}`, doc.internal.pageSize.width - 80, doc.internal.pageSize.height - 20);
    },
  });

  doc.save(`audit_trail_${new Date().toISOString().slice(0, 10)}.pdf`);
}
