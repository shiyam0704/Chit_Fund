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
  role: UserRole;
  customRoleName?: string;
  status: UserStatus;
  permissions?: Permission[];
}

export interface UpdateUserData {
  name?: string;
  email?: string;
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
  login: (usernameOrEmail: string, password: string) => Promise<{ success: boolean; message?: string; user?: UserAccount }>;
  logout: () => void;
  // RBAC Permission Helpers
  hasPermission: (permission: Permission | string) => boolean;
  hasAnyPermission: (permissions: (Permission | string)[]) => boolean;
  hasAllPermissions: (permissions: (Permission | string)[]) => boolean;
  isSuperAdmin: () => boolean;
  // Role Matrix Defaults
  getRoleDefaults: (role: UserRole) => Permission[];
  updateRoleDefaults: (role: UserRole, permissions: Permission[]) => { success: boolean; message?: string };
  // User Management
  createUser: (data: CreateUserData) => { success: boolean; message?: string; user?: UserAccount };
  updateUser: (id: string, data: UpdateUserData) => { success: boolean; message?: string };
  updateUserPermissions: (id: string, permissions: Permission[]) => { success: boolean; message?: string };
  resetUserPassword: (id: string, newPassword: string) => { success: boolean; message?: string };
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

  // Sync users and session across tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === USERS_STORAGE_KEY) {
        setUsers(getStoredUsers());
      }
      if (e.key === AUTH_STORAGE_KEY) {
        setSession(getStoredAuthSession());
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

  // If active user is disabled while session is active, force sign out
  useEffect(() => {
    if (currentUser && currentUser.status === 'Disabled') {
      logout();
    }
  }, [currentUser]);

  // ---------------------------------------------------------------------------
  // AUTHENTICATION: LOGIN & LOGOUT
  // ---------------------------------------------------------------------------
  const login = async (
    usernameOrEmail: string,
    password: string
  ): Promise<{ success: boolean; message?: string; user?: UserAccount }> => {
    // Artificial slight delay for realistic validation feedback (200ms)
    await new Promise((resolve) => setTimeout(resolve, 200));

    const cleanInput = (usernameOrEmail || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();
    if (!cleanInput || !cleanPassword) {
      return { success: false, message: 'Please enter both username/email and password.' };
    }

    // Ensure local application data and users are initialized
    initializeAuthStorage();
    initializeLocalApplication();

    // Refresh users from storage to ensure latest data
    const currentUsersList = getStoredUsers();

    // Determine if input matches any known Super Admin aliases or credentials
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

    // Look for matching user by email or name
    let matchedUser = currentUsersList.find(
      (u) => (u.email || '').trim().toLowerCase() === cleanInput || (u.name || '').trim().toLowerCase() === cleanInput
    );

    // Fallback: match Super Admin aliases or direct default admin login
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

    // Check account status
    if (matchedUser.status === 'Disabled') {
      logActivity({
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
        message: 'Your account is disabled. Please contact the Super Admin.',
      };
    }

    // Check password: match against user's password OR default admin credential if Super Admin
    const isSuperAdmin = matchedUser.role === 'Super Admin' || matchedUser.id === ROOT_SUPERADMIN_ID;
    const isPasswordCorrect =
      (matchedUser.password || '').trim() === cleanPassword ||
      (isSuperAdmin && cleanPassword === ADMIN_CREDENTIALS.password.trim());

    if (!isPasswordCorrect) {
      logActivity({
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

    // Successful authentication
    const newSession: AuthSession = {
      isAuthenticated: true,
      userId: matchedUser.id,
      email: matchedUser.email,
    };

    // Ensure matchedUser is stored locally even if cold-started with zero storage
    const finalUsersList = currentUsersList.some((u) => u.id === matchedUser.id || u.email.toLowerCase() === matchedUser.email.toLowerCase())
      ? currentUsersList
      : [matchedUser, ...currentUsersList];

    saveStoredUsers(finalUsersList);
    saveStoredAuthSession(newSession);
    setSession(newSession);
    setUsers(finalUsersList);

    logActivity({
      userId: matchedUser.id,
      userName: matchedUser.name,
      userRole: matchedUser.role,
      action: 'LOGIN_SUCCESS',
      module: 'Authentication',
      description: `User "${matchedUser.name}" (${matchedUser.role}) logged in successfully`,
      status: 'Success',
    });

    return { success: true, user: matchedUser };
  };

  const logout = useCallback(() => {
    logActivity({
      userId: currentUser?.id || session.userId || 'USR-SUPERADMIN',
      userName: currentUser?.name || session.email || 'User',
      userRole: currentUser?.role || 'Super Admin',
      action: 'LOGOUT',
      module: 'Authentication',
      description: `User "${currentUser?.name || session.email || 'User'}" logged out of the system`,
      status: 'Success',
    });

    // Strictly only remove authentication session. Never delete business or user data!
    clearStoredAuthSession();
    setSession({ isAuthenticated: false, userId: null, email: null });
  }, [currentUser, session]);

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
      // ignore and use fallback
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
  // USER MANAGEMENT ACTIONS (Super Admin Only)
  // ---------------------------------------------------------------------------
  const createUser = (data: CreateUserData): { success: boolean; message?: string; user?: UserAccount } => {
    if (!isSuperAdmin()) {
      return { success: false, message: 'Only Super Admin can create user accounts.' };
    }

    const trimmedName = data.name.trim();
    const trimmedEmail = data.email.trim();
    if (!trimmedName || !trimmedEmail) {
      return { success: false, message: 'Name and Email/Username are required.' };
    }

    if (!data.password || data.password.length < 4) {
      return { success: false, message: 'Password must be at least 4 characters long.' };
    }

    // Check duplicate email / username
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

    const newUser: UserAccount = {
      id: `USR-${Date.now()}`,
      name: trimmedName,
      email: trimmedEmail,
      password: data.password,
      role,
      customRoleName: data.customRoleName?.trim(),
      status: data.status || 'Active',
      permissions: assignedPermissions,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name || 'Super Admin',
    };

    const updated = [...users, newUser];
    setUsers(updated);
    saveStoredUsers(updated);

    logActivity({
      userId: currentUser?.id,
      userName: currentUser?.name,
      userRole: currentUser?.role,
      action: 'CREATE',
      module: 'Users',
      recordId: newUser.id,
      recordName: newUser.name,
      description: `Created new ${newUser.role} user account "${newUser.name}" (${newUser.email})`,
      afterData: newUser,
      status: 'Success',
    });

    return { success: true, user: newUser };
  };

  const updateUser = (id: string, data: UpdateUserData): { success: boolean; message?: string } => {
    if (!isSuperAdmin()) {
      return { success: false, message: 'Only Super Admin can edit user accounts.' };
    }

    const targetUser = users.find((u) => u.id === id);
    if (!targetUser) {
      return { success: false, message: 'User not found.' };
    }

    // Check duplicate email if changed
    if (data.email) {
      const trimmedEmail = data.email.trim();
      const duplicate = users.some(
        (u) => u.id !== id && u.email.toLowerCase() === trimmedEmail.toLowerCase()
      );
      if (duplicate) {
        return { success: false, message: 'Another user is already using this Email/Username.' };
      }
    }

    // Super Admin protection: cannot demote root Super Admin or disable root Super Admin
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
        : (data.permissions !== undefined ? data.permissions : u.permissions);

      updatedUserObj = {
        ...u,
        name: data.name !== undefined ? data.name.trim() : u.name,
        email: data.email !== undefined ? data.email.trim() : u.email,
        role: isTargetSuperAdmin ? 'Super Admin' : (data.role !== undefined ? data.role : u.role),
        customRoleName: data.customRoleName !== undefined ? data.customRoleName.trim() : u.customRoleName,
        status: isTargetSuperAdmin ? 'Active' : (data.status !== undefined ? data.status : u.status),
        permissions: updatedPermissions,
        updatedAt: new Date().toISOString(),
      };
      return updatedUserObj;
    });

    setUsers(updated);
    saveStoredUsers(updated);

    if (updatedUserObj) {
      logActivity({
        userId: currentUser?.id,
        userName: currentUser?.name,
        userRole: currentUser?.role,
        action: 'UPDATE',
        module: 'Users',
        recordId: targetUser.id,
        recordName: targetUser.name,
        description: `Updated user account details for "${targetUser.name}"`,
        beforeData: targetUser,
        afterData: updatedUserObj,
        status: 'Success',
      });
    }

    return { success: true };
  };

  const updateUserPermissions = (id: string, permissions: Permission[]): { success: boolean; message?: string } => {
    if (!isSuperAdmin()) {
      return { success: false, message: 'Only Super Admin can configure user permissions.' };
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

  const resetUserPassword = (id: string, newPassword: string): { success: boolean; message?: string } => {
    if (!isSuperAdmin()) {
      return { success: false, message: 'Only Super Admin can reset user passwords.' };
    }

    if (!newPassword || newPassword.length < 4) {
      return { success: false, message: 'Password must be at least 4 characters long.' };
    }

    const targetUser = users.find((u) => u.id === id);
    if (!targetUser) {
      return { success: false, message: 'User not found.' };
    }

    const updated = users.map((u) => {
      if (u.id !== id) return u;
      return {
        ...u,
        password: newPassword,
        updatedAt: new Date().toISOString(),
      };
    });

    setUsers(updated);
    saveStoredUsers(updated);

    logActivity({
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
    if (!isSuperAdmin()) {
      return { success: false, message: 'Only Super Admin can enable or disable user accounts.' };
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
    if (!isSuperAdmin()) {
      return { success: false, message: 'Only Super Admin can delete user accounts.' };
    }

    const targetUser = users.find((u) => u.id === id);
    if (!targetUser) {
      return { success: false, message: 'User not found.' };
    }

    if (targetUser.id === ROOT_SUPERADMIN_ID || targetUser.role === 'Super Admin') {
      return { success: false, message: 'The Super Admin account cannot be deleted.' };
    }

    // Only delete login account; business data remains 100% intact!
    const updated = users.filter((u) => u.id !== id);
    setUsers(updated);
    saveStoredUsers(updated);

    logActivity({
      userId: currentUser?.id,
      userName: currentUser?.name,
      userRole: currentUser?.role,
      action: 'DELETE',
      module: 'Users',
      recordId: targetUser.id,
      recordName: targetUser.name,
      description: `Deleted user account "${targetUser.name}" (${targetUser.email})`,
      beforeData: targetUser,
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
        login,
        logout,
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
