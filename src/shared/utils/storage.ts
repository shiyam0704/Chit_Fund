import { CompanySettings, ChitScheme, Member, PaymentTransaction, ChitPayout, UserAccount } from '@/types';
import { createDefaultSuperAdminUser, DEFAULT_ROLE_PERMISSIONS } from '@/features/auth/permissions';
import { getActiveCompanyId, DEFAULT_COMPANY_ID, getCompanyById } from '@/features/auth/utils/companyStorage';

export const APP_DATA_KEY = 'chitfund_app_data';
export const AUTH_STORAGE_KEY = 'chitfund_auth';
export const USERS_STORAGE_KEY = 'chitfund_users';

export function getCompanyAppDataKey(companyId?: string): string {
  const targetId = companyId || getActiveCompanyId();
  return `chitfund_company_${targetId}_app_data`;
}

export interface AppData {
  version: number;
  companyId?: string;
  theme: 'dark' | 'light';
  companySettings: CompanySettings;
  chits: ChitScheme[];
  members: Member[];
  transactions: PaymentTransaction[];
  payouts: ChitPayout[];
  manualWinnerAssignments: Record<string, Record<number, string>>;
  users?: UserAccount[];
  roleDefaults?: Record<string, string[]>;
}

export const defaultCompanySettings: CompanySettings = {
  companyName: 'Chit Fund Management',
  logoText: 'Chit Fund',
  address: '',
  phone: '',
  email: '',
  gstNumber: '',
  defaultCommission: 5,
  gracePeriod: 5,
  paymentModes: ['Cash', 'UPI', 'Bank Transfer', 'Cheque'],
  receiptPrefix: 'REC-',
  receiptHeader: 'Official Receipt for Chit Fund Installment Payment',
  receiptFooter: 'Thank you for your payment!',
  signatureText: 'Authorized Signatory',
};

export const getDefaultAppData = (companyId?: string): AppData => {
  const targetCompanyId = companyId || getActiveCompanyId();
  const companyInfo = getCompanyById(targetCompanyId);
  const companyName = companyInfo?.name || defaultCompanySettings.companyName;

  return {
    version: 2,
    companyId: targetCompanyId,
    theme: 'dark',
    companySettings: {
      ...defaultCompanySettings,
      companyName,
      logoText: companyName.split(' ')[0] || 'Chit Fund',
    },
    chits: [],
    members: [],
    transactions: [],
    payouts: [],
    manualWinnerAssignments: {},
    users: [createDefaultSuperAdminUser()],
    roleDefaults: DEFAULT_ROLE_PERMISSIONS,
  };
};

/**
 * Loads company-scoped application data with automatic safe migration from legacy storage.
 */
