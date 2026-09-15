import { UserAccount } from '@/types';
import {
  ROOT_SUPERADMIN_ID,
  ADMIN_CREDENTIALS,
  createDefaultSuperAdminUser,
} from '../permissions';
import { getStoredCompanies, DEFAULT_COMPANY_ID, DEFAULT_COMPANY_NAME } from './companyStorage';

export const USERS_STORAGE_KEY = 'chitfund_users';
export const AUTH_STORAGE_KEY = 'chitfund_auth';
export const APP_DATA_KEY = 'chitfund_app_data';

export interface AuthSession {
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  companyId: string | null;
  companyName: string | null;
  role: string | null;
}

/**
 * Initializes authentication storage.
 * Purges legacy sensitive user credential keys from browser LocalStorage.
 */
export function initializeAuthStorage(): UserAccount[] {
  try {
    // Purge legacy user roster and credentials from LocalStorage to adhere to security requirements
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(USERS_STORAGE_KEY);
    }
    // Ensure company store exists
    getStoredCompanies();

    return [createDefaultSuperAdminUser()];
  } catch (err) {
    console.error('[AuthStorage] Error in initializeAuthStorage:', err);
    return [createDefaultSuperAdminUser()];
  }
}

/**
 * Compatibility wrapper. In centralized architecture, users are fetched from the API.
 */
export function getStoredUsers(): UserAccount[] {
  return [createDefaultSuperAdminUser()];
}

/**
 * Deprecated: User data is authoritative on the central database.
 * Purges local user roster key if invoked.
 */
export function saveStoredUsers(_users: UserAccount[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(USERS_STORAGE_KEY);
    }
  } catch {}
}

/**
 * Loads current authentication session.
 */
export function getStoredAuthSession(): AuthSession {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(AUTH_STORAGE_KEY) : null;
    if (!raw) {
      return {
        isAuthenticated: false,
        userId: null,
        email: null,
        companyId: null,
        companyName: null,
        role: null,
      };
    }
    const parsed = JSON.parse(raw);
    if (parsed && parsed.isAuthenticated === true) {
      return {
        isAuthenticated: true,
        userId: parsed.userId || ROOT_SUPERADMIN_ID,
        email: parsed.email || ADMIN_CREDENTIALS.email,
        companyId: parsed.companyId || DEFAULT_COMPANY_ID,
        companyName: parsed.companyName || DEFAULT_COMPANY_NAME,
        role: parsed.role || 'Super Admin',
      };
    }
  } catch (err) {
    console.error('[AuthStorage] Failed to read auth session from LocalStorage:', err);
  }
  return {
    isAuthenticated: false,
    userId: null,
    email: null,
    companyId: null,
    companyName: null,
    role: null,
  };
}

/**
 * Saves active authentication session.
 */
export function saveStoredAuthSession(session: AuthSession): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    }
  } catch (err) {
    console.error('[AuthStorage] Failed to save auth session:', err);
  }
}

/**
 * Clears active authentication session (sets isAuthenticated: false).
 */
export function clearStoredAuthSession(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({
          isAuthenticated: false,
          userId: null,
          email: null,
          companyId: null,
          companyName: null,
          role: null,
        })
      );
    }
  } catch (err) {
    console.error('[AuthStorage] Failed to clear auth session:', err);
  }
}
