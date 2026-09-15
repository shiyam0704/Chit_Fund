export type InstallmentType = 'Daily' | 'Weekly' | 'Monthly' | 'Fixed' | 'StepUp';

export type ChitStatus = 'Active' | 'Upcoming' | 'Completed' | 'Draft';

export type MemberStatus = 'Active' | 'Inactive' | 'Pending';

export type PaymentMode = 'Cash' | 'Bank Transfer' | 'UPI' | 'Cheque' | 'Card' | 'Online' | 'GPay' | 'PhonePe' | 'Bank' | string;

export type DateFilterType = 'All' | 'Today' | 'Yesterday' | 'This Week' | 'This Month' | 'This Year' | 'Last Month' | 'Custom';

export type MonthStatus = 'Pending' | 'Partial' | 'Paid' | 'Overdue';

export type Permission = string;

export interface Member {
  id: string;
  companyId?: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  status: MemberStatus;
  createdAt?: string;
  joinedDate?: string;
  chitId?: string;
  chitName?: string;
  monthlyDue?: number;
  totalPaid?: number;
  pendingAmount?: number;
  paymentStatus?: 'Paid' | 'Pending' | 'Partial' | 'Overdue' | 'none';
  isAssigned?: boolean;
  enrolledChitIds?: string[];
  notes?: string;
  slotNumber?: number;
}

export interface MonthlyScheduleItem {
  month?: number;
  monthNumber: number;
  monthLabel: string;
  dueDate: string;
  date?: string;
  baseMonthlyAmount?: number;
  grossInstallment: number;
  monthlyInstallment?: number;
  monthlyPayment?: number;
  bidAmount: number;
  dividendAmount: number;
  netPayable: number;
  netChitAmount?: number;
  totalCollection: number;
  chitValue: number;
  expectedCollection?: number;
  totalCollected?: number;
  pendingCollection?: number;
  collectedAmount?: number;
  pendingAmount?: number;
  status?: MonthStatus | string;
  auctionStatus?: string;
  paidMembersCount?: number;
  pendingMembersCount?: number;
  totalEnrolledCount?: number;
  winnerMemberId?: string | null;
  winnerMemberName?: string | null;
  assignedMemberId?: string;
  assignedMemberName?: string;
  assignedMemberPhone?: string;
  payoutMemberId?: string;
  payoutMemberName?: string;
  payoutMemberPhone?: string;
  payoutAmount?: number;
  payoutDate?: string;
  payoutMode?: string;
  payoutStatus?: string;
  payoutReferenceNo?: string;
  payoutNotes?: string;
  assignedMemberIds?: string[];
  assignedMembers?: Array<{ id: string; name: string; phone?: string; email?: string }>;
  isCustomEdited?: boolean;
}

export interface PaymentTransaction {
  id: string;
  companyId?: string;
  receiptNo?: string;
  chitId?: string;
  chitName?: string;
  memberId?: string;
  payerMemberId?: string;
  memberName?: string;
  memberPhone?: string;
  monthNumber?: number;
  monthId?: string;
  amount: number;
  paidAmount?: number;
  dueAmount?: number;
  monthlyDue?: number;
  previousPending?: number;
  currentDue?: number;
  remainingBalance?: number;
  date: string;
  paymentDate?: string;
  paymentMode: PaymentMode;
  status?: 'Paid' | 'Pending' | 'Partial Paid' | 'Partial' | 'none' | string;
  paidTo?: string;
  paidToType?: 'ORGANIZER' | 'WINNER' | string;
  paidToMemberId?: string | null;
  receiverId?: string;
  receiverName?: string;
  collectedBy?: string;
  referenceId?: string;
  referenceNo?: string;
  receiptUrl?: string;
  notes?: string;
  type?: 'Collection' | 'Payout' | string;
  createdAt?: string;
}

export type Transaction = PaymentTransaction;

export interface ChitPayout {
  id: string;
  companyId?: string;
  chitId: string;
  monthId?: string;
  monthNumber: number;
  memberId: string;
  memberName?: string;
  memberPhone?: string;
  amount: number;
  paymentDate?: string;
  paymentMode?: string;
  status?: 'Paid' | 'Pending' | string;
  referenceNo?: string;
  referenceId?: string;
  receiptUrl?: string;
  paidByType?: string;
  notes?: string;
  type?: 'Payout' | string;
  createdAt?: string;
}

export interface Auction {
  id: string;
  chitId: string;
  monthNumber: number;
  winnerMemberId?: string;
  winnerMemberName?: string;
  winningMemberId?: string;
  winningMemberName?: string;
  prizeAmount?: number;
  bidAmount?: number;
  dividendAmount?: number;
  netChitAmount?: number;
  auctionDate?: string;
  status?: string;
  notes?: string;
}

