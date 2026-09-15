import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  UserRole,
  UserStatus,
  UserAccount,
  Permission,
  PERMISSIONS,
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  ROOT_SUPERADMIN_ID,
  ADMIN_CREDENTIALS,
  createDefaultSuperAdminUser,
  // Bidirectional permission alias matcher
  matchPermission,
} from '../permissions';
import { Company } from '@/types';
import { logActivity } from '@/shared/services/auditService';
import { getAppData, saveAppData, clearAllCompanyMemoryCaches } from '@/shared/utils/storage';
import { clearAllCompanyLocalCaches } from '@/shared/services/companyDataService';
import { initializeLocalApplication } from '@/shared/utils/initialization';
import {
  USERS_STORAGE_KEY,
  AUTH_STORAGE_KEY,
  AuthSession,
  initializeAuthStorage,
  getStoredUsers,
  saveStoredUsers,
  getStoredAuthSession,
  saveStoredAuthSession,
  clearStoredAuthSession,
} from '../utils/authStorage';
import {
  getStoredCompanies,
  registerCompany,
  createNewCompany,
  getCompanyById,
  DEFAULT_COMPANY_ID,
  DEFAULT_COMPANY_NAME,
  createDefaultCompany,
} from '../utils/companyStorage';
import {
  generateStaffActivationCredential,
  generateCredentialFromVerifier,
  verifyAndParseActivationCredential,
  invalidateActivationCode,
  ChitUserFile,
} from '../utils/cryptoIdentityService';
import { apiFetch, setAuthToken, clearAuthToken, getAuthToken } from '@/shared/services/apiClient';

