import {
  ROOT_SUPERADMIN_ID,
  ADMIN_CREDENTIALS,
  createDefaultSuperAdminUser,
  DEFAULT_ROLE_PERMISSIONS,
} from '@/features/auth/permissions';
import {
  APP_DATA_KEY,
  AUTH_STORAGE_KEY,
  USERS_STORAGE_KEY,
  defaultCompanySettings,
  getDefaultAppData,
  AppData,
} from './storage';
import { UserAccount } from '@/types';

/**
 * Initializes local application data on first startup.
 * Runs on every browser / computer opening the application.
 *
 * Guarantees:
 * 1. Safe & Non-Destructive: NEVER deletes, clears, or resets existing user data, members, chits, or payments.
 * 2. Fresh Browser Reliability: Automatically seeds the default Super Admin user account in LocalStorage
 *    so login works immediately on any computer/device without manual setup.
 * 3. Self-Healing: If user data was ever missing, corrupted, or lacked a Super Admin, safely ensures
 *    an active Super Admin account is available while preserving any other existing local accounts.
 */
export function initializeLocalApplication(): AppData {
  try {
    const raw = localStorage.getItem(APP_DATA_KEY);

    if (!raw) {
      // Fresh browser: initialize default app data structure with default admin user
      const initialData: AppData = {
        version: 2,
        theme: 'dark',
        companySettings: defaultCompanySettings,
        chits: [],
        members: [],
        transactions: [],
        payouts: [],
        manualWinnerAssignments: {},
        users: [createDefaultSuperAdminUser()],
        roleDefaults: DEFAULT_ROLE_PERMISSIONS,
      };

      try {
        localStorage.setItem(APP_DATA_KEY, JSON.stringify(initialData));
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(initialData.users));
      } catch (err) {
        console.error('[Init] Failed to write initial data to LocalStorage:', err);
      }

      // Initialize clean auth session if missing
      if (!localStorage.getItem(AUTH_STORAGE_KEY)) {
        try {
          localStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify({ isAuthenticated: false, userId: null, email: null })
          );
        } catch {}
      }

      return initialData;
    }

    // Existing data present: validate and safely patch only missing required keys
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }

    if (!data || typeof data !== 'object') {
      data = getDefaultAppData();
    }

    let needsSave = false;

    // 1. Ensure users array exists and has at least one active Super Admin
    let currentUsers: UserAccount[] = Array.isArray(data.users) ? data.users : [];

    // Also check legacy USERS_STORAGE_KEY if data.users is empty
    if (currentUsers.length === 0) {
      const legacyRaw = localStorage.getItem(USERS_STORAGE_KEY);
      if (legacyRaw) {
        try {
          const parsedLegacy = JSON.parse(legacyRaw);
          if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
            currentUsers = parsedLegacy;
          }
        } catch {}
      }
    }

    const hasSuperAdmin = currentUsers.some(
      (u) =>
        (u.role === 'Super Admin' || u.id === ROOT_SUPERADMIN_ID || u.email.toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase()) &&
        u.status !== 'Disabled'
    );

    if (!hasSuperAdmin) {
      // Add default Super Admin account while preserving any existing user accounts
      const defaultAdmin = createDefaultSuperAdminUser();
      currentUsers = [defaultAdmin, ...currentUsers.filter((u) => u.id !== ROOT_SUPERADMIN_ID)];
      data.users = currentUsers;
      needsSave = true;
    } else {
      data.users = currentUsers;
    }

    // 2. Ensure companySettings exists
    if (!data.companySettings || typeof data.companySettings !== 'object') {
      data.companySettings = defaultCompanySettings;
      needsSave = true;
    }

    // 3. Ensure roleDefaults exists
    if (!data.roleDefaults || typeof data.roleDefaults !== 'object') {
      data.roleDefaults = DEFAULT_ROLE_PERMISSIONS;
      needsSave = true;
    }

    // 4. Ensure arrays exist
    if (!Array.isArray(data.chits)) { data.chits = []; needsSave = true; }
    if (!Array.isArray(data.members)) { data.members = []; needsSave = true; }
    if (!Array.isArray(data.transactions)) { data.transactions = []; needsSave = true; }
    if (!Array.isArray(data.payouts)) { data.payouts = []; needsSave = true; }
    if (!data.manualWinnerAssignments || typeof data.manualWinnerAssignments !== 'object') {
      data.manualWinnerAssignments = {};
      needsSave = true;
    }

    if (needsSave) {
      try {
        localStorage.setItem(APP_DATA_KEY, JSON.stringify(data));
      } catch (err) {
        console.error('[Init] Failed to save patched app data:', err);
      }
    }

    // Always keep USERS_STORAGE_KEY mirrored
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(currentUsers));
    } catch {}

    // Ensure session key exists
    if (!localStorage.getItem(AUTH_STORAGE_KEY)) {
      try {
        localStorage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify({ isAuthenticated: false, userId: null, email: null })
        );
      } catch {}
    }

    return data as AppData;
  } catch (err) {
    console.error('[Init] Unexpected error during local application initialization:', err);
    return getDefaultAppData();
  }
}
