import { CompanySettings, ChitScheme, Member, PaymentTransaction, ChitPayout, UserAccount } from '@/types';
import { createDefaultSuperAdminUser, DEFAULT_ROLE_PERMISSIONS } from '@/features/auth/permissions';

export const APP_DATA_KEY = 'chitfund_app_data';
export const AUTH_STORAGE_KEY = 'chitfund_auth';
export const USERS_STORAGE_KEY = 'chitfund_users';

export interface AppData {
  version: number;
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

export const getDefaultAppData = (): AppData => ({
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
});

export const getAppData = (): AppData => {
  try {
    const raw = localStorage.getItem(APP_DATA_KEY);
    if (!raw) {
      const initial = getDefaultAppData();
      saveAppData(initial);
      try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(initial.users));
      } catch {}
      return initial;
    }
    const data = JSON.parse(raw);
    const resolvedUsers: UserAccount[] = Array.isArray(data.users) && data.users.length > 0
      ? data.users
      : [createDefaultSuperAdminUser()];

    return {
      version: 2,
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
  } catch (err) {
    console.error('[Storage] Error reading application data from LocalStorage:', err);
    const fallback = getDefaultAppData();
    saveAppData(fallback);
    return fallback;
  }
};

export const saveAppData = (data: AppData): boolean => {
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(APP_DATA_KEY, serialized);
    return true;
  } catch (err: any) {
    console.error('[Storage] Failed to save application data to LocalStorage:', err);
    if (err?.name === 'QuotaExceededError' || err?.code === 22) {
      alert('Warning: Browser LocalStorage quota has been exceeded! Some changes could not be saved. Try deleting old large receipt images.');
    }
    return false;
  }
};

export const updateAppData = (updater: (prev: AppData) => AppData): AppData => {
  const current = getAppData();
  const next = updater(current);
  saveAppData(next);
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