export {
  ADMIN_CREDENTIALS,
  createDefaultSuperAdminUser,
  USERS_STORAGE_KEY,
  AUTH_STORAGE_KEY,
  initializeAuthStorage,
  getStoredUsers,
  saveStoredUsers,
  getStoredAuthSession,
  saveStoredAuthSession,
  clearStoredAuthSession,
};
export type { AuthSession };

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  companyId?: string;
  role: UserRole;
  customRoleName?: string;
  status: UserStatus;
  permissions?: Permission[];
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  password?: string;
  companyId?: string;
  role?: UserRole;
  customRoleName?: string;
  status?: UserStatus;
  permissions?: Permission[];
}

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: UserAccount | null;
  email: string | null;
  users: UserAccount[];
  companyId: string;
  companyName: string;
  companies: Company[];
  activeCompany: Company;
  switchCompany: (companyId: string) => void;
  createCompany: (name: string) => Company;
  login: (usernameOrEmail: string, password: string) => Promise<{ success: boolean; message?: string; user?: UserAccount }>;
  logout: () => void;
  activateStaffAccount: (credentialInput: string) => Promise<{ success: boolean; message: string; user?: UserAccount }>;
  generateUserActivationCredential: (
    userId: string,
    passwordPlaintext?: string,
    fallbackUser?: UserAccount
  ) => Promise<{ token?: string; chitUserFile?: ChitUserFile; activationCode?: string; error?: string }>;
  // RBAC Permission Helpers
  hasPermission: (permission: Permission | string) => boolean;
  hasAnyPermission: (permissions: (Permission | string)[]) => boolean;
  hasAllPermissions: (permissions: (Permission | string)[]) => boolean;
  isSuperAdmin: () => boolean;
  // Role Matrix Defaults
  getRoleDefaults: (role: UserRole) => Permission[];
  updateRoleDefaults: (role: UserRole, permissions: Permission[]) => { success: boolean; message?: string };
  // User Management
  createUser: (data: CreateUserData) => Promise<{ success: boolean; message?: string; user?: UserAccount; token?: string; chitUserFile?: ChitUserFile }>;
  updateUser: (id: string, data: UpdateUserData) => Promise<{ success: boolean; message?: string }>;
  updateUserPermissions: (id: string, permissions: Permission[]) => Promise<{ success: boolean; message?: string }>;
  resetUserPassword: (id: string, newPassword: string) => Promise<{ success: boolean; message?: string }>;
  toggleUserStatus: (id: string) => Promise<{ success: boolean; message?: string }>;
  deleteUser: (id: string) => Promise<{ success: boolean; message?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [session, setSession] = useState<AuthSession>(getStoredAuthSession);
  const [activeUser, setActiveUser] = useState<UserAccount | null>(null);
  const [companies, setCompanies] = useState<Company[]>(getStoredCompanies);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiFetch<{ success: boolean; users: UserAccount[] }>('users.php?action=list');
      if (res?.success && Array.isArray(res.users)) {
        setUsers(res.users);
      }
    } catch {
      // Users list is only accessible to users with users.view / Super Admin
    }
  }, []);

  // Initialize and verify session on initial mount
  useEffect(() => {
    initializeAuthStorage();
    initializeLocalApplication();

    const verifySession = async () => {
      const token = getAuthToken();
      if (!token) {
        if (session.isAuthenticated) {
          clearStoredAuthSession();
          setSession(getStoredAuthSession());
          setActiveUser(null);
        }
        return;
      }

      try {
        const res = await apiFetch<{
          success: boolean;
          user: any;
          company: any;
        }>('auth.php?action=me');

        if (res?.success && res.user) {
          const u = res.user;
          const normalized: UserAccount = {
            id: u.id,
            companyId: u.companyId,
            companyName: res.company?.name || u.companyName || 'Chit Fund Management',
            name: u.name,
            email: u.email,
            role: u.role,
            customRoleName: u.customRoleName,
            status: u.status || 'Active',
            permissions: Array.isArray(u.permissions) ? u.permissions : [],
            createdAt: u.createdAt || new Date().toISOString(),
          };
          setActiveUser(normalized);

          const newSess: AuthSession = {
            isAuthenticated: true,
            userId: u.id,
            email: u.email,
            companyId: u.companyId,
            companyName: res.company?.name || u.companyName || 'Chit Fund Management',
            role: u.role,
          };
          saveStoredAuthSession(newSess);
          setSession(newSess);

          if (u.role === 'Super Admin' || (u.permissions && (u.permissions.includes('users.view') || u.permissions.includes('VIEW_USERS')))) {
            fetchUsers();
          }
        }
      } catch (err) {
        console.warn('Session check failed, clearing invalid session:', err);
        clearAuthToken();
        clearStoredAuthSession();
        setSession({
          isAuthenticated: false,
          userId: null,
          email: null,
          companyId: null,
          companyName: null,
          role: null,
        });
        setActiveUser(null);
      }
    };

    verifySession();
  }, [fetchUsers]);

  // Listen for unauthorized 401 events dispatched by apiClient
  useEffect(() => {
    const handleUnauthorized = () => {
      clearAuthToken();
      clearStoredAuthSession();
      clearAllCompanyMemoryCaches();
      clearAllCompanyLocalCaches();
      setSession({
        isAuthenticated: false,
        userId: null,
        email: null,
        companyId: null,
        companyName: null,
        role: null,
      });
      setActiveUser(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chitfund_session_cleared'));
      }
    };
    window.addEventListener('chitfund_auth_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('chitfund_auth_unauthorized', handleUnauthorized);
  }, []);

  // Resolve current active UserAccount
  const currentUser = useMemo(() => {
    if (!session.isAuthenticated) return null;
    if (activeUser && (activeUser.id === session.userId || activeUser.email.toLowerCase() === (session.email || '').toLowerCase())) {
      return activeUser;
    }
    const found = users.find((u) => u.id === session.userId || u.email.toLowerCase() === (session.email || '').toLowerCase());
    if (found) return found;

    if (session.userId) {
      return {
        id: session.userId,
        companyId: session.companyId || DEFAULT_COMPANY_ID,
        companyName: session.companyName || DEFAULT_COMPANY_NAME,
        name: session.email ? session.email.split('@')[0] : 'User',
        email: session.email || '',
        role: (session.role as UserRole) || 'Staff',
        status: 'Active' as UserStatus,
        permissions: session.role === 'Super Admin' ? [...ALL_PERMISSIONS] : [],
        createdAt: '2026-01-01T00:00:00.000Z',
      };
    }
    return null;
  }, [session, activeUser, users]);

  // Active Company ID & Name
  const companyId = useMemo(() => {
    return session.companyId || currentUser?.companyId || DEFAULT_COMPANY_ID;
  }, [session.companyId, currentUser?.companyId]);

  const activeCompany = useMemo(() => {
    return (
      companies.find((c) => c.id === companyId) ||
      getCompanyById(companyId) ||
      createDefaultCompany(session.companyName || DEFAULT_COMPANY_NAME)
    );
  }, [companies, companyId, session.companyName]);

  const companyName = activeCompany.name;

  // ---------------------------------------------------------------------------
  // COMPANY SWITCHING & CREATION
  // ---------------------------------------------------------------------------
  const switchCompany = useCallback(
    (newCompanyId: string) => {
      const target = companies.find((c) => c.id === newCompanyId) || getCompanyById(newCompanyId);
      if (!target) return;

      const newSession: AuthSession = {
        ...session,
        companyId: target.id,
        companyName: target.name,
      };
      saveStoredAuthSession(newSession);
      setSession(newSession);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chitfund_company_changed', { detail: target.id }));
      }
    },
    [session, companies]
  );

  const createCompany = useCallback(
    (name: string): Company => {
      const created = createNewCompany(name);
      setCompanies(getStoredCompanies());
      return created;
    },
    []
  );

  // ---------------------------------------------------------------------------
  // AUTHENTICATION: LOGIN & LOGOUT
  // ---------------------------------------------------------------------------
  const login = async (
    usernameOrEmail: string,
    password: string
  ): Promise<{ success: boolean; message?: string; user?: UserAccount }> => {
    const cleanInput = (usernameOrEmail || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();
    if (!cleanInput || !cleanPassword) {
      return { success: false, message: 'Please enter both username/email and password.' };
    }

    try {
      const apiRes = await apiFetch<{
        success: boolean;
        token: string;
        user: any;
        company: any;
      }>('auth.php?action=login', {
        method: 'POST',
        body: JSON.stringify({ email: cleanInput, password: cleanPassword }),
        skipAuth: true,
      });

      if (apiRes?.success && apiRes.token) {
        clearAllCompanyMemoryCaches();
        setAuthToken(apiRes.token);
        const apiUser = apiRes.user;
        const apiCompany = apiRes.company;

        const newSession: AuthSession = {
          isAuthenticated: true,
          userId: apiUser.id,
          email: apiUser.email,
          companyId: apiUser.companyId,
          companyName: apiCompany?.name || 'Chit Fund Management',
          role: apiUser.role,
        };

        saveStoredAuthSession(newSession);
        setSession(newSession);

        const normalizedUser: UserAccount = {
          id: apiUser.id,
          companyId: apiUser.companyId,
          companyName: apiCompany?.name || 'Chit Fund Management',
          name: apiUser.name,
          email: apiUser.email,
          role: apiUser.role,
          customRoleName: apiUser.customRoleName,
          status: apiUser.status || 'Active',
          permissions: Array.isArray(apiUser.permissions) ? apiUser.permissions : [],
          createdAt: apiUser.createdAt || new Date().toISOString(),
        };

        setActiveUser(normalizedUser);

        registerCompany({
          id: apiCompany.id,
          name: apiCompany.name,
          status: apiCompany.status || 'Active',
          createdAt: new Date().toISOString(),
        });
        setCompanies(getStoredCompanies());

        // Fetch users roster if authorized
        if (apiUser.role === 'Super Admin' || (apiUser.permissions && (apiUser.permissions.includes('users.view') || apiUser.permissions.includes('VIEW_USERS')))) {
          fetchUsers();
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('chitfund_company_changed', { detail: normalizedUser.companyId }));
        }

        logActivity({
          companyId: apiUser.companyId,
          userId: apiUser.id,
          userName: apiUser.name,
          userRole: apiUser.role,
          action: 'LOGIN_SUCCESS',
          module: 'Authentication',
          description: `User "${apiUser.name}" (${apiUser.role}) logged in successfully`,
          status: 'Success',
        });

        return { success: true, user: normalizedUser };
      }

      return { success: false, message: 'Invalid username/email or password.' };
    } catch (apiErr: any) {
      const errMsg = apiErr?.message || 'Invalid username/email or password.';
      return { success: false, message: errMsg };
    }
  };

  const logout = useCallback(() => {
    logActivity({
      companyId: companyId,
      userId: currentUser?.id || session.userId || 'USR-SUPERADMIN',
      userName: currentUser?.name || session.email || 'User',
      userRole: currentUser?.role || 'Super Admin',
      action: 'LOGOUT',
      module: 'Authentication',
      description: `User "${currentUser?.name || session.email || 'User'}" logged out`,
      status: 'Success',
    });

    clearStoredAuthSession();
    clearAuthToken();
    clearAllCompanyMemoryCaches();
    clearAllCompanyLocalCaches();
    setActiveUser(null);
    setUsers([]);
    setSession({
      isAuthenticated: false,
      userId: null,
      email: null,
      companyId: null,
      companyName: null,
      role: null,
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chitfund_session_cleared'));
    }
  }, [currentUser, session, companyId]);

  // ---------------------------------------------------------------------------
  // CROSS-DEVICE ACCOUNT ACTIVATION FLOW
  // ---------------------------------------------------------------------------
  const activateStaffAccount = async (
    credentialInput: string
  ): Promise<{ success: boolean; message: string; user?: UserAccount }> => {
    try {
      const verification = await verifyAndParseActivationCredential(credentialInput);
      if (!verification.isValid || !verification.payload) {
        return {
          success: false,
          message: verification.error || 'Invalid or tampered account invitation credential.',
        };
      }

      const payload = verification.payload;
      registerCompany({
        id: payload.companyId,
        name: payload.companyName,
        createdAt: payload.issuedAt,
        status: 'Active',
      });
      setCompanies(getStoredCompanies());

      return {
        success: true,
        message: `Account for ${payload.name} (${payload.companyName}) verified successfully! You can now log in with your credentials.`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'An unexpected error occurred during account activation.',
      };
    }
  };

  const generateUserActivationCredential = async (
    userId: string,
    passwordPlaintext?: string,
    fallbackUser?: UserAccount
  ): Promise<{ token?: string; chitUserFile?: ChitUserFile; activationCode?: string; error?: string }> => {
    let targetUser = users.find((u) => u.id === userId || u.email?.toLowerCase() === userId.toLowerCase());
    
    if (!targetUser && fallbackUser) {
      targetUser = fallbackUser;
    }

    if (!targetUser) {
      try {
        const res = await apiFetch<{ success: boolean; users: UserAccount[] }>('users.php?action=list');
        if (res?.success && Array.isArray(res.users)) {
          setUsers(res.users);
          targetUser = res.users.find((u) => u.id === userId || u.email?.toLowerCase() === userId.toLowerCase());
        }
      } catch {}
    }

    if (!targetUser) {
      return { error: 'User not found. Please refresh user list.' };
    }

    const targetCompany = (targetUser.companyId && getCompanyById(targetUser.companyId)) || activeCompany;

    try {
      if (targetUser.activationCode) {
        invalidateActivationCode(targetUser.activationCode);
      }

      if (passwordPlaintext) {
        const cred = await generateStaffActivationCredential({
          userId: targetUser.id,
          companyId: targetUser.companyId,
          companyName: targetCompany.name,
          email: targetUser.email,
          name: targetUser.name,
          role: targetUser.role,
          customRoleName: targetUser.customRoleName,
          status: targetUser.status,
          permissions: targetUser.permissions,
          passwordPlaintext,
        });

        return { token: cred.token, chitUserFile: cred.chitUserFile, activationCode: cred.activationCode };
      }

      if (targetUser.salt && targetUser.passwordVerifier) {
        const cred = await generateCredentialFromVerifier({
          userId: targetUser.id,
          companyId: targetUser.companyId,
          companyName: targetCompany.name,
          email: targetUser.email,
          name: targetUser.name,
          role: targetUser.role,
          customRoleName: targetUser.customRoleName,
          status: targetUser.status,
          permissions: targetUser.permissions,
          salt: targetUser.salt,
          verifier: targetUser.passwordVerifier,
        });

        return { token: cred.token, chitUserFile: cred.chitUserFile, activationCode: cred.activationCode };
      }

      return { error: 'Please enter the user password to generate a fresh portable credential.' };
    } catch (err: any) {
      return { error: err.message || 'Failed to generate credential.' };
    }
  };

  // ---------------------------------------------------------------------------
  // RBAC PERMISSION HELPERS
  // ---------------------------------------------------------------------------
  const isSuperAdmin = useCallback((): boolean => {
    return currentUser?.role === 'Super Admin' || session.role === 'Super Admin';
  }, [currentUser, session.role]);

  const hasPermission = useCallback(
    (permission: Permission | string): boolean => {
      if (!currentUser) return false;
      if (currentUser.role === 'Super Admin' || session.role === 'Super Admin') return true;
      if (currentUser.status === 'Disabled') return false;
      return matchPermission(currentUser.permissions, String(permission));
    },
    [currentUser, session.role]
  );

  const hasAnyPermission = useCallback(
    (permissions: (Permission | string)[]): boolean => {
      if (!currentUser) return false;
      if (currentUser.role === 'Super Admin' || session.role === 'Super Admin') return true;
      if (currentUser.status === 'Disabled') return false;
      return permissions.some((p) => matchPermission(currentUser.permissions, String(p)));
    },
    [currentUser, session.role]
  );

  const hasAllPermissions = useCallback(
    (permissions: (Permission | string)[]): boolean => {
      if (!currentUser) return false;
      if (currentUser.role === 'Super Admin' || session.role === 'Super Admin') return true;
      if (currentUser.status === 'Disabled') return false;
      return permissions.every((p) => matchPermission(currentUser.permissions, String(p)));
    },
    [currentUser, session.role]
  );

  // ---------------------------------------------------------------------------
  // ROLE MATRIX DEFAULT POLICIES
  // ---------------------------------------------------------------------------
  const getRoleDefaults = useCallback((role: UserRole): Permission[] => {
    if (role === 'Super Admin') return [...ALL_PERMISSIONS];
    try {
      const appData = getAppData();
      const custom = appData.roleDefaults?.[role];
      if (custom && Array.isArray(custom)) return custom;
    } catch {
      // fallback
    }
    return DEFAULT_ROLE_PERMISSIONS[role] || [PERMISSIONS.DASHBOARD_VIEW];
  }, []);

  const updateRoleDefaults = useCallback(
    (role: UserRole, permissions: Permission[]): { success: boolean; message?: string } => {
      if (!isSuperAdmin()) {
        return { success: false, message: 'Only Super Admin can configure role permissions defaults.' };
      }
      try {
        const appData = getAppData();
        if (!appData.roleDefaults) appData.roleDefaults = {};
        appData.roleDefaults[role] = permissions;
        saveAppData(appData);
        return { success: true };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    },
    [isSuperAdmin]
  );

  // ---------------------------------------------------------------------------
  // USER MANAGEMENT (CENTRAL PERSISTENT BACKEND)
  // ---------------------------------------------------------------------------
  const createUser = async (
    data: CreateUserData
  ): Promise<{
    success: boolean;
    message?: string;
    user?: UserAccount;
    token?: string;
    chitUserFile?: ChitUserFile;
  }> => {
    if (!isSuperAdmin() && !hasPermission(PERMISSIONS.USERS_CREATE)) {
      return { success: false, message: 'You do not have permission to create user accounts.' };
    }

    const trimmedName = data.name.trim();
    const trimmedEmail = data.email.trim();
    if (!trimmedName || !trimmedEmail) {
      return { success: false, message: 'Name and Email/Username are required.' };
    }

    if (!data.password || data.password.length < 4) {
      return { success: false, message: 'Password must be at least 4 characters long.' };
    }

    const role = data.role || 'Staff';
    let assignedPermissions: Permission[] = [];
    if (role === 'Super Admin') {
      assignedPermissions = [...ALL_PERMISSIONS];
    } else if (data.permissions && Array.isArray(data.permissions) && data.permissions.length > 0) {
      assignedPermissions = data.permissions;
    } else {
      assignedPermissions = getRoleDefaults(role);
    }

    const targetCompanyId = data.companyId || companyId || DEFAULT_COMPANY_ID;

    try {
      const res = await apiFetch<{
        success: boolean;
        id: string;
        user: UserAccount;
        message?: string;
      }>('users.php?action=create', {
        method: 'POST',
        body: JSON.stringify({
          companyId: targetCompanyId,
          name: trimmedName,
          email: trimmedEmail,
          password: data.password,
          role,
          customRoleName: data.customRoleName?.trim(),
          status: data.status || 'Active',
          permissions: assignedPermissions,
        }),
      });

      if (res?.success && res.user) {
        await fetchUsers();

        logActivity({
          companyId: targetCompanyId,
          userId: currentUser?.id,
          userName: currentUser?.name,
          userRole: currentUser?.role,
          action: 'CREATE',
          module: 'Users',
          recordId: res.id,
          recordName: trimmedName,
          description: `Created new ${role} user account "${trimmedName}" (${trimmedEmail})`,
          status: 'Success',
        });

        return {
          success: true,
          user: res.user,
        };
      }

      return { success: false, message: res?.message || 'Failed to create user.' };
    } catch (apiErr: any) {
      return { success: false, message: apiErr.message || 'Failed to create user account on central database.' };
    }
  };

  const updateUser = async (id: string, data: UpdateUserData): Promise<{ success: boolean; message?: string }> => {
    if (!isSuperAdmin() && !hasPermission(PERMISSIONS.USERS_EDIT)) {
      return { success: false, message: 'You do not have permission to edit user accounts.' };
    }

    const targetUser = users.find((u) => u.id === id);
    if (!targetUser && id !== 'USR-ROOT-001') {
      return { success: false, message: 'User not found.' };
    }

    try {
      const res = await apiFetch<{ success: boolean; message?: string }>('users.php?action=update', {
        method: 'POST',
        body: JSON.stringify({
          id,
          name: data.name,
          email: data.email,
          role: data.role,
          status: data.status,
          customRoleName: data.customRoleName,
          permissions: data.permissions,
          password: data.password,
        }),
      });

      if (res?.success) {
        await fetchUsers();
        logActivity({
          companyId: targetUser?.companyId || companyId,
          userId: currentUser?.id,
          userName: currentUser?.name,
          userRole: currentUser?.role,
          action: 'UPDATE',
          module: 'Users',
          recordId: id,
          recordName: data.name || targetUser?.name || id,
          description: `Updated user account details for "${data.name || targetUser?.name || id}"`,
          status: 'Success',
        });
        return { success: true };
      }
      return { success: false, message: res?.message || 'Failed to update user.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to update user on central database.' };
    }
  };

  const updateUserPermissions = async (id: string, permissions: Permission[]): Promise<{ success: boolean; message?: string }> => {
    if (!isSuperAdmin() && !hasPermission(PERMISSIONS.USERS_MANAGE_PERMISSIONS)) {
      return { success: false, message: 'You do not have permission to configure user permissions.' };
    }

    const targetUser = users.find((u) => u.id === id);
    if (id === 'USR-ROOT-001' || id === ROOT_SUPERADMIN_ID || targetUser?.role === 'Super Admin') {
      return { success: false, message: 'Permissions cannot be removed from the Super Admin account.' };
    }

    try {
      const res = await apiFetch<{ success: boolean; message?: string }>('users.php?action=update_permissions', {
        method: 'POST',
        body: JSON.stringify({ id, permissions }),
      });

      if (res?.success) {
        await fetchUsers();
        logActivity({
          companyId: targetUser?.companyId || companyId,
          userId: currentUser?.id,
          userName: currentUser?.name,
          userRole: currentUser?.role,
          action: 'UPDATE',
          module: 'Users',
          recordId: id,
          recordName: targetUser?.name || id,
          description: `Updated permissions for user "${targetUser?.name || id}" (${permissions.length} permissions assigned)`,
          status: 'Success',
        });
        return { success: true };
      }
      return { success: false, message: res?.message || 'Failed to update permissions.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to update user permissions on central database.' };
    }
  };

  const resetUserPassword = async (
    id: string,
    newPassword: string
  ): Promise<{ success: boolean; message?: string }> => {
    if (!isSuperAdmin() && !hasPermission(PERMISSIONS.USERS_RESET_PASSWORD)) {
      return { success: false, message: 'You do not have permission to reset user passwords.' };
    }

    if (!newPassword || newPassword.length < 4) {
      return { success: false, message: 'Password must be at least 4 characters long.' };
    }

    const targetUser = users.find((u) => u.id === id);

    try {
      const res = await apiFetch<{ success: boolean; message?: string }>('users.php?action=reset_password', {
        method: 'POST',
        body: JSON.stringify({ id, password: newPassword }),
      });

      if (res?.success) {
        logActivity({
          companyId: targetUser?.companyId || companyId,
          userId: currentUser?.id,
          userName: currentUser?.name,
          userRole: currentUser?.role,
          action: 'PASSWORD_RESET',
          module: 'Users',
          recordId: id,
          recordName: targetUser?.name || id,
          description: `Reset password for user "${targetUser?.name || id}"`,
          status: 'Success',
        });
        return { success: true };
      }
      return { success: false, message: res?.message || 'Failed to reset password.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to reset password on central database.' };
    }
  };

  const toggleUserStatus = async (id: string): Promise<{ success: boolean; message?: string }> => {
    if (!isSuperAdmin() && !hasPermission(PERMISSIONS.USERS_EDIT)) {
      return { success: false, message: 'You do not have permission to toggle account status.' };
    }

    const targetUser = users.find((u) => u.id === id);
    if (id === ROOT_SUPERADMIN_ID || id === 'USR-ROOT-001' || targetUser?.role === 'Super Admin') {
      return { success: false, message: 'The Super Admin account cannot be disabled.' };
    }

    try {
      const res = await apiFetch<{ success: boolean; newStatus?: string; message?: string }>('users.php?action=toggle_status', {
        method: 'POST',
        body: JSON.stringify({ id }),
      });

      if (res?.success) {
        await fetchUsers();
        logActivity({
          companyId: targetUser?.companyId || companyId,
          userId: currentUser?.id,
          userName: currentUser?.name,
          userRole: currentUser?.role,
          action: 'UPDATE',
          module: 'Users',
          recordId: id,
          recordName: targetUser?.name || id,
          description: `Changed account status for "${targetUser?.name || id}" to ${res.newStatus}`,
          status: 'Success',
        });
        return { success: true, message: res.message };
      }
      return { success: false, message: res?.message || 'Failed to update user status.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to toggle status on central database.' };
    }
  };

  const deleteUser = async (id: string): Promise<{ success: boolean; message?: string }> => {
    if (!isSuperAdmin() && !hasPermission(PERMISSIONS.USERS_DELETE)) {
      return { success: false, message: 'You do not have permission to delete user accounts.' };
    }

    const targetUser = users.find((u) => u.id === id);
    if (id === ROOT_SUPERADMIN_ID || id === 'USR-ROOT-001' || targetUser?.role === 'Super Admin') {
      return { success: false, message: 'The Super Admin account cannot be deleted.' };
    }

    try {
      const res = await apiFetch<{ success: boolean; message?: string }>('users.php?action=delete', {
        method: 'POST',
        body: JSON.stringify({ id }),
      });

      if (res?.success) {
        await fetchUsers();
        logActivity({
          companyId: targetUser?.companyId || companyId,
          userId: currentUser?.id,
          userName: currentUser?.name,
          userRole: currentUser?.role,
          action: 'DELETE',
          module: 'Users',
          recordId: id,
          recordName: targetUser?.name || id,
          description: `Deleted user account "${targetUser?.name || id}"`,
          status: 'Success',
        });
        return { success: true };
      }
      return { success: false, message: res?.message || 'Failed to delete user.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to delete user on central database.' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: session.isAuthenticated,
        currentUser,
        email: currentUser?.email || session.email,
        users,
        companyId,
        companyName,
        companies,
        activeCompany,
        switchCompany,
        createCompany,
        login,
        logout,
        activateStaffAccount,
        generateUserActivationCredential,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        isSuperAdmin,
        getRoleDefaults,
        updateRoleDefaults,
        createUser,
        updateUser,
        updateUserPermissions,
        resetUserPassword,
        toggleUserStatus,
        deleteUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
