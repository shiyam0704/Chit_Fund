import { UserAccount } from '@/types';
import {
  ROOT_SUPERADMIN_ID,
  ADMIN_CREDENTIALS,
  createDefaultSuperAdminUser,
} from '../permissions';

export const USERS_STORAGE_KEY = 'chitfund_users';
export const AUTH_STORAGE_KEY = 'chitfund_auth';
export const APP_DATA_KEY = 'chitfund_app_data';

export interface AuthSession {
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
}

/**
 * Initializes and guarantees authentication storage in LocalStorage.
 *
 * Responsibilities:
 * 1. Reads 'chitfund_users'.
 * 2. If missing, empty, or invalid:
 *    - checks legacy 'chitfund_app_data.users' for existing accounts
 *    - if still missing, seeds default Super Admin account with intended credentials
 *    - saves directly to 'chitfund_users'
 * 3. If valid users exist:
 *    - PRESERVES all existing accounts and passwords without overwriting or resetting
 *    - ensures at least one active Super Admin account is available
 * 4. Ensures 'chitfund_auth' session key exists without modifying active session
 * 5. Runs synchronously before login can be attempted on any computer/browser
 */
export function initializeAuthStorage(): UserAccount[] {
  try {
    let users: UserAccount[] | null = null;

    // 1. Read primary USERS_STORAGE_KEY ('chitfund_users')
    const rawUsers = localStorage.getItem(USERS_STORAGE_KEY);
    if (rawUsers) {
      try {
        const parsed = JSON.parse(rawUsers);
        if (Array.isArray(parsed) && parsed.length > 0) {
          users = parsed;
        }
      } catch (e) {
        console.warn('[AuthStorage] Failed to parse existing chitfund_users, attempting recovery:', e);
      }
    }

    // 2. If chitfund_users not found or empty, check legacy chitfund_app_data
    if (!users || users.length === 0) {
      try {
        const rawAppData = localStorage.getItem(APP_DATA_KEY);
        if (rawAppData) {
          const parsedAppData = JSON.parse(rawAppData);
          if (Array.isArray(parsedAppData?.users) && parsedAppData.users.length > 0) {
            users = parsedAppData.users;
          }
        }
      } catch (e) {
        // App data check failed, continue to default seeding
      }
    }

    // 3. If still no users, seed default Super Admin
    if (!users || users.length === 0) {
      const defaultAdmin = createDefaultSuperAdminUser();
      users = [defaultAdmin];
      try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      } catch (err) {
        console.error('[AuthStorage] Failed to write chitfund_users to LocalStorage:', err);
      }
    } else {
      // Users exist: guarantee default Super Admin account (chitfundadmin@gmail.com) exists and is Active
      const defaultEmailClean = ADMIN_CREDENTIALS.email.trim().toLowerCase();
      const existingAdminIndex = users.findIndex(
        (u) =>
          u.email.trim().toLowerCase() === defaultEmailClean ||
          u.id === ROOT_SUPERADMIN_ID ||
          u.email.trim().toLowerCase() === 'chitfundadmin@123'
      );

      let modified = false;
      if (existingAdminIndex !== -1) {
        const existing = users[existingAdminIndex];
        // Ensure email is chitfundadmin@gmail.com, status is Active, role is Super Admin
        if (
          existing.email.trim().toLowerCase() !== defaultEmailClean ||
          existing.status !== 'Active' ||
          existing.role !== 'Super Admin'
        ) {
          users[existingAdminIndex] = {
            ...existing,
            id: ROOT_SUPERADMIN_ID,
            email: ADMIN_CREDENTIALS.email,
            role: 'Super Admin',
            status: 'Active',
            password: existing.password || ADMIN_CREDENTIALS.password,
          };
          modified = true;
        }
      } else {
        // Required default Super Admin does not exist: prepend without modifying any existing users
        const defaultAdmin = createDefaultSuperAdminUser();
        users = [defaultAdmin, ...users];
        modified = true;
      }

      if (modified) {
        try {
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
        } catch (err) {
          console.error('[AuthStorage] Failed to update chitfund_users:', err);
        }
      }
    }

    // 4. Ensure session key exists
    if (!localStorage.getItem(AUTH_STORAGE_KEY)) {
      try {
        localStorage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify({ isAuthenticated: false, userId: null, email: null })
        );
      } catch {}
    }

    // 5. Mirror to chitfund_app_data.users for backwards compatibility if app data exists
    try {
      const rawAppData = localStorage.getItem(APP_DATA_KEY);
      if (rawAppData) {
        const appData = JSON.parse(rawAppData);
        if (appData && typeof appData === 'object') {
          appData.users = users;
          localStorage.setItem(APP_DATA_KEY, JSON.stringify(appData));
        }
      }
    } catch {}

    return users;
  } catch (err) {
    console.error('[AuthStorage] Critical error in initializeAuthStorage:', err);
    const fallback = [createDefaultSuperAdminUser()];
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(fallback));
    } catch {}
    return fallback;
  }
}

/**
 * Returns current users list from LocalStorage, guaranteeing initialization first.
 */
export function getStoredUsers(): UserAccount[] {
  return initializeAuthStorage();
}

/**
 * Persists users directly to 'chitfund_users' and mirrors to 'chitfund_app_data.users'.
 */
export function saveStoredUsers(users: UserAccount[]): void {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

    // Mirror to chitfund_app_data.users if present
    const rawAppData = localStorage.getItem(APP_DATA_KEY);
    if (rawAppData) {
      try {
        const appData = JSON.parse(rawAppData);
        if (appData && typeof appData === 'object') {
          appData.users = users;
          localStorage.setItem(APP_DATA_KEY, JSON.stringify(appData));
        }
      } catch {}
    }
  } catch (err) {
    console.error('[AuthStorage] Failed to save users to LocalStorage:', err);
  }
}

/**
 * Loads current authentication session.
 */
export function getStoredAuthSession(): AuthSession {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return { isAuthenticated: false, userId: null, email: null };
    const parsed = JSON.parse(raw);
    if (parsed && parsed.isAuthenticated === true) {
      return {
        isAuthenticated: true,
        userId: parsed.userId || ROOT_SUPERADMIN_ID,
        email: parsed.email || ADMIN_CREDENTIALS.email,
      };
    }
  } catch (err) {
    console.error('[AuthStorage] Failed to read auth session from LocalStorage:', err);
  }
  return { isAuthenticated: false, userId: null, email: null };
}

/**
 * Saves active authentication session.
 */
export function saveStoredAuthSession(session: AuthSession): void {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } catch (err) {
    console.error('[AuthStorage] Failed to save auth session:', err);
  }
}

/**
 * Clears active authentication session (sets isAuthenticated: false).
 */
export function clearStoredAuthSession(): void {
  try {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ isAuthenticated: false, userId: null, email: null })
    );
  } catch (err) {
    console.error('[AuthStorage] Failed to clear auth session:', err);
  }
}
