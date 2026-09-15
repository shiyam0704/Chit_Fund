import { Company } from '@/types';

export const COMPANIES_STORAGE_KEY = 'chitfund_companies';
export const DEFAULT_COMPANY_ID = 'CMP-DEFAULT';
export const DEFAULT_COMPANY_NAME = 'Chit Fund Management';

/**
 * Generates a unique, stable company ID: e.g. CMP-A1B2C3D4
 */
export function generateCompanyId(): string {
  const chars = '0123456789ABCDEF';
  let rand = '';
  if (typeof window !== 'undefined' && window.crypto) {
    const bytes = new Uint8Array(4);
    window.crypto.getRandomValues(bytes);
    for (let i = 0; i < 4; i++) {
      rand += bytes[i].toString(16).padStart(2, '0').toUpperCase();
    }
  } else {
    for (let i = 0; i < 8; i++) {
      rand += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return `CMP-${rand}`;
}

/**
 * Returns default initial company object
 */
export function createDefaultCompany(name = DEFAULT_COMPANY_NAME): Company {
  return {
    id: DEFAULT_COMPANY_ID,
    name: name || DEFAULT_COMPANY_NAME,
    createdAt: '2026-01-01T00:00:00.000Z',
    status: 'Active',
  };
}

/**
 * Retrieves all registered companies from LocalStorage.
 * Guarantees at least the default initial company exists.
 */
export function getStoredCompanies(): Company[] {
  try {
    const raw = localStorage.getItem(COMPANIES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }

    // Check if legacy chitfund_app_data has custom company settings
    let companyName = DEFAULT_COMPANY_NAME;
    try {
      const rawAppData = localStorage.getItem('chitfund_app_data');
      if (rawAppData) {
        const appData = JSON.parse(rawAppData);
        if (appData?.companySettings?.companyName) {
          companyName = appData.companySettings.companyName;
        }
      }
    } catch { }

    const defaultComp = createDefaultCompany(companyName);
    const initial = [defaultComp];
    localStorage.setItem(COMPANIES_STORAGE_KEY, JSON.stringify(initial));
    return initial;
  } catch (err) {
    console.error('[CompanyStorage] Failed to read companies:', err);
    return [createDefaultCompany()];
  }
}

/**
 * Persists the companies list to LocalStorage.
 */
export function saveStoredCompanies(companies: Company[]): void {
  try {
    localStorage.setItem(COMPANIES_STORAGE_KEY, JSON.stringify(companies));
  } catch (err) {
    console.error('[CompanyStorage] Failed to save companies:', err);
  }
}

/**
 * Registers or updates a company in LocalStorage.
 */
export function registerCompany(company: Company): Company {
  const current = getStoredCompanies();
  const existingIndex = current.findIndex((c) => c.id === company.id);
  let updated: Company[];
  if (existingIndex >= 0) {
    updated = [...current];
    updated[existingIndex] = { ...current[existingIndex], ...company };
  } else {
    updated = [...current, company];
  }
  saveStoredCompanies(updated);
  return company;
}

/**
 * Creates a brand new company with a unique permanent Company ID.
 */
export function createNewCompany(name: string): Company {
  const newComp: Company = {
    id: generateCompanyId(),
    name: name.trim() || 'New Company',
    createdAt: new Date().toISOString(),
    status: 'Active',
  };
  registerCompany(newComp);
  return newComp;
}

/**
 * Retrieves a company by its unique Company ID.
 */
export function getCompanyById(id?: string | null): Company | undefined {
  if (!id) return undefined;
  const companies = getStoredCompanies();
  return companies.find((c) => c.id === id);
}

/**
 * Gets the current active company ID from active auth session, falling back to default.
 */
export function getActiveCompanyId(): string {
  try {
    const rawAuth = localStorage.getItem('chitfund_auth');
    if (rawAuth) {
      const session = JSON.parse(rawAuth);
      if (session.companyId) {
        return session.companyId;
      }
    }
  } catch { }
  return DEFAULT_COMPANY_ID;
}
