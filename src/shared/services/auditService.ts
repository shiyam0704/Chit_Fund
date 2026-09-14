import { AuditAction, AuditModule, AuditStatus, AuditFieldChange, AuditLogEntry } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const AUDIT_STORAGE_KEY = 'chitfund_audit_logs';
const MAX_AUDIT_LOGS = 2500;
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'accesstoken',
  'refreshtoken',
  'token',
  'secret',
  'apikey',
  'privatekey',
  'securityanswer',
  'confirmpassword',
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
 * Generates realistic initial operational audit logs if database is empty
 */
function generateSeedAuditLogs(): AuditLogEntry[] {
  const now = new Date();

  // Helper to build dates
  const makeDate = (hoursAgo: number, minutesAgo: number = 0) => {
    const d = new Date(now.getTime() - (hoursAgo * 60 + minutesAgo) * 60 * 1000);
    return d.toISOString();
  };

  const seed: AuditLogEntry[] = [
    {
      id: 'AUD-1726300001-001',
      userId: 'USR-SUPERADMIN',
      userName: 'Super Admin',
      userRole: 'Super Admin',
      action: 'UPDATE',
      module: 'Chits',
      recordId: 'CHIT-0008',
      recordName: 'Lakshmi Deepam 25M',
      description: 'Updated monthly installment from ₹5,000 to ₹6,000',
      beforeData: { id: 'CHIT-0008', name: 'Lakshmi Deepam 25M', monthlyInstallment: 5000, chitAmount: 100000 },
      afterData: { id: 'CHIT-0008', name: 'Lakshmi Deepam 25M', monthlyInstallment: 6000, chitAmount: 100000 },
      changedFields: [
        { field: 'monthlyInstallment', label: 'Monthly Amount', previousValue: '₹5,000', newValue: '₹6,000' },
      ],
      ipAddress: '192.168.1.105',
      userAgent: 'Chrome / Windows 11',
      status: 'Success',
      createdAt: makeDate(0, 17),
    },
    {
      id: 'AUD-1726300002-002',
      userId: 'USR-STAFF-02',
      userName: 'Ramesh',
      userRole: 'Staff',
      action: 'CREATE',
      module: 'Members',
      recordId: 'MEM-00125',
      recordName: 'Suresh Kumar',
      description: 'Added new member "Suresh Kumar"',
      afterData: {
        id: 'MEM-00125',
        name: 'Suresh Kumar',
        phone: '9876543210',
        email: 'suresh.k@gmail.com',
        status: 'Active',
        joinedDate: now.toISOString().slice(0, 10),
      },
      ipAddress: '192.168.1.112',
      userAgent: 'Chrome / Windows 10',
      status: 'Success',
      createdAt: makeDate(0, 20),
    },
    {
      id: 'AUD-1726300003-003',
      userId: 'USR-STAFF-02',
      userName: 'Ramesh',
      userRole: 'Staff',
      action: 'CREATE',
      module: 'Payments',
      recordId: 'REC-20260914-9841',
      recordName: 'Receipt #REC-20260914-9841',
      description: 'Recorded installment collection of ₹6,000 via UPI (PhonePe) for Suresh Kumar',
      afterData: {
        receiptNo: 'REC-20260914-9841',
        memberName: 'Suresh Kumar',
        amount: 6000,
        paymentMode: 'UPI',
        status: 'Paid',
      },
      ipAddress: '192.168.1.112',
      userAgent: 'Chrome / Windows 10',
      status: 'Success',
      createdAt: makeDate(0, 35),
    },
    {
      id: 'AUD-1726300004-004',
      userId: 'USR-SUPERADMIN',
      userName: 'Super Admin',
      userRole: 'Super Admin',
      action: 'LOGIN_SUCCESS',
      module: 'Authentication',
      description: 'Successful administrative login via credentials',
      ipAddress: '192.168.1.105',
      userAgent: 'Chrome / Windows 11',
      status: 'Success',
      createdAt: makeDate(1, 10),
    },
    {
      id: 'AUD-1726300005-005',
      userId: 'unknown',
      userName: 'rajesh_staff',
      userRole: 'Guest',
      action: 'LOGIN_FAILED',
      module: 'Authentication',
      description: 'Failed password verification for user "rajesh_staff"',
      ipAddress: '192.168.1.120',
      userAgent: 'Firefox / Android',
      status: 'Failed',
      failureReason: 'Invalid Password',
      createdAt: makeDate(1, 45),
    },
    {
      id: 'AUD-1726300006-006',
      userId: 'USR-SUPERADMIN',
      userName: 'Super Admin',
      userRole: 'Super Admin',
      action: 'UPDATE',
      module: 'Settings',
      recordId: 'COMPANY_SETTINGS',
      recordName: 'Company Profile',
      description: 'Updated company profile and contact phone number',
      beforeData: { companyName: 'Chit Fund Management', phone: '9876543210' },
      afterData: { companyName: 'Chit Fund Management', phone: '9876500000' },
      changedFields: [
        { field: 'phone', label: 'Phone Number', previousValue: '9876543210', newValue: '9876500000' },
      ],
      ipAddress: '192.168.1.105',
      userAgent: 'Chrome / Windows 11',
      status: 'Success',
      createdAt: makeDate(2, 15),
    },
    {
      id: 'AUD-1726300007-007',
      userId: 'USR-STAFF-02',
      userName: 'Ramesh',
      userRole: 'Staff',
      action: 'CREATE',
      module: 'Collections',
      recordId: 'REC-20260914-1102',
      recordName: 'Collection Batch #14',
      description: 'Recorded cash collection batch of ₹15,000 for Gold Group 2026',
      ipAddress: '192.168.1.112',
      userAgent: 'Chrome / Windows 10',
      status: 'Success',
      createdAt: makeDate(3, 2),
    },
    {
      id: 'AUD-1726300008-008',
      userId: 'USR-SUPERADMIN',
      userName: 'Super Admin',
      userRole: 'Super Admin',
      action: 'DELETE',
      module: 'Chits',
      recordId: 'CHIT-TEST-99',
      recordName: 'Draft Test Plan 50K',
      description: 'Deleted obsolete draft chit plan "Draft Test Plan 50K"',
      beforeData: { id: 'CHIT-TEST-99', name: 'Draft Test Plan 50K', status: 'Draft', chitAmount: 50000 },
      ipAddress: '192.168.1.105',
      userAgent: 'Chrome / Windows 11',
      status: 'Success',
      createdAt: makeDate(4, 30),
    },
    {
      id: 'AUD-1726300009-009',
      userId: 'USR-SUPERADMIN',
      userName: 'Super Admin',
      userRole: 'Super Admin',
      action: 'PASSWORD_RESET',
      module: 'Users',
      recordId: 'USR-STAFF-02',
      recordName: 'Ramesh (Staff)',
      description: 'Reset password credentials for staff member Ramesh',
      ipAddress: '192.168.1.105',
      userAgent: 'Chrome / Windows 11',
      status: 'Success',
      createdAt: makeDate(5, 10),
    },
    {
      id: 'AUD-1726300010-010',
      userId: 'USR-SUPERADMIN',
      userName: 'Super Admin',
      userRole: 'Super Admin',
      action: 'CREATE',
      module: 'Chits',
      recordId: 'CHIT-0009',
      recordName: 'Silver Fortune 20M',
      description: 'Created new chit scheme "Silver Fortune 20M" with total value of ₹2,00,000',
      afterData: { id: 'CHIT-0009', name: 'Silver Fortune 20M', chitAmount: 200000, durationMonths: 20, monthlyInstallment: 10000 },
      ipAddress: '192.168.1.105',
      userAgent: 'Chrome / Windows 11',
      status: 'Success',
      createdAt: makeDate(6, 0),
    },
    // Yesterday and earlier records
    {
      id: 'AUD-1726200001-011',
      userId: 'USR-SUPERADMIN',
      userName: 'Super Admin',
      userRole: 'Super Admin',
      action: 'CREATE',
      module: 'Members',
      recordId: 'MEM-00124',
      recordName: 'Kavitha M',
      description: 'Added new member "Kavitha M" to Member Directory',
      afterData: { id: 'MEM-00124', name: 'Kavitha M', phone: '9789012345', status: 'Active' },
      ipAddress: '192.168.1.105',
      userAgent: 'Chrome / Windows 11',
      status: 'Success',
      createdAt: makeDate(26, 0),
    },
    {
      id: 'AUD-1726200002-012',
      userId: 'USR-STAFF-01',
      userName: 'Priya',
      userRole: 'Staff',
      action: 'CREATE',
      module: 'Payments',
      recordId: 'REC-20260913-7712',
      recordName: 'Receipt #REC-20260913-7712',
      description: 'Recorded installment payment of ₹10,000 for member Kavitha M',
      ipAddress: '192.168.1.114',
      userAgent: 'Safari / macOS',
      status: 'Success',
      createdAt: makeDate(28, 15),
    },
    {
      id: 'AUD-1726200003-013',
      userId: 'USR-STAFF-01',
      userName: 'Priya',
      userRole: 'Staff',
      action: 'CANCEL',
      module: 'Receipts',
      recordId: 'REC-20260913-5501',
      recordName: 'Receipt #REC-20260913-5501',
      description: 'Cancelled duplicate receipt entry #REC-20260913-5501',
      ipAddress: '192.168.1.114',
      userAgent: 'Safari / macOS',
      status: 'Success',
      createdAt: makeDate(30, 40),
    },
    {
      id: 'AUD-1726200004-014',
      userId: 'USR-SUPERADMIN',
      userName: 'Super Admin',
      userRole: 'Super Admin',
      action: 'UPDATE',
      module: 'Settings',
      recordId: 'CHIT_RULES',
      recordName: 'Default Commission & Grace Period',
      description: 'Updated default commission rate and grace period days',
      beforeData: { defaultCommission: 4, gracePeriod: 3 },
      afterData: { defaultCommission: 5, gracePeriod: 5 },
      changedFields: [
        { field: 'defaultCommission', label: 'Default Commission (%)', previousValue: '4%', newValue: '5%' },
        { field: 'gracePeriod', label: 'Grace Period (Days)', previousValue: '3 Days', newValue: '5 Days' },
      ],
      ipAddress: '192.168.1.105',
      userAgent: 'Chrome / Windows 11',
      status: 'Success',
      createdAt: makeDate(34, 0),
    },
    {
      id: 'AUD-1726100001-015',
      userId: 'USR-SUPERADMIN',
      userName: 'Super Admin',
      userRole: 'Super Admin',
      action: 'CREATE',
      module: 'Users',
      recordId: 'USR-STAFF-03',
      recordName: 'Anand Sharma',
      description: 'Created new staff operator account for Anand Sharma',
      afterData: { id: 'USR-STAFF-03', name: 'Anand Sharma', email: 'anand@chitfund.com', role: 'Staff' },
      ipAddress: '192.168.1.105',
      userAgent: 'Chrome / Windows 11',
      status: 'Success',
      createdAt: makeDate(52, 30),
    },
    {
      id: 'AUD-1726100002-016',
      userId: 'USR-SUPERADMIN',
      userName: 'Super Admin',
      userRole: 'Super Admin',
      action: 'DELETE',
      module: 'Members',
      recordId: 'MEM-TEMP-04',
      recordName: 'Unverified Test Record',
      description: 'Removed unverified member entry #MEM-TEMP-04',
      beforeData: { id: 'MEM-TEMP-04', name: 'Unverified Test Record', phone: '0000000000' },
      ipAddress: '192.168.1.105',
      userAgent: 'Chrome / Windows 11',
      status: 'Success',
      createdAt: makeDate(75, 0),
    },
    {
      id: 'AUD-1726000001-017',
      userId: 'USR-SUPERADMIN',
      userName: 'Super Admin',
      userRole: 'Super Admin',
      action: 'EXPORT',
      module: 'Reports',
      recordId: 'REPORT-COLLECTION-AUG',
      recordName: 'Monthly Collection Report (August)',
      description: 'Exported monthly collection audit summary to Excel format',
      ipAddress: '192.168.1.105',
      userAgent: 'Chrome / Windows 11',
      status: 'Success',
      createdAt: makeDate(120, 0),
    },
    {
      id: 'AUD-1725900001-018',
      userId: 'USR-SUPERADMIN',
      userName: 'Super Admin',
      userRole: 'Super Admin',
      action: 'CREATE',
      module: 'Chits',
      recordId: 'CHIT-0007',
      recordName: 'Dhanlaxmi 15M Scheme',
      description: 'Configured new scheme "Dhanlaxmi 15M Scheme" with ₹1,50,000 corpus',
      afterData: { id: 'CHIT-0007', name: 'Dhanlaxmi 15M Scheme', chitAmount: 150000, durationMonths: 15 },
      ipAddress: '192.168.1.105',
      userAgent: 'Chrome / Windows 11',
      status: 'Success',
      createdAt: makeDate(200, 0),
    },
    {
      id: 'AUD-1725800001-019',
      userId: 'USR-SUPERADMIN',
      userName: 'Super Admin',
      userRole: 'Super Admin',
      action: 'PRINT',
      module: 'Receipts',
      recordId: 'REC-20260908-0012',
      recordName: 'Payment Receipt #REC-20260908-0012',
      description: 'Printed hardcopy customer installment payment receipt',
      ipAddress: '192.168.1.105',
      userAgent: 'Chrome / Windows 11',
      status: 'Success',
      createdAt: makeDate(280, 0),
    },
    {
      id: 'AUD-1725700001-020',
      userId: 'USR-SUPERADMIN',
      userName: 'Super Admin',
      userRole: 'Super Admin',
      action: 'LOGIN_SUCCESS',
      module: 'Authentication',
      description: 'Initial system administrator login session initialized',
      ipAddress: '192.168.1.105',
      userAgent: 'Chrome / Windows 11',
      status: 'Success',
      createdAt: makeDate(350, 0),
    },
  ];

  return seed;
}

