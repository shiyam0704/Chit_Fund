import { CompanySettings, ChitScheme, Member, PaymentTransaction, ChitPayout, UserAccount } from '@/types';
import { createDefaultSuperAdminUser, DEFAULT_ROLE_PERMISSIONS } from '@/features/auth/permissions';
import { getActiveCompanyId, DEFAULT_COMPANY_ID, getCompanyById } from '@/features/auth/utils/companyStorage';

export const APP_DATA_KEY = 'chitfund_app_data';
export const AUTH_STORAGE_KEY = 'chitfund_auth';
export const USERS_STORAGE_KEY = 'chitfund_users';
export const THEME_STORAGE_KEY = 'chitfund_theme';

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
  let theme: 'dark' | 'light' = 'dark';
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark') {
      theme = storedTheme;
    }
  } catch {}

  return {
    version: 2,
    companyId: targetCompanyId,
    theme,
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

// In-memory runtime cache (avoids storing business data in LocalStorage)
let memoryCache: Record<string, AppData> = {};

/**
 * Loads company-scoped application data.
 * Adheres strictly to security requirements: business data (chits, members, collections, users)
 * is kept in centralized backend and in-memory runtime cache, NOT in browser LocalStorage.
 */
export const getCompanyAppData = (companyId?: string): AppData => {
  const targetCompanyId = companyId || getActiveCompanyId();

  // Purge legacy business data keys from LocalStorage if present
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(USERS_STORAGE_KEY);
      localStorage.removeItem(APP_DATA_KEY);
      localStorage.removeItem(getCompanyAppDataKey(targetCompanyId));
    }
  } catch {}

  if (memoryCache[targetCompanyId]) {
    return memoryCache[targetCompanyId];
  }

  const defaultData = getDefaultAppData(targetCompanyId);
  memoryCache[targetCompanyId] = defaultData;
  return defaultData;
};

/**
 * Saves runtime application data.
 * Only non-sensitive preferences (e.g. theme) are written to LocalStorage.
 */
export const saveCompanyAppData = (data: AppData, companyId?: string): boolean => {
  const targetCompanyId = companyId || data.companyId || getActiveCompanyId();
  memoryCache[targetCompanyId] = {
    ...data,
    companyId: targetCompanyId,
  };

  try {
    if (typeof localStorage !== 'undefined' && data.theme) {
      localStorage.setItem(THEME_STORAGE_KEY, data.theme);
    }
    return true;
  } catch {
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

export async function compressReceiptImage(
  file: File,
  maxWidth = 1000,
  maxHeight = 1000,
  quality = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(file.type || 'image/jpeg', quality));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}