export interface MonthCustomDetails {
  grossInstallment?: number;
  bidAmount?: number;
  dividendAmount?: number;
  monthlyPayment?: number;
  netPayable?: number;
  netChitAmount?: number;
  chitValue?: number;
  totalCollection?: number;
}

export interface ChitSlot extends Member {
  slotNumber: number;
}

export interface ChitScheme {
  id: string;
  companyId?: string;
  name: string;
  chitAmount: number;
  memberCount?: number;
  membersCount?: number;
  durationMonths: number;
  monthlyInstallment?: number;
  baseMonthlyAmount?: number;
  initialBidAmount?: number;
  bidReductionMethod?: 'Auto' | 'Fixed' | 'Percentage';
  bidReductionValue?: number;
  collectedAmount?: number;
  pendingAmount?: number;
  startDate: string;
  endDate?: string;
  commissionPercentage?: number;
  gracePeriodDays?: number;
  status: ChitStatus;
  description?: string;
  installmentType?: InstallmentType;
  monthlyIncreaseAmount?: number;
  stepUpConfig?: {
    increaseValue?: number;
  };
  auctions?: Auction[];
  isConfigured?: boolean;
  enrolledMemberIds?: string[];
  members?: (string | Member)[];
  schedule?: MonthlyScheduleItem[];
  monthStatuses?: Record<number, MonthStatus>;
  monthMemberAssignments?: Record<number, string[] | string>;
  monthOverrides?: Record<number, MonthCustomDetails>;
  monthPayouts?: Record<number, ChitPayout>;
}

export type Chit = ChitScheme;

export interface Company {
  id: string; // Unique permanent ID e.g. CMP-XXXXXXXX
  name: string;
  createdAt: string;
  status: 'Active' | 'Disabled';
}

export interface CompanySettings {
  companyName: string;
  name?: string;
  logoText?: string;
  address?: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  defaultCommission?: number;
  gracePeriod?: number;
  paymentModes?: string[];
  receiptPrefix?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  signatureText?: string;
  logo?: string;
}

export type UserRole = 'Super Admin' | 'Admin / Manager' | 'Staff' | 'Custom Role';
export type UserStatus = 'Active' | 'Disabled';

export interface UserAccount {
  id: string;
  companyId: string; // Scoped company ID
  companyName?: string;
  name: string;
  email: string;
  salt?: string;
  passwordVerifier?: string;
  activationToken?: string;
  activationCode?: string;
  role: UserRole;
  customRoleName?: string;
  status: UserStatus;
  permissions: string[];
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
}

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET'
  | 'CANCEL'
  | 'REVERSE'
  | 'EXPORT'
  | 'PRINT'
  | 'VIEW'
  | 'BACKUP_CREATED'
  | 'BACKUP_FAILED'
  | 'RESTORE_STARTED'
  | 'RESTORE_COMPLETED'
  | 'RESTORE_FAILED';

export type AuditModule =
  | 'Authentication'
  | 'Members'
  | 'Chits'
  | 'Payments'
  | 'Collections'
  | 'Receipts'
  | 'Expenses'
  | 'Users'
  | 'Staff'
  | 'Reports'
  | 'Settings'
  | 'System Backup'
  | 'Other';

export type AuditStatus = 'Success' | 'Failed';

export interface AuditFieldChange {
  field: string;
  label: string;
  previousValue: any;
  newValue: any;
}

export interface AuditLogEntry {
  id: string;
  companyId?: string;
  userId: string;
  userName: string;
  userRole: string;
  action: AuditAction;
  module: AuditModule;
  recordId?: string;
  recordName?: string;
  description: string;
  beforeData?: Record<string, any> | null;
  afterData?: Record<string, any> | null;
  changedFields?: AuditFieldChange[];
  ipAddress: string;
  userAgent: string;
  status: AuditStatus;
  failureReason?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface BackupMetadata {
  backup_version: string;
  application_name: string;
  application_version: string;
  database_schema_version: string;
  backup_type: string;
  created_at: string;
  created_by: string;
  created_by_role: string;
  records_count: {
    members: number;
    chits: number;
    transactions: number;
    payouts: number;
    users: number;
    audit_logs: number;
  };
}

export interface BackupPackage {
  metadata: BackupMetadata;
  checksum: string;
  data: {
    appData: any;
    users: any[];
    roleDefaults?: any;
    auditLogs: any[];
  };
}

export interface BackupHistoryItem {
  id: string;
  fileName: string;
  createdAt: string;
  createdBy: string;
  createdByRole: string;
  backupType: string;
  sizeBytes: number;
  sizeFormatted: string;
  status: 'Success' | 'Failed';
  checksum?: string;
  packageData?: BackupPackage;
}
