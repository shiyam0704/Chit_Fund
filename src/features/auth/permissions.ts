import { UserRole, UserStatus, UserAccount, Permission } from '@/types';

export type { UserRole, UserStatus, UserAccount, Permission };

export const ROOT_SUPERADMIN_ID = 'USR-SUPERADMIN';

export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: 'dashboard.view' as Permission,

  // Chits
  CHITS_VIEW: 'chits.view' as Permission,
  CHITS_CREATE: 'chits.create' as Permission,
  CHITS_EDIT: 'chits.edit' as Permission,
  CHITS_DELETE: 'chits.delete' as Permission,

  // Members
  MEMBERS_VIEW: 'members.view' as Permission,
  MEMBERS_CREATE: 'members.create' as Permission,
  MEMBERS_EDIT: 'members.edit' as Permission,
  MEMBERS_DELETE: 'members.delete' as Permission,

  // Payments
  PAYMENTS_VIEW: 'payments.view' as Permission,
  PAYMENTS_CREATE: 'payments.create' as Permission,
  PAYMENTS_EDIT: 'payments.edit' as Permission,
  PAYMENTS_DELETE: 'payments.delete' as Permission,

  // Reports
  REPORTS_VIEW: 'reports.view' as Permission,
  REPORTS_EXPORT: 'reports.export' as Permission,

  // Settings
  SETTINGS_VIEW: 'settings.view' as Permission,
  SETTINGS_EDIT: 'settings.edit' as Permission,

  // User Management
  USERS_VIEW: 'users.view' as Permission,
  USERS_CREATE: 'users.create' as Permission,
  USERS_EDIT: 'users.edit' as Permission,
  USERS_DELETE: 'users.delete' as Permission,
  USERS_MANAGE_PERMISSIONS: 'users.manage_permissions' as Permission,
  USERS_RESET_PASSWORD: 'users.reset_password' as Permission,
  USERS_ROLE_PERMISSIONS: 'users.role_permissions' as Permission,

  // Audit Trail
  AUDIT_TRAIL_VIEW: 'audit_trail.view' as Permission,
  AUDIT_TRAIL_EXPORT: 'audit_trail.export' as Permission,
  AUDIT_TRAIL_PRINT: 'audit_trail.print' as Permission,
  AUDIT_TRAIL_DELETE: 'audit_trail.delete' as Permission,

  // Backup & Restore
  BACKUP_VIEW: 'backup.view' as Permission,
  BACKUP_CREATE: 'backup.create' as Permission,
  BACKUP_RESTORE: 'backup.restore' as Permission,
  BACKUP_DOWNLOAD: 'backup.download' as Permission,
} as const;

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  'Super Admin': ALL_PERMISSIONS,
  'Admin / Manager': [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CHITS_VIEW,
    PERMISSIONS.CHITS_CREATE,
    PERMISSIONS.CHITS_EDIT,
    PERMISSIONS.MEMBERS_VIEW,
    PERMISSIONS.MEMBERS_CREATE,
    PERMISSIONS.MEMBERS_EDIT,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_CREATE,
    PERMISSIONS.PAYMENTS_EDIT,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.BACKUP_VIEW,
    PERMISSIONS.BACKUP_CREATE,
    PERMISSIONS.BACKUP_DOWNLOAD,
  ],
  Staff: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.MEMBERS_VIEW,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_CREATE,
    PERMISSIONS.REPORTS_VIEW,
  ],
  'Custom Role': [PERMISSIONS.DASHBOARD_VIEW],
};

export const DEFAULT_ADMIN_EMAIL = 'chitfundadmin@gmail.com';
export const DEFAULT_ADMIN_PASSWORD = 'adminchit@123';

const envEmail = ((import.meta as any).env?.VITE_ADMIN_EMAIL as string | undefined)?.trim();
const envPassword = ((import.meta as any).env?.VITE_ADMIN_PASSWORD as string | undefined)?.trim();

export const ADMIN_CREDENTIALS = {
  email: envEmail || DEFAULT_ADMIN_EMAIL,
  password: envPassword || DEFAULT_ADMIN_PASSWORD,
};

export const createDefaultSuperAdminUser = (): UserAccount => ({
  id: ROOT_SUPERADMIN_ID,
  name: 'Super Admin',
  email: ADMIN_CREDENTIALS.email,
  password: ADMIN_CREDENTIALS.password,
  role: 'Super Admin',
  status: 'Active',
  permissions: [...ALL_PERMISSIONS],
  createdAt: '2026-01-01T00:00:00.000Z',
});