export const getCompanyAppData = (companyId?: string): AppData => {
  const targetCompanyId = companyId || getActiveCompanyId();
  const scopedKey = getCompanyAppDataKey(targetCompanyId);

  try {
    const rawScoped = localStorage.getItem(scopedKey);

    // Read primary users store ('chitfund_users') if present
    let primaryUsers: UserAccount[] | undefined;
    const rawUsers = localStorage.getItem(USERS_STORAGE_KEY);
    if (rawUsers) {
      try {
        const parsedUsers = JSON.parse(rawUsers);
        if (Array.isArray(parsedUsers) && parsedUsers.length > 0) {
          primaryUsers = parsedUsers;
        }
      } catch {}
    }

    if (rawScoped) {
      const data = JSON.parse(rawScoped);
      const resolvedUsers: UserAccount[] = primaryUsers || (Array.isArray(data.users) && data.users.length > 0
        ? data.users
        : [createDefaultSuperAdminUser()]);

      return {
        version: 2,
        companyId: targetCompanyId,
        theme: data.theme || 'dark',
        companySettings: data.companySettings || defaultCompanySettings,
        chits: Array.isArray(data.chits) ? data.chits : [],
        members: Array.isArray(data.members) ? data.members : [],
        transactions: Array.isArray(data.transactions) ? data.transactions : [],
        payouts: Array.isArray(data.payouts) ? data.payouts : [],
        manualWinnerAssignments: data.manualWinnerAssignments || {},
        users: resolvedUsers,
        roleDefaults: data.roleDefaults || DEFAULT_ROLE_PERMISSIONS,
      };
    }

    // Scoped data does not exist yet for this company.
    // Check if legacy chitfund_app_data exists and we are loading DEFAULT_COMPANY_ID:
    // Safely migrate existing legacy data without loss!
    const rawLegacy = localStorage.getItem(APP_DATA_KEY);
    if (rawLegacy && targetCompanyId === DEFAULT_COMPANY_ID) {
      try {
        const legacyData = JSON.parse(rawLegacy);
        const migrated: AppData = {
          version: 2,
          companyId: DEFAULT_COMPANY_ID,
          theme: legacyData.theme || 'dark',
          companySettings: legacyData.companySettings || defaultCompanySettings,
          chits: (legacyData.chits || []).map((c: any) => ({ ...c, companyId: DEFAULT_COMPANY_ID })),
          members: (legacyData.members || []).map((m: any) => ({ ...m, companyId: DEFAULT_COMPANY_ID })),
          transactions: (legacyData.transactions || []).map((t: any) => ({ ...t, companyId: DEFAULT_COMPANY_ID })),
          payouts: (legacyData.payouts || []).map((p: any) => ({ ...p, companyId: DEFAULT_COMPANY_ID })),
          manualWinnerAssignments: legacyData.manualWinnerAssignments || {},
          users: primaryUsers || legacyData.users || [createDefaultSuperAdminUser()],
          roleDefaults: legacyData.roleDefaults || DEFAULT_ROLE_PERMISSIONS,
        };
        saveCompanyAppData(migrated, DEFAULT_COMPANY_ID);
        return migrated;
      } catch (e) {
        console.warn('[Storage] Legacy data migration warning:', e);
      }
    }

    // No existing data found: seed fresh company dataset
    const initial = getDefaultAppData(targetCompanyId);
    if (primaryUsers && primaryUsers.length > 0) {
      initial.users = primaryUsers;
    }
    saveCompanyAppData(initial, targetCompanyId);
    return initial;
  } catch (err) {
    console.error(`[Storage] Error reading application data for company ${targetCompanyId}:`, err);
    const fallback = getDefaultAppData(targetCompanyId);
    saveCompanyAppData(fallback, targetCompanyId);
    return fallback;
  }
};

/**
 * Persists company-scoped application data to LocalStorage.
 */
export const saveCompanyAppData = (data: AppData, companyId?: string): boolean => {
  const targetCompanyId = companyId || data.companyId || getActiveCompanyId();
  const scopedKey = getCompanyAppDataKey(targetCompanyId);

  try {
    const dataWithCompany: AppData = {
      ...data,
      companyId: targetCompanyId,
    };
    const serialized = JSON.stringify(dataWithCompany);
    localStorage.setItem(scopedKey, serialized);

    // If active company is DEFAULT_COMPANY_ID, mirror to legacy key for backwards compatibility
    if (targetCompanyId === DEFAULT_COMPANY_ID) {
      try {
        localStorage.setItem(APP_DATA_KEY, serialized);
      } catch {}
    }

    return true;
  } catch (err: any) {
    console.error(`[Storage] Failed to save app data for company ${targetCompanyId}:`, err);
    if (err?.name === 'QuotaExceededError' || err?.code === 22) {
      alert('Warning: Browser LocalStorage quota has been exceeded! Try deleting large receipt attachments.');
    }
    return false;
  }
};

export const getAppData = (companyId?: string): AppData => {
  return getCompanyAppData(companyId);
};

export const saveAppData = (data: AppData, companyId?: string): boolean => {
  return saveCompanyAppData(data, companyId);
};

export const updateAppData = (updater: (prev: AppData) => AppData, companyId?: string): AppData => {
  const targetCompanyId = companyId || getActiveCompanyId();
  const current = getCompanyAppData(targetCompanyId);
  const next = updater(current);
  saveCompanyAppData(next, targetCompanyId);
  return next;
};

export const compressReceiptImage = (
  file: File,
  maxWidth = 1000,
  maxHeight = 1000,
  quality = 0.7
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Selected file is not an image.'));
    }
    if (file.size > 12 * 1024 * 1024) {
      return reject(new Error('Image file is too large (max 12MB). Please select a smaller photo.'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for compression.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(e.target?.result as string);
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const compressImage = compressReceiptImage;
