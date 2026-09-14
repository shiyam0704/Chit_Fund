import { DEFAULT_ROLE_PERMISSIONS } from '@/features/auth/permissions';
import { initializeAuthStorage } from '@/features/auth/utils/authStorage';
import {
  APP_DATA_KEY,
  defaultCompanySettings,
  getDefaultAppData,
  AppData,
} from './storage';

export { initializeAuthStorage };

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
    // 1. Ensure authentication storage ('chitfund_users' and 'chitfund_auth') is initialized first
    const users = initializeAuthStorage();

    const raw = localStorage.getItem(APP_DATA_KEY);

    if (!raw) {
      // Fresh browser: initialize default app data structure
      const initialData: AppData = {
        version: 2,
        theme: 'dark',
        companySettings: defaultCompanySettings,
        chits: [],
        members: [],
        transactions: [],
        payouts: [],
        manualWinnerAssignments: {},
        users,
        roleDefaults: DEFAULT_ROLE_PERMISSIONS,
      };

      try {
        localStorage.setItem(APP_DATA_KEY, JSON.stringify(initialData));
      } catch (err) {
        console.error('[Init] Failed to write initial data to LocalStorage:', err);
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

    // Attach verified users list
    data.users = users;

    // Ensure companySettings exists
    if (!data.companySettings || typeof data.companySettings !== 'object') {
      data.companySettings = defaultCompanySettings;
      needsSave = true;
    }

    // Ensure roleDefaults exists
    if (!data.roleDefaults || typeof data.roleDefaults !== 'object') {
      data.roleDefaults = DEFAULT_ROLE_PERMISSIONS;
      needsSave = true;
    }

    // Ensure arrays exist
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

    return data as AppData;
  } catch (err) {
    console.error('[Init] Unexpected error during local application initialization:', err);
    return getDefaultAppData();
  }
}
