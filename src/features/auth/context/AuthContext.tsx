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
} from '../permissions';
import { Company } from '@/types';
import { logActivity } from '@/shared/services/auditService';
import { getAppData, saveAppData } from '@/shared/utils/storage';
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
  saveStoredCompanies,
  registerCompany,
  createNewCompany,
  getCompanyById,
  DEFAULT_COMPANY_ID,
  DEFAULT_COMPANY_NAME,
  createDefaultCompany,
} from '../utils/companyStorage';
import {
  verifyPassword,
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
    passwordPlaintext?: string
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
  updateUser: (id: string, data: UpdateUserData) => { success: boolean; message?: string };
  updateUserPermissions: (id: string, permissions: Permission[]) => { success: boolean; message?: string };
  resetUserPassword: (id: string, newPassword: string) => Promise<{ success: boolean; message?: string }>;
  toggleUserStatus: (id: string) => { success: boolean; message?: string };
  deleteUser: (id: string) => { success: boolean; message?: string };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    initializeAuthStorage();
    initializeLocalApplication();
  }, []);

  const [users, setUsers] = useState<UserAccount[]>(getStoredUsers);
  const [session, setSession] = useState<AuthSession>(getStoredAuthSession);
  const [companies, setCompanies] = useState<Company[]>(getStoredCompanies);

  // Sync users, session, and companies across tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === USERS_STORAGE_KEY) {
        setUsers(getStoredUsers());
      }
      if (e.key === AUTH_STORAGE_KEY) {
        setSession(getStoredAuthSession());
      }
      if (e.key === 'chitfund_companies') {
        setCompanies(getStoredCompanies());
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Resolve current active UserAccount
  const currentUser = useMemo(() => {
    if (!session.isAuthenticated) return null;
    const found =
      users.find((u) => u.id === session.userId) ||
      users.find((u) => u.email.toLowerCase() === (session.email || '').toLowerCase()) ||
      users.find((u) => u.role === 'Super Admin') ||
      users[0];
    return found || null;
  }, [session, users]);

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

  // If active user is disabled while session is active, force sign out
  useEffect(() => {
    if (currentUser && currentUser.status === 'Disabled') {
      logout();
    }
  }, [currentUser]);

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

      // Trigger cross-context reactive company update
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

    // 1. Attempt Central Database Authentication via API
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
        setAuthToken(apiRes.token);
        const apiUser = apiRes.user;
        const apiCompany = apiRes.company;

        const newSession: AuthSession = {
          isAuthenticated: true,
          userId: apiUser.id,
          email: apiUser.email,
          companyId: apiUser.companyId,
          companyName: apiCompany.name,
          role: apiUser.role,
        };

        saveStoredAuthSession(newSession);
        setSession(newSession);

        // Keep user and company updated locally for offline access
        registerCompany({
          id: apiCompany.id,
          name: apiCompany.name,
          status: apiCompany.status || 'Active',
          createdAt: new Date().toISOString(),
        });
        setCompanies(getStoredCompanies());

        const currentUsersList = getStoredUsers();
        const normalizedApiUser: UserAccount = {
          ...apiUser,
          createdAt: apiUser.createdAt || new Date().toISOString(),
          permissions: Array.isArray(apiUser.permissions) ? apiUser.permissions : [],
        };
        const updatedUsers = currentUsersList.some((u) => u.id === normalizedApiUser.id)
          ? currentUsersList.map((u) => (u.id === normalizedApiUser.id ? { ...u, ...normalizedApiUser } : u))
          : [normalizedApiUser, ...currentUsersList];
        saveStoredUsers(updatedUsers);
        setUsers(updatedUsers);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('chitfund_company_changed', { detail: normalizedApiUser.companyId }));
        }

        logActivity({
          companyId: apiUser.companyId,
          userId: apiUser.id,
          userName: apiUser.name,
          userRole: apiUser.role,
          action: 'LOGIN_SUCCESS',
          module: 'Authentication',
          description: `User "${apiUser.name}" (${apiUser.role}) logged in to company "${apiCompany.name}" via central database`,
          status: 'Success',
        });

        return { success: true, user: apiUser };
      }
    } catch (apiErr: any) {
      const errMsg = apiErr?.message || '';
      if (errMsg.includes('Invalid email or password') || errMsg.includes('suspended') || errMsg.includes('deactivated')) {
        return { success: false, message: errMsg };
      }
      console.warn('Central database login failed, checking local credentials fallback', apiErr);
    }

    // 2. Fallback to LocalStorage Credentials
    initializeAuthStorage();
    initializeLocalApplication();

    const currentUsersList = getStoredUsers();

    const isSuperAdminAlias =
      cleanInput === 'chitfundadmin@gmail.com' ||
      cleanInput === ADMIN_CREDENTIALS.email.trim().toLowerCase() ||
      cleanInput === 'chitfundadmin@123' ||
      cleanInput === 'admin@chitfund.com' ||
      cleanInput === 'admin' ||
      cleanInput === 'chitfundadmin' ||
      cleanInput === 'super admin' ||
      cleanInput === 'superadmin' ||
      cleanInput === 'adminchit@123';

    let matchedUser = currentUsersList.find(
      (u) => (u.email || '').trim().toLowerCase() === cleanInput || (u.name || '').trim().toLowerCase() === cleanInput
    );

    if (!matchedUser && isSuperAdminAlias) {
      matchedUser =
        currentUsersList.find((u) => u.role === 'Super Admin' || u.id === ROOT_SUPERADMIN_ID) ||
        createDefaultSuperAdminUser();
    }

    if (!matchedUser) {
      logActivity({
        userId: 'unknown',
        userName: cleanInput || 'Unknown User',
        userRole: 'Guest',
        action: 'LOGIN_FAILED',
        module: 'Authentication',
        description: `Failed login attempt for username "${cleanInput}"`,
        status: 'Failed',
        failureReason: 'User not found',
      });
      return { success: false, message: 'Invalid username/email or password.' };
    }

    if (matchedUser.status === 'Disabled') {
      logActivity({
        companyId: matchedUser.companyId,
        userId: matchedUser.id,
        userName: matchedUser.name,
        userRole: matchedUser.role,
        action: 'LOGIN_FAILED',
        module: 'Authentication',
        description: `Failed login attempt for disabled user "${matchedUser.name}" (${matchedUser.email})`,
        status: 'Failed',
        failureReason: 'Account Disabled',
      });
      return {
        success: false,
        message: 'Your account is disabled. Please contact the administrator.',
      };
    }

    // Verify Password
    let isPasswordCorrect = false;
    const isSuperAdminUser = matchedUser.role === 'Super Admin' || matchedUser.id === ROOT_SUPERADMIN_ID;

    // 1. Web Crypto Salted PBKDF2 hash verification
    if (matchedUser.salt && matchedUser.passwordVerifier) {
      isPasswordCorrect = await verifyPassword(cleanPassword, matchedUser.salt, matchedUser.passwordVerifier);
    }

    // 2. Direct password fallback (for default or legacy admin accounts)
    if (!isPasswordCorrect && matchedUser.password) {
      isPasswordCorrect = matchedUser.password.trim() === cleanPassword;
    }

    // 3. Super Admin default password fallback
    if (!isPasswordCorrect && isSuperAdminUser) {
      isPasswordCorrect = cleanPassword === ADMIN_CREDENTIALS.password.trim();
    }

    if (!isPasswordCorrect) {
      logActivity({
        companyId: matchedUser.companyId,
        userId: matchedUser.id,
        userName: matchedUser.name,
        userRole: matchedUser.role,
        action: 'LOGIN_FAILED',
        module: 'Authentication',
        description: `Failed password verification for user "${matchedUser.name}"`,
        status: 'Failed',
        failureReason: 'Invalid Password',
      });
      return { success: false, message: 'Invalid username/email or password.' };
    }

    // Determine Company Context
    const targetCompanyId = matchedUser.companyId || DEFAULT_COMPANY_ID;
    const companyObj = getCompanyById(targetCompanyId) || createDefaultCompany();

    const newSession: AuthSession = {
      isAuthenticated: true,
      userId: matchedUser.id,
      email: matchedUser.email,
      companyId: targetCompanyId,
      companyName: companyObj.name,
      role: matchedUser.role,
    };

    const finalUsersList = currentUsersList.some(
      (u) => u.id === matchedUser.id || u.email.toLowerCase() === matchedUser.email.toLowerCase()
    )
      ? currentUsersList
      : [matchedUser, ...currentUsersList];

    saveStoredUsers(finalUsersList);
    saveStoredAuthSession(newSession);
    setSession(newSession);
    setUsers(finalUsersList);

    // Notify ChitContext of company switch
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('chitfund_company_changed', { detail: targetCompanyId }));
    }

    logActivity({
      companyId: targetCompanyId,
      userId: matchedUser.id,
      userName: matchedUser.name,
      userRole: matchedUser.role,
      action: 'LOGIN_SUCCESS',
      module: 'Authentication',
      description: `User "${matchedUser.name}" (${matchedUser.role}) logged in to company "${companyObj.name}" successfully`,
      status: 'Success',
    });

    return { success: true, user: matchedUser };
  };

  const logout = useCallback(() => {
    logActivity({
      companyId: companyId,
      userId: currentUser?.id || session.userId || 'USR-SUPERADMIN',
      userName: currentUser?.name || session.email || 'User',
      userRole: currentUser?.role || 'Super Admin',
      action: 'LOGOUT',
      module: 'Authentication',
      description: `User "${currentUser?.name || session.email || 'User'}" logged out of company "${companyName}"`,
      status: 'Success',
    });

    clearStoredAuthSession();
    clearAuthToken();
    setSession({
      isAuthenticated: false,
      userId: null,
      email: null,
      companyId: null,
      companyName: null,
      role: null,
    });
  }, [currentUser, session, companyId, companyName]);

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

      // Register company locally so this device knows this company
      registerCompany({
        id: payload.companyId,
        name: payload.companyName,
        createdAt: payload.issuedAt,
        status: 'Active',
      });
      setCompanies(getStoredCompanies());

      // Prepare local user account
      const currentList = getStoredUsers();
      const existingIndex = currentList.findIndex(
        (u) => u.id === payload.userId || u.email.toLowerCase() === payload.email.toLowerCase()
      );

      const importedUser: UserAccount = {
        id: payload.userId,
        companyId: payload.companyId,
        companyName: payload.companyName,
        name: payload.name,
        email: payload.email,
        salt: payload.salt,
        passwordVerifier: payload.verifier,
        role: payload.role,
        customRoleName: payload.customRoleName,
        status: payload.status,
        permissions: payload.permissions,
        createdAt: payload.issuedAt,
        createdBy: 'Cross-Device Invitation',
      };

      let updatedList: UserAccount[];
      if (existingIndex >= 0) {
        updatedList = [...currentList];
        updatedList[existingIndex] = { ...currentList[existingIndex], ...importedUser };
      } else {
        updatedList = [...currentList, importedUser];
      }

      saveStoredUsers(updatedList);
      setUsers(updatedList);

      logActivity({
        companyId: payload.companyId,
        userId: payload.userId,
        userName: payload.name,
        userRole: payload.role,
        action: 'CREATE',
        module: 'Authentication',
        description: `Staff account "${payload.name}" (${payload.role}) imported and activated on this device for ${payload.companyName}`,
        status: 'Success',
      });

      return {
        success: true,
        message: `Account for ${payload.name} (${payload.companyName}) activated successfully! You can now log in.`,
        user: importedUser,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'An unexpected error occurred during account activation.',
      };
    }
  };

  /**
   * Generates or re-exports an activation token and .chituser file for an existing user
   */
  const generateUserActivationCredential = async (
    userId: string,
    passwordPlaintext?: string
  ): Promise<{ token?: string; chitUserFile?: ChitUserFile; activationCode?: string; error?: string }> => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) {
      return { error: 'User not found.' };
    }

    const targetCompany = getCompanyById(targetUser.companyId) || activeCompany;

    try {
      // Invalidate existing activation code if present
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

        // Update stored user with new verifier, activationToken, and short activationCode
        const updated = users.map((u) =>
          u.id === userId
            ? {
                ...u,
                salt: cred.salt,
                passwordVerifier: cred.verifier,
                activationToken: cred.token,
                activationCode: cred.activationCode,
                password: passwordPlaintext,
              }
            : u
        );
        setUsers(updated);
        saveStoredUsers(updated);

        return { token: cred.token, chitUserFile: cred.chitUserFile, activationCode: cred.activationCode };
      }

      // If already has salt & verifier, generate from existing verifier
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

        const updated = users.map((u) =>
          u.id === userId
            ? {
                ...u,
                activationToken: cred.token,
                activationCode: cred.activationCode,
              }
            : u
        );
        setUsers(updated);
        saveStoredUsers(updated);

        return { token: cred.token, chitUserFile: cred.chitUserFile, activationCode: cred.activationCode };
      }

      // Fallback: If user has local plaintext password
      if (targetUser.password) {
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
          passwordPlaintext: targetUser.password,
        });

        const updated = users.map((u) =>
          u.id === userId
            ? {
                ...u,
                salt: cred.salt,
                passwordVerifier: cred.verifier,
                activationToken: cred.token,
                activationCode: cred.activationCode,
              }
            : u
        );
        setUsers(updated);
        saveStoredUsers(updated);

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
    return currentUser?.role === 'Super Admin';
  }, [currentUser]);

  const hasPermission = useCallback(
    (permission: Permission | string): boolean => {
      if (!currentUser) return false;
      if (currentUser.role === 'Super Admin') return true;
      if (currentUser.status === 'Disabled') return false;
      return currentUser.permissions.includes(permission as Permission);
    },
    [currentUser]
  );

  const hasAnyPermission = useCallback(
    (permissions: (Permission | string)[]): boolean => {
      if (!currentUser) return false;
      if (currentUser.role === 'Super Admin') return true;
      if (currentUser.status === 'Disabled') return false;
      return permissions.some((p) => currentUser.permissions.includes(p as Permission));
    },
    [currentUser]
  );

  const hasAllPermissions = useCallback(
    (permissions: (Permission | string)[]): boolean => {
      if (!currentUser) return false;
      if (currentUser.role === 'Super Admin') return true;
      if (currentUser.status === 'Disabled') return false;
      return permissions.every((p) => currentUser.permissions.includes(p as Permission));
    },
    [currentUser]
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
    } catch (e) {
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
      } catch (err) {
        return { success: false, message: 'Failed to update role defaults.' };
      }
    },
    [isSuperAdmin]
  );

  // ---------------------------------------------------------------------------
  // USER MANAGEMENT ACTIONS
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

    // Check duplicate email
    const exists = users.some((u) => u.email.toLowerCase() === trimmedEmail.toLowerCase());
    if (exists) {
      return { success: false, message: 'A user with this Email/Username already exists.' };
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
    const targetComp = getCompanyById(targetCompanyId) || activeCompany;

    const newUserId = `USR-${Date.now()}-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`;

    // Generate tamper-proof portable credential
    const cred = await generateStaffActivationCredential({
      userId: newUserId,
      companyId: targetCompanyId,
      companyName: targetComp.name,
      email: trimmedEmail,
      name: trimmedName,
      role,
      customRoleName: data.customRoleName?.trim(),
      status: data.status || 'Active',
      permissions: assignedPermissions,
      passwordPlaintext: data.password,
    });

    const newUser: UserAccount = {
      id: newUserId,
      companyId: targetCompanyId,
      companyName: targetComp.name,
      name: trimmedName,
      email: trimmedEmail,
      password: data.password,
      salt: cred.salt,
      passwordVerifier: cred.verifier,
      activationToken: cred.token,
      activationCode: cred.activationCode,
      role,
      customRoleName: data.customRoleName?.trim(),
      status: data.status || 'Active',
      permissions: assignedPermissions,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name || 'Admin',
    };

    const updated = [...users, newUser];
    setUsers(updated);
    saveStoredUsers(updated);

    // Sync user creation to central backend database so user can login from other computers
    try {
      await apiFetch('users.php?action=create', {
        method: 'POST',
        body: JSON.stringify({
          id: newUserId,
          companyId: targetCompanyId,
          name: trimmedName,
          email: trimmedEmail,
          password: data.password,
          role,
          customRoleName: data.customRoleName?.trim(),
          status: data.status || 'Active',
          permissions: assignedPermissions,
          activationCode: cred.activationCode,
          activationToken: cred.token,
          chitUserFile: cred.chitUserFile,
        }),
      });
    } catch (apiErr) {
      console.warn('Backend user creation notification', apiErr);
    }

    logActivity({
      companyId: targetCompanyId,
      userId: currentUser?.id,
      userName: currentUser?.name,
      userRole: currentUser?.role,
      action: 'CREATE',
      module: 'Users',
      recordId: newUser.id,
      recordName: newUser.name,
      description: `Created new ${newUser.role} user account "${newUser.name}" (${newUser.email}) for company ${targetComp.name}`,
      afterData: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        companyId: targetCompanyId,
        status: newUser.status,
      },
      status: 'Success',
    });

    return {
      success: true,
      user: newUser,
      token: cred.token,
      chitUserFile: cred.chitUserFile,
    };
  };

  const updateUser = (id: string, data: UpdateUserData): { success: boolean; message?: string } => {
    if (!isSuperAdmin() && !hasPermission(PERMISSIONS.USERS_EDIT)) {
      return { success: false, message: 'You do not have permission to edit user accounts.' };
    }

    const targetUser = users.find((u) => u.id === id);
    if (!targetUser) {
      return { success: false, message: 'User not found.' };
    }

    if (data.email) {
      const trimmedEmail = data.email.trim();
      const duplicate = users.some(
        (u) => u.id !== id && u.email.toLowerCase() === trimmedEmail.toLowerCase()
      );
      if (duplicate) {
        return { success: false, message: 'Another user is already using this Email/Username.' };
      }
    }

    // Super Admin protection
    if (targetUser.id === ROOT_SUPERADMIN_ID || targetUser.role === 'Super Admin') {
      if (data.status === 'Disabled') {
        return { success: false, message: 'The primary Super Admin account cannot be disabled.' };
      }
      if (data.role && data.role !== 'Super Admin') {
        return { success: false, message: 'The primary Super Admin account role cannot be changed.' };
      }
    }

    let updatedUserObj: UserAccount | null = null;
    const updated = users.map((u) => {
      if (u.id !== id) return u;
      const isTargetSuperAdmin = u.id === ROOT_SUPERADMIN_ID || u.role === 'Super Admin';
      const updatedPermissions = isTargetSuperAdmin
        ? [...ALL_PERMISSIONS]
        : data.permissions !== undefined
        ? data.permissions
        : u.permissions;

      updatedUserObj = {
        ...u,
        name: data.name !== undefined ? data.name.trim() : u.name,
        email: data.email !== undefined ? data.email.trim() : u.email,
        companyId: data.companyId !== undefined ? data.companyId : u.companyId,
        role: isTargetSuperAdmin ? 'Super Admin' : data.role !== undefined ? data.role : u.role,
        customRoleName:
          data.customRoleName !== undefined ? data.customRoleName.trim() : u.customRoleName,
        status: isTargetSuperAdmin ? 'Active' : data.status !== undefined ? data.status : u.status,
        permissions: updatedPermissions,
        updatedAt: new Date().toISOString(),
      };
      return updatedUserObj;
    });

    setUsers(updated);
    saveStoredUsers(updated);

    if (updatedUserObj) {
      logActivity({
        companyId: targetUser.companyId,
        userId: currentUser?.id,
        userName: currentUser?.name,
        userRole: currentUser?.role,
        action: 'UPDATE',
        module: 'Users',
        recordId: targetUser.id,
        recordName: targetUser.name,
        description: `Updated user account details for "${targetUser.name}"`,
        beforeData: { name: targetUser.name, email: targetUser.email, role: targetUser.role },
        afterData: { name: updatedUserObj.name, email: updatedUserObj.email, role: updatedUserObj.role },
        status: 'Success',
      });
    }

    return { success: true };
  };

  const updateUserPermissions = (id: string, permissions: Permission[]): { success: boolean; message?: string } => {
    if (!isSuperAdmin() && !hasPermission(PERMISSIONS.USERS_MANAGE_PERMISSIONS)) {
      return { success: false, message: 'You do not have permission to configure user permissions.' };
    }

    const targetUser = users.find((u) => u.id === id);
    if (!targetUser) {
      return { success: false, message: 'User not found.' };
    }

    if (targetUser.id === ROOT_SUPERADMIN_ID || targetUser.role === 'Super Admin') {
      return { success: false, message: 'Permissions cannot be removed from the Super Admin account.' };
    }

    const updated = users.map((u) => {
      if (u.id !== id) return u;
      return {
        ...u,
        permissions,
        updatedAt: new Date().toISOString(),
      };
    });

    setUsers(updated);
    saveStoredUsers(updated);

    logActivity({
      companyId: targetUser.companyId,
      userId: currentUser?.id,
      userName: currentUser?.name,
      userRole: currentUser?.role,
      action: 'UPDATE',
      module: 'Users',
      recordId: targetUser.id,
      recordName: targetUser.name,
      description: `Updated permissions for user "${targetUser.name}" (${permissions.length} permissions assigned)`,
      beforeData: { permissions: targetUser.permissions },
      afterData: { permissions },
      status: 'Success',
    });

    return { success: true };
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
    if (!targetUser) {
      return { success: false, message: 'User not found.' };
    }

    const targetComp = getCompanyById(targetUser.companyId) || activeCompany;
    const cred = await generateStaffActivationCredential({
      userId: targetUser.id,
      companyId: targetUser.companyId,
      companyName: targetComp.name,
      email: targetUser.email,
      name: targetUser.name,
      role: targetUser.role,
      customRoleName: targetUser.customRoleName,
      status: targetUser.status,
      permissions: targetUser.permissions,
      passwordPlaintext: newPassword,
    });

    const updated = users.map((u) => {
      if (u.id !== id) return u;
      return {
        ...u,
        password: newPassword,
        salt: cred.salt,
        passwordVerifier: cred.verifier,
        activationToken: cred.token,
        updatedAt: new Date().toISOString(),
      };
    });

    setUsers(updated);
    saveStoredUsers(updated);

    logActivity({
      companyId: targetUser.companyId,
      userId: currentUser?.id,
      userName: currentUser?.name,
      userRole: currentUser?.role,
      action: 'PASSWORD_RESET',
      module: 'Users',
      recordId: targetUser.id,
      recordName: targetUser.name,
      description: `Reset password for user "${targetUser.name}"`,
      status: 'Success',
    });

    return { success: true };
  };

  const toggleUserStatus = (id: string): { success: boolean; message?: string } => {
    if (!isSuperAdmin() && !hasPermission(PERMISSIONS.USERS_EDIT)) {
      return { success: false, message: 'You do not have permission to toggle account status.' };
    }

    const targetUser = users.find((u) => u.id === id);
    if (!targetUser) {
      return { success: false, message: 'User not found.' };
    }

    if (targetUser.id === ROOT_SUPERADMIN_ID || targetUser.role === 'Super Admin') {
      return { success: false, message: 'The Super Admin account cannot be disabled.' };
    }

    const newStatus: UserStatus = targetUser.status === 'Active' ? 'Disabled' : 'Active';

    const updated = users.map((u) => {
      if (u.id !== id) return u;
      return {
        ...u,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };
    });

    setUsers(updated);
    saveStoredUsers(updated);

    logActivity({
      companyId: targetUser.companyId,
      userId: currentUser?.id,
      userName: currentUser?.name,
      userRole: currentUser?.role,
      action: 'UPDATE',
      module: 'Users',
      recordId: targetUser.id,
      recordName: targetUser.name,
      description: `Changed account status for "${targetUser.name}" to ${newStatus}`,
      beforeData: { status: targetUser.status },
      afterData: { status: newStatus },
      status: 'Success',
    });

    return { success: true };
  };

  const deleteUser = (id: string): { success: boolean; message?: string } => {
    if (!isSuperAdmin() && !hasPermission(PERMISSIONS.USERS_DELETE)) {
      return { success: false, message: 'You do not have permission to delete user accounts.' };
    }

    const targetUser = users.find((u) => u.id === id);
    if (!targetUser) {
      return { success: false, message: 'User not found.' };
    }

    if (targetUser.id === ROOT_SUPERADMIN_ID || targetUser.role === 'Super Admin') {
      return { success: false, message: 'The Super Admin account cannot be deleted.' };
    }

    const updated = users.filter((u) => u.id !== id);
    setUsers(updated);
    saveStoredUsers(updated);

    logActivity({
      companyId: targetUser.companyId,
      userId: currentUser?.id,
      userName: currentUser?.name,
      userRole: currentUser?.role,
      action: 'DELETE',
      module: 'Users',
      recordId: targetUser.id,
      recordName: targetUser.name,
      description: `Deleted user account "${targetUser.name}" (${targetUser.email})`,
      beforeData: { name: targetUser.name, email: targetUser.email },
      status: 'Success',
    });

    return { success: true };
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
