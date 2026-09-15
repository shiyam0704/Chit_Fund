/**
 * Company Data Service - Authoritative Centralized Backend Synchronization
 * Handles cross-device shared data synchronization, CRUD mutations, and local cache.
 */

import { apiFetch } from './apiClient';
import {
  ChitScheme,
  Member,
  PaymentTransaction,
  ChitPayout,
  CompanySettings,
  AuditLogEntry,
} from '@/types';

export interface SyncResponseData {
  chits: ChitScheme[];
  members: Member[];
  transactions: PaymentTransaction[];
  payouts: ChitPayout[];
  companySettings: CompanySettings | null;
  auditLogs: AuditLogEntry[];
}

export interface SyncResult {
  success: boolean;
  companyId: string;
  timestamp: string;
  data: SyncResponseData;
}

const LOCAL_CACHE_PREFIX = 'chitfund_backend_cache_';

export function getCompanyCache(companyId: string): Partial<SyncResponseData> | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_CACHE_PREFIX}${companyId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCompanyCache(companyId: string, data: SyncResponseData): void {
  try {
    localStorage.setItem(`${LOCAL_CACHE_PREFIX}${companyId}`, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to cache company data locally', err);
  }
}

// ----------------------------------------------------------------------
// 1. Authoritative Full Sync
// ----------------------------------------------------------------------
export async function syncCompanyData(): Promise<SyncResult> {
  const result = await apiFetch<SyncResult>('sync.php');
  if (result?.data && result?.companyId) {
    setCompanyCache(result.companyId, result.data);
  }
  return result;
}

// ----------------------------------------------------------------------
// 2. Chits CRUD
// ----------------------------------------------------------------------
export async function apiCreateChit(chit: Partial<ChitScheme>): Promise<{ success: boolean; id: string }> {
  return apiFetch<{ success: boolean; id: string }>('chits.php?action=create', {
    method: 'POST',
    body: JSON.stringify(chit),
  });
}

export async function apiUpdateChit(id: string, updates: Partial<ChitScheme>): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('chits.php?action=update', {
    method: 'POST',
    body: JSON.stringify({ id, ...updates }),
  });
}

export async function apiDeleteChit(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('chits.php?action=delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

// ----------------------------------------------------------------------
// 3. Members CRUD
// ----------------------------------------------------------------------
export async function apiCreateMember(member: Partial<Member>): Promise<{ success: boolean; id: string }> {
  return apiFetch<{ success: boolean; id: string }>('members.php?action=create', {
    method: 'POST',
    body: JSON.stringify(member),
  });
}

export async function apiUpdateMember(id: string, updates: Partial<Member>): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('members.php?action=update', {
    method: 'POST',
    body: JSON.stringify({ id, ...updates }),
  });
}

export async function apiDeleteMember(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('members.php?action=delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

// ----------------------------------------------------------------------
// 4. Transactions CRUD
// ----------------------------------------------------------------------
export async function apiCreateTransaction(txn: Partial<PaymentTransaction>): Promise<{ success: boolean; id: string }> {
  return apiFetch<{ success: boolean; id: string }>('transactions.php?action=create', {
    method: 'POST',
    body: JSON.stringify(txn),
  });
}

export async function apiUpdateTransaction(id: string, updates: Partial<PaymentTransaction>): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('transactions.php?action=update', {
    method: 'POST',
    body: JSON.stringify({ id, ...updates }),
  });
}

export async function apiDeleteTransaction(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('transactions.php?action=delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

// ----------------------------------------------------------------------
// 5. Payouts CRUD
// ----------------------------------------------------------------------
export async function apiCreatePayout(payout: Partial<ChitPayout>): Promise<{ success: boolean; id: string }> {
  return apiFetch<{ success: boolean; id: string }>('payouts.php?action=create', {
    method: 'POST',
    body: JSON.stringify(payout),
  });
}

export async function apiDeletePayout(chitId: string, monthNumber: number): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('payouts.php?action=delete', {
    method: 'POST',
    body: JSON.stringify({ chitId, monthNumber }),
  });
}

// ----------------------------------------------------------------------
// 6. Company Settings
// ----------------------------------------------------------------------
export async function apiGetSettings(): Promise<{ success: boolean; settings: CompanySettings | null }> {
  return apiFetch<{ success: boolean; settings: CompanySettings | null }>('settings.php?action=get');
}

export async function apiSaveSettings(settings: CompanySettings): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('settings.php?action=update', {
    method: 'POST',
    body: JSON.stringify(settings),
  });
}

// ----------------------------------------------------------------------
// 7. Audit Logging
// ----------------------------------------------------------------------
export async function apiLogAudit(params: {
  action: string;
  module: string;
  recordId?: string;
  recordName?: string;
  description: string;
  beforeData?: any;
  afterData?: any;
  status?: string;
}): Promise<void> {
  try {
    await apiFetch('audit.php?action=log', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  } catch (err) {
    console.warn('Backend audit logging failed silently', err);
  }
}

export async function apiClearAudit(): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('audit.php?action=clear', {
    method: 'POST',
  });
}

// ----------------------------------------------------------------------
// 8. Migration from LocalStorage to Database
// ----------------------------------------------------------------------
export async function apiMigrateLocalStorage(payload: {
  chits?: any[];
  members?: any[];
  transactions?: any[];
  payouts?: any[];
  companySettings?: any;
}): Promise<{ success: boolean; message: string; imported: Record<string, any> }> {
  return apiFetch('migrate.php', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