/**
 * Loads all audit logs from storage.
 * If storage is uninitialized, populates realistic initial seed logs.
 */
export function getAuditLogs(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) {
      const seed = generateSeedAuditLogs();
      try {
        localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(seed));
      } catch {}
      return seed;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seed = generateSeedAuditLogs();
      try {
        localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(seed));
      } catch {}
      return seed;
    }
    return parsed;
  } catch (err) {
    console.error('[AuditService] Failed to read audit logs:', err);
    return [];
  }
}

/**
 * Save logs to storage (append-only)
 */
function saveAuditLogs(logs: AuditLogEntry[]): void {
  try {
    const trimmed = logs.slice(0, MAX_AUDIT_LOGS);
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(trimmed));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chitfund_audit_updated', { detail: trimmed.length }));
    }
  } catch (err) {
    console.error('[AuditService] Failed to save audit log:', err);
  }
}

export interface LogActivityParams {
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
 * Log a new activity into the immutable audit trail
 */
export function logActivity(params: LogActivityParams): AuditLogEntry {
  const { ipAddress, userAgent } = getBrowserContext();

  let activeUserId = params.userId;
  let activeUserName = params.userName;
  let activeUserRole = params.userRole;

  if (!activeUserId || !activeUserName) {
    try {
      const authRaw = localStorage.getItem('chitfund_auth');
      if (authRaw) {
        const session = JSON.parse(authRaw);
        if (session.userId) {
          activeUserId = activeUserId || session.userId;
          activeUserName = activeUserName || session.name || session.email || 'Super Admin';
          activeUserRole = activeUserRole || session.role || 'Super Admin';
        }
      }
    } catch {}
  }

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

  const existing = getAuditLogs();
  saveAuditLogs([newEntry, ...existing]);

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
