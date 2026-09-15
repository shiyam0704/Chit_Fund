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

const envEmail = ((import.meta as any).env?.VITE_ADMIN_EMAIL as string | undefined)?.trim();

export const ADMIN_CREDENTIALS = {
  email: envEmail || DEFAULT_ADMIN_EMAIL,
};

export const PERMISSION_ALIASES: Record<string, string[]> = {
  'dashboard.view': ['dashboard.view', 'VIEW_DASHBOARD', 'DASHBOARD_VIEW'],
  'chits.view': ['chits.view', 'VIEW_CHITS', 'CHITS_VIEW'],
  'chits.create': ['chits.create', 'CHITS_CREATE', 'CREATE_CHITS'],
  'chits.edit': ['chits.edit', 'CHITS_EDIT', 'EDIT_CHITS'],
  'chits.delete': ['chits.delete', 'CHITS_DELETE', 'DELETE_CHITS'],
  'members.view': ['members.view', 'VIEW_MEMBERS', 'MEMBERS_VIEW'],
  'members.create': ['members.create', 'MEMBERS_CREATE', 'CREATE_MEMBERS'],
  'members.edit': ['members.edit', 'MEMBERS_EDIT', 'EDIT_MEMBERS'],
  'members.delete': ['members.delete', 'MEMBERS_DELETE', 'DELETE_MEMBERS'],
  'payments.view': ['payments.view', 'VIEW_PAYMENTS', 'PAYMENTS_VIEW', 'COLLECTIONS_VIEW', 'VIEW_COLLECTIONS'],
  'payments.create': ['payments.create', 'PAYMENTS_CREATE', 'CREATE_PAYMENTS', 'COLLECTIONS_CREATE', 'CREATE_COLLECTIONS'],
  'payments.edit': ['payments.edit', 'PAYMENTS_EDIT', 'EDIT_PAYMENTS', 'COLLECTIONS_EDIT', 'EDIT_COLLECTIONS'],
  'payments.delete': ['payments.delete', 'PAYMENTS_DELETE', 'DELETE_PAYMENTS', 'COLLECTIONS_DELETE', 'DELETE_COLLECTIONS'],
  'reports.view': ['reports.view', 'VIEW_REPORTS', 'REPORTS_VIEW'],
  'reports.export': ['reports.export', 'REPORTS_EXPORT', 'EXPORT_REPORTS'],
  'settings.view': ['settings.view', 'VIEW_SETTINGS', 'SETTINGS_VIEW'],
  'settings.edit': ['settings.edit', 'SETTINGS_EDIT', 'EDIT_SETTINGS'],
  'users.view': ['users.view', 'VIEW_USERS', 'USERS_VIEW'],
  'users.create': ['users.create', 'USERS_CREATE', 'CREATE_USERS'],
  'users.edit': ['users.edit', 'USERS_EDIT', 'EDIT_USERS'],
  'users.delete': ['users.delete', 'USERS_DELETE', 'DELETE_USERS'],
  'users.manage_permissions': ['users.manage_permissions', 'USERS_MANAGE_PERMISSIONS'],
  'users.reset_password': ['users.reset_password', 'USERS_RESET_PASSWORD'],
  'users.role_permissions': ['users.role_permissions', 'USERS_ROLE_PERMISSIONS'],
  'audit_trail.view': ['audit_trail.view', 'VIEW_AUDIT_TRAIL', 'AUDIT_TRAIL_VIEW'],
  'audit_trail.export': ['audit_trail.export', 'AUDIT_EXPORT', 'AUDIT_TRAIL_EXPORT'],
  'audit_trail.print': ['audit_trail.print', 'AUDIT_PRINT', 'AUDIT_TRAIL_PRINT'],
  'audit_trail.delete': ['audit_trail.delete', 'AUDIT_CLEAR', 'AUDIT_TRAIL_DELETE'],
  'backup.view': ['backup.view', 'VIEW_BACKUP', 'BACKUP_VIEW'],
  'backup.create': ['backup.create', 'BACKUP_CREATE', 'CREATE_BACKUP'],
  'backup.restore': ['backup.restore', 'BACKUP_RESTORE', 'RESTORE_BACKUP'],
  'backup.download': ['backup.download', 'BACKUP_DOWNLOAD', 'DOWNLOAD_BACKUP'],
};

export function matchPermission(userPermissions: string[] | undefined, required: string): boolean {
  if (!userPermissions || !Array.isArray(userPermissions)) return false;
  const aliases = PERMISSION_ALIASES[required] || [required];
  return userPermissions.some((p) => {
    if (aliases.includes(p)) return true;
    const pAliases = PERMISSION_ALIASES[p];
    if (pAliases && pAliases.includes(required)) return true;
    return false;
  });
}

export const createDefaultSuperAdminUser = (): UserAccount => ({
  id: ROOT_SUPERADMIN_ID,
  companyId: 'CMP-DEFAULT',
  companyName: 'Chit Fund Management',
  name: 'Super Admin',
  email: ADMIN_CREDENTIALS.email,
  role: 'Super Admin',
  status: 'Active',
  permissions: [...ALL_PERMISSIONS],
  createdAt: '2026-01-01T00:00:00.000Z',
});

