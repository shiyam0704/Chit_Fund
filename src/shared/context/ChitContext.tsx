import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChitScheme,
  Member,
  PaymentTransaction,
  ChitPayout,
  CompanySettings,
  MonthlyScheduleItem,
  MonthStatus,
  Auction,
  ChitSlot,
} from '@/types';
import {
  getAppData,
  updateAppData,
  defaultCompanySettings,
  getCompanyAppDataKey,
} from '@/shared/utils/storage';
import { getActiveCompanyId } from '@/features/auth/utils/companyStorage';
import { logActivity, clearAllAuditLogs } from '@/shared/services/auditService';
import {
  syncCompanyData,
  apiCreateChit,
  apiUpdateChit,
  apiDeleteChit,
  apiCreateMember,
  apiUpdateMember,
  apiDeleteMember,
  apiCreateTransaction,
  apiUpdateTransaction,
  apiDeleteTransaction,
  apiCreatePayout,
  apiDeletePayout,
  apiSaveSettings,
  apiMigrateLocalStorage,
} from '@/shared/services/companyDataService';

interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ChitContextType {
  currentRole: string;
  setCurrentRole: (role: string) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  companySettings: CompanySettings;
  updateCompanySettings: (settings: Partial<CompanySettings>) => void;
  chits: ChitScheme[];
  addChit: (chitData: Partial<ChitScheme> & { name: string; chitAmount: number }) => ChitScheme;
  updateChit: (id: string, chitData: Partial<ChitScheme>) => void;
  deleteChit: (id: string) => void;
  assignMembersToChit: (chitId: string, memberIds: string[]) => void;
  removeMemberFromChit: (chitId: string, memberId: string) => void;
  getChitEnrolledMembers: (chitId: string) => Member[];
  updateMonthStatus: (chitId: string, monthNumber: number, status: MonthStatus) => void;
  assignMemberToMonth: (chitId: string, monthNumber: number, memberId: string | string[] | null) => void;
  removeMemberFromMonth: (chitId: string, monthNumber: number, memberId: string) => void;
  updateMonthDetails: (chitId: string, monthNumber: number, details: any) => void;
  manualWinnerAssignments: Record<string, Record<number, string>>;
  members: Member[];
  addMember: (memberData: Partial<Member> & { name: string; phone: string }) => Member;
  updateMember: (id: string, memberData: Partial<Member>) => void;
  deleteMember: (id: string) => void;
  reorderChitMembers: (chitId: string, orderedMembers: Member[]) => void;
  getMonthlySchedule: (chit: ChitScheme) => MonthlyScheduleItem[];
  recordAuction: (auctionData: Partial<Auction> & { chitId: string; monthNumber: number }) => void;
  assignMemberToSlot: (slotId: string, data: Partial<Member>) => void;
  unassignMemberFromSlot: (slotId: string) => void;
  getChitSlots: (chit: ChitScheme) => ChitSlot[];
  transactions: PaymentTransaction[];
  collectPayment: (params: any) => PaymentTransaction;
  updateTransaction: (id: string, data: Partial<PaymentTransaction>) => void;
  deleteTransaction: (id: string) => void;
  payouts: ChitPayout[];
  recordPayout: (params: any) => ChitPayout;
  deletePayout: (chitId: string, monthNumber: number) => void;
  toasts: Toast[];
  addToast: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  removeToast: (id: string) => void;
  activeReceiptModal: PaymentTransaction | null;
  openReceipt: (txn: PaymentTransaction) => void;
  closeReceipt: () => void;
  clearAllData: () => void;
  syncWithBackend: (silent?: boolean) => Promise<void>;
  migrateOfflineData: () => Promise<{ success: boolean; message: string; imported?: any }>;
}

const ChitContext = createContext<ChitContextType | undefined>(undefined);

// Calculations
function calculateBaseMonthly(amount: number, count: number): number {
  if (!amount || amount <= 0 || !count || count <= 0) return 0;
  return Math.round((amount / count) * 100) / 100;
}

function calculateBidStep(initialBid: number, duration: number, method = 'Auto', customVal?: number): number {
  if (initialBid <= 0) return 0;
  if (method === 'Fixed' || method === 'Percentage') return Math.max(0, customVal ?? 0);
  return duration > 2 ? Math.round((initialBid / (duration - 2)) * 100) / 100 : 0;
}

function calculateAuctionBid(month: number, initialBid: number, duration: number, method = 'Auto', customVal?: number): number {
  if (month <= 1 || initialBid <= 0 || (duration > 1 && month >= duration)) return 0;
  if (month === 2) return Math.max(0, Math.round(initialBid * 100) / 100);
  if (method === 'Percentage') {
    const rate = Math.max(0, Math.min(100, customVal ?? 5)) / 100;
    const bid = initialBid * Math.pow(1 - rate, month - 2);
    return Math.max(0, Math.round(bid * 100) / 100);
  }
  const step = method === 'Fixed' ? Math.max(0, customVal ?? 0) : calculateBidStep(initialBid, duration, 'Auto');
  const bid = initialBid - (month - 2) * step;
  return Math.max(0, Math.round(bid * 100) / 100);
}

function calculateMonthlySchedule(params: {
  totalAmount: number;
  memberCount: number;
  durationMonths: number;
  baseMonthlyAmount?: number;
  initialBidAmount?: number;
  bidReductionMethod?: 'Auto' | 'Fixed' | 'Percentage';
  bidReductionValue?: number;
  commissionPercentage?: number;
  startDate?: string;
}): MonthlyScheduleItem[] {
  const {
    totalAmount,
    memberCount,
    durationMonths,
    baseMonthlyAmount,
    initialBidAmount = 0,
    bidReductionMethod = 'Auto',
    bidReductionValue,
    commissionPercentage = 0,
    startDate,
  } = params;

  if (totalAmount <= 0 || durationMonths <= 0 || !memberCount || memberCount <= 0) return [];
  const base = baseMonthlyAmount && baseMonthlyAmount > 0 ? baseMonthlyAmount : calculateBaseMonthly(totalAmount, memberCount);
  const start = startDate ? new Date(startDate) : new Date();
  const schedule: MonthlyScheduleItem[] = [];

  for (let m = 1; m <= durationMonths; m++) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + (m - 1));
    const dueDate = d.toISOString().split('T')[0];
    const monthLabel = `Month ${m} - ${d.toLocaleString('en-US', { month: 'short', year: 'numeric' })}`;
    const bidAmount = calculateAuctionBid(m, initialBidAmount, durationMonths, bidReductionMethod, bidReductionValue);
    const monthlyPayment = Math.max(0, Math.round((base - bidAmount) * 100) / 100);
    const dividendAmount = bidAmount > 0 ? (commissionPercentage > 0 ? (bidAmount * (1 - commissionPercentage / 100)) / memberCount : bidAmount / memberCount) : 0;
    const commission = commissionPercentage > 0 ? Math.round((totalAmount * commissionPercentage) / 100 * 100) / 100 : 0;
    const netChitAmount = Math.max(0, Math.round((totalAmount - bidAmount - (m === 1 ? commission : 0)) * 100) / 100);
    const totalCollection = Math.round(monthlyPayment * memberCount * 100) / 100;

    schedule.push({
      monthNumber: m,
      monthLabel,
      dueDate,
      baseMonthlyAmount: base,
      grossInstallment: base,
      bidAmount,
      monthlyPayment,
      netPayable: monthlyPayment,
      monthlyInstallment: monthlyPayment,
      dividendAmount: Math.max(0, Math.round(dividendAmount * 100) / 100),
      netChitAmount,
      chitValue: netChitAmount,
      expectedCollection: totalCollection,
      totalCollection,
      totalCollected: 0,
      pendingCollection: totalCollection,
      collectedAmount: 0,
      pendingAmount: totalCollection,
      status: 'Pending',
      auctionStatus: 'Pending',
      paidMembersCount: 0,
      pendingMembersCount: memberCount,
      totalEnrolledCount: memberCount,
      assignedMemberIds: [],
      assignedMembers: [],
    });
  }
  return schedule;
}

export const ChitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRole, setCurrentRole] = useState('Super Admin');
  const initial = useMemo(() => getAppData(), []);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => initial.theme || 'dark');
  const [companySettings, setCompanySettings] = useState<CompanySettings>(() => initial.companySettings || defaultCompanySettings);
  const [manualWinnerAssignments, setManualWinnerAssignments] = useState<Record<string, Record<number, string>>>(() => initial.manualWinnerAssignments || {});
  const [chits, setChits] = useState<ChitScheme[]>(() => initial.chits || []);
  const [members, setMembers] = useState<Member[]>(() => initial.members || []);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>(() => initial.transactions || []);
  const [payouts, setPayouts] = useState<ChitPayout[]>(() => initial.payouts || []);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeReceiptModal, setActiveReceiptModal] = useState<PaymentTransaction | null>(null);

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
    updateAppData((prev) => ({ ...prev, theme }));
  }, [theme]);

  const reloadCompanyData = useCallback((targetCompanyId?: string) => {
    const fresh = getAppData(targetCompanyId);
    setCompanySettings(fresh.companySettings || defaultCompanySettings);
    setChits(fresh.chits || []);
    setMembers(fresh.members || []);
    setTransactions(fresh.transactions || []);
    setPayouts(fresh.payouts || []);
    setManualWinnerAssignments(fresh.manualWinnerAssignments || {});
    if (fresh.theme) setTheme(fresh.theme);
  }, []);

  const recentlyDeletedRef = React.useRef<Set<string>>(new Set());
  const inFlightSyncRef = React.useRef<Set<string>>(new Set());

  const syncWithBackend = useCallback(async (silent = true) => {
    try {
      const res = await syncCompanyData();
      if (res?.success && res.data) {
        const serverData = res.data;
        const currentAppData = getAppData();

        // 1. Chits Merge: Server authoritative, but NEVER wipe unsynced local chits
        let finalChits: ChitScheme[] = [];
        if (Array.isArray(serverData.chits)) {
          const serverChitMap = new Map<string, ChitScheme>();
          serverData.chits.forEach((c) => serverChitMap.set(c.id, c));

          // Retain local chits not yet on server (unless recently deleted)
          const unsyncedLocalChits = (currentAppData.chits || []).filter(
            (c) => !serverChitMap.has(c.id) && !recentlyDeletedRef.current.has(c.id)
          );

          // Push local unsynced chits to server so database is populated (once per item)
          unsyncedLocalChits.forEach((localChit) => {
            if (inFlightSyncRef.current.has(localChit.id)) return;
            inFlightSyncRef.current.add(localChit.id);
            apiCreateChit(localChit)
              .then(() => inFlightSyncRef.current.delete(localChit.id))
              .catch((e) => {
                inFlightSyncRef.current.delete(localChit.id);
                console.warn('Background sync push chit error:', e);
              });
          });

          finalChits = [...serverData.chits, ...unsyncedLocalChits];
          setChits(finalChits);
        } else {
          finalChits = currentAppData.chits || [];
        }

        // 2. Members Merge: Server authoritative, but NEVER wipe unsynced local members
        let finalMembers: Member[] = [];
        if (Array.isArray(serverData.members)) {
          const serverMemberMap = new Map<string, Member>();
          serverData.members.forEach((m) => serverMemberMap.set(m.id, m));

          const unsyncedLocalMembers = (currentAppData.members || []).filter(
            (m) => !serverMemberMap.has(m.id) && !recentlyDeletedRef.current.has(m.id)
          );

          unsyncedLocalMembers.forEach((localMember) => {
            if (inFlightSyncRef.current.has(localMember.id)) return;
            inFlightSyncRef.current.add(localMember.id);
            apiCreateMember(localMember)
              .then(() => inFlightSyncRef.current.delete(localMember.id))
              .catch((e) => {
                inFlightSyncRef.current.delete(localMember.id);
                console.warn('Background sync push member error:', e);
              });
          });

          finalMembers = [...serverData.members, ...unsyncedLocalMembers];
          setMembers(finalMembers);
        } else {
          finalMembers = currentAppData.members || [];
        }

        // 3. Transactions Merge
        let finalTransactions: PaymentTransaction[] = [];
        if (Array.isArray(serverData.transactions)) {
          const serverTxnMap = new Map<string, PaymentTransaction>();
          serverData.transactions.forEach((t) => serverTxnMap.set(t.id, t));

          const unsyncedLocalTxns = (currentAppData.transactions || []).filter(
            (t) => !serverTxnMap.has(t.id) && !recentlyDeletedRef.current.has(t.id)
          );

          unsyncedLocalTxns.forEach((localTxn) => {
            if (inFlightSyncRef.current.has(localTxn.id)) return;
            inFlightSyncRef.current.add(localTxn.id);
            apiCreateTransaction(localTxn)
              .then(() => inFlightSyncRef.current.delete(localTxn.id))
              .catch((e) => {
                inFlightSyncRef.current.delete(localTxn.id);
                console.warn('Background sync push txn error:', e);
              });
          });

          finalTransactions = [...serverData.transactions, ...unsyncedLocalTxns];
          setTransactions(finalTransactions);
        } else {
          finalTransactions = currentAppData.transactions || [];
        }

        // 4. Payouts Merge
        let finalPayouts: ChitPayout[] = [];
        if (Array.isArray(serverData.payouts)) {
          const serverPayoutMap = new Map<string, ChitPayout>();
          serverData.payouts.forEach((p) => serverPayoutMap.set(p.id, p));

          const unsyncedLocalPayouts = (currentAppData.payouts || []).filter(
            (p) => !serverPayoutMap.has(p.id) && !recentlyDeletedRef.current.has(p.id)
          );

          unsyncedLocalPayouts.forEach((localPayout) => {
            apiCreatePayout(localPayout).catch((e) => console.warn('Background sync push payout error:', e));
          });

          finalPayouts = [...serverData.payouts, ...unsyncedLocalPayouts];
          setPayouts(finalPayouts);
        } else {
          finalPayouts = currentAppData.payouts || [];
        }

        // 5. Settings
        if (serverData.companySettings) {
          setCompanySettings(serverData.companySettings);
        }

        // Update local persistent storage with guaranteed merged state
        updateAppData((prev) => ({
          ...prev,
          chits: finalChits,
          members: finalMembers,
          transactions: finalTransactions,
          payouts: finalPayouts,
          companySettings: serverData.companySettings || prev.companySettings,
        }));
      }
    } catch (err: any) {
      if (!silent) {
        console.warn('Backend sync warning:', err);
      }
    }
  }, []);

  const migrateOfflineData = useCallback(async () => {
    try {
      const current = getAppData();
      const res = await apiMigrateLocalStorage({
        chits: current.chits,
        members: current.members,
        transactions: current.transactions,
        payouts: current.payouts,
        companySettings: current.companySettings,
      });
      await syncWithBackend(true);
      return res;
    } catch (err: any) {
      return { success: false, message: err.message || 'Migration failed' };
    }
  }, [syncWithBackend]);

  useEffect(() => {
    const handleCompanyChange = (e: any) => {
      reloadCompanyData(e?.detail);
      syncWithBackend(true);
    };
    const handleAppUpdated = () => reloadCompanyData();

    window.addEventListener('chitfund_company_changed', handleCompanyChange);
    window.addEventListener('chitfund_app_data_updated', handleAppUpdated);

    const handler = (e: StorageEvent) => {
      const activeKey = getCompanyAppDataKey();
      if ((e.key === activeKey || e.key === 'chitfund_app_data') && e.newValue) {
        reloadCompanyData();
      }
    };
    window.addEventListener('storage', handler);

    // Initial sync
    syncWithBackend(true);

    // Smart polling for live cross-device synchronization: every 4.5 seconds when active
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncWithBackend(true);
      }
    }, 4500);

    const onFocus = () => syncWithBackend(true);
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('chitfund_company_changed', handleCompanyChange);
      window.removeEventListener('chitfund_app_data_updated', handleAppUpdated);
      window.removeEventListener('storage', handler);
    };
  }, [reloadCompanyData, syncWithBackend]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const addToast = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    const id = 'toast_' + Date.now() + Math.random().toString(36).substr(2, 4);
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => removeToast(id), 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const updateCompanySettings = (settings: Partial<CompanySettings>) => {
    const updated = { ...companySettings, ...settings };
    setCompanySettings(updated);
    updateAppData((prev) => ({ ...prev, companySettings: updated }));
    apiSaveSettings(updated).catch((e) => console.warn('API save settings error', e));

    logActivity({
      action: 'UPDATE',
      module: 'Settings',
      recordId: 'COMPANY_SETTINGS',
      recordName: updated.companyName || 'Company Settings',
      description: 'Updated company profile and business settings',
      beforeData: companySettings,
      afterData: updated,
      status: 'Success',
    });

    addToast('Settings Saved', 'Company settings updated successfully', 'success');
  };

  const getChitEnrolledMembers = (chitId: string): Member[] => {
    const chit = chits.find((c) => c.id === chitId);
    const idSet = new Set(chit?.enrolledMemberIds || []);
    if (chit?.monthMemberAssignments) {
      Object.values(chit.monthMemberAssignments).forEach((val) => {
        if (Array.isArray(val)) val.forEach((id) => id && idSet.add(id));
        else if (typeof val === 'string' && val.trim()) idSet.add(val.trim());
      });
    }
    return members.filter((m) => {
      if (m.isAssigned === false || m.name === 'Not Assigned' || !m.name) return false;
      return m.chitId === chitId || idSet.has(m.id) || (m.enrolledChitIds && m.enrolledChitIds.includes(chitId));
    });
  };

  const getMonthlySchedule = (chit: ChitScheme): MonthlyScheduleItem[] => {
    const duration = chit.durationMonths || 0;
    if (duration <= 0) return [];
    const enrolled = getChitEnrolledMembers(chit.id);
    const count = chit.memberCount || chit.membersCount || (enrolled.length > 0 ? enrolled.length : duration);
    const base = chit.baseMonthlyAmount !== undefined && chit.baseMonthlyAmount > 0
      ? chit.baseMonthlyAmount
      : chit.monthlyInstallment !== undefined && chit.monthlyInstallment > 0
      ? chit.monthlyInstallment
      : calculateBaseMonthly(chit.chitAmount, count);

    const baseSchedule = calculateMonthlySchedule({
      totalAmount: chit.chitAmount,
      memberCount: count,
      durationMonths: duration,
      baseMonthlyAmount: base,
      initialBidAmount: chit.initialBidAmount ?? 0,
      bidReductionMethod: chit.bidReductionMethod || 'Auto',
      bidReductionValue: chit.bidReductionValue,
      commissionPercentage: chit.commissionPercentage || 0,
      startDate: chit.startDate,
    });

    const result: MonthlyScheduleItem[] = [];
    const start = chit.startDate ? new Date(chit.startDate) : new Date();

    for (let m = 1; m <= duration; m++) {
      const baseItem = baseSchedule[m - 1] || {
        monthNumber: m,
        monthLabel: `Month ${m}`,
        dueDate: '',
        baseMonthlyAmount: base,
        bidAmount: 0,
        monthlyPayment: base,
        dividendAmount: 0,
        netChitAmount: chit.chitAmount,
        totalCollection: base * count,
      };

      let monthlyPayment = baseItem.monthlyPayment;
      if (chit.installmentType === 'StepUp') {
        const step = chit.monthlyIncreaseAmount ?? chit.stepUpConfig?.increaseValue ?? 0;
        monthlyPayment = base + (m - 1) * step;
      }

      let gross = baseItem.baseMonthlyAmount;
      let bid = baseItem.bidAmount;
      let dividend = baseItem.dividendAmount;
      let netPayable = chit.installmentType === 'StepUp' ? monthlyPayment : baseItem.monthlyPayment;
      let netChit = baseItem.netChitAmount;
      let isCustom = false;

      if (chit.monthOverrides && chit.monthOverrides[m]) {
        const over = chit.monthOverrides[m];
        if (over.grossInstallment !== undefined) gross = over.grossInstallment;
        if (over.bidAmount !== undefined) bid = over.bidAmount;
        if (over.dividendAmount !== undefined) dividend = over.dividendAmount;
        if (over.monthlyPayment !== undefined) netPayable = over.monthlyPayment;
        else if (over.netPayable !== undefined) netPayable = over.netPayable;
        if (over.netChitAmount !== undefined) netChit = over.netChitAmount;
        else if (over.chitValue !== undefined) netChit = over.chitValue;
        isCustom = true;
      }

      const assignedVal = manualWinnerAssignments[chit.id]?.[m] || chit.monthMemberAssignments?.[m];
      let assignedId: string | undefined;
      if (Array.isArray(assignedVal)) assignedId = assignedVal[0]?.trim();
      else if (typeof assignedVal === 'string' && assignedVal.trim()) assignedId = assignedVal.trim();

      const winnerMember = assignedId ? members.find((mem) => mem.id === assignedId) : undefined;
      const assignedMembers = winnerMember ? [{ id: winnerMember.id, name: winnerMember.name, phone: winnerMember.phone, email: winnerMember.email }] : [];

      const activeList = enrolled.length > 0 ? enrolled : members.filter((mem) => mem.enrolledChitIds?.includes(chit.id) || mem.chitId === chit.id);
      const totalEnrolled = activeList.length || count;
      const expectedColl = netPayable * totalEnrolled;

      const monthTxns = transactions.filter(
        (t) =>
          t.chitId === chit.id &&
          (t.monthNumber === m || t.monthId === `${chit.id}-M${m}` || new RegExp(`\\bMonth\\s+${m}\\b(?!\\d)`).test(t.notes || '')) &&
          t.type !== 'Payout'
      );

      const collected = monthTxns.reduce((sum, t) => sum + (t.amount || 0), 0);
      const pending = Math.max(0, expectedColl - collected);

      const memberPaidMap = new Map<string, number>();
      monthTxns.forEach((t) => {
        if (t.memberId && t.amount > 0) {
          memberPaidMap.set(t.memberId, (memberPaidMap.get(t.memberId) || 0) + t.amount);
        }
      });

      let paidCount = 0;
      activeList.forEach((mem) => {
        const paid = memberPaidMap.get(mem.id) || 0;
        if (netPayable > 0 && paid >= netPayable) paidCount++;
      });
      const pendingCount = Math.max(0, totalEnrolled - paidCount);

      const d = new Date(start);
      d.setMonth(d.getMonth() + (m - 1));
      const dueDate = d.toISOString().split('T')[0];
      const monthLabel = `Month ${m} - ${d.toLocaleString('en-US', { month: 'short', year: 'numeric' })}`;

      let status: MonthStatus = 'Pending';
      if (chit.monthStatuses && chit.monthStatuses[m]) {
        status = chit.monthStatuses[m];
      } else if (totalEnrolled > 0 && paidCount === totalEnrolled || (collected >= expectedColl && expectedColl > 0)) {
        status = 'Paid';
      } else if (collected > 0 || paidCount > 0) {
        status = 'Partial';
      }

      const payout = payouts.find((p) => p.chitId === chit.id && p.monthNumber === m) || chit.monthPayouts?.[m];

      result.push({
        monthNumber: m,
        monthLabel,
        dueDate,
        grossInstallment: gross,
        baseMonthlyAmount: gross,
        dividendAmount: dividend,
        netPayable,
        monthlyPayment: netPayable,
        monthlyInstallment: netPayable,
        bidAmount: bid,
        netChitAmount: netChit,
        expectedCollection: expectedColl,
        totalCollected: collected,
        pendingCollection: pending,
        totalCollection: expectedColl,
        chitValue: netChit,
        status,
        auctionStatus: 'Pending',
        collectedAmount: collected,
        pendingAmount: pending,
        paidMembersCount: paidCount,
        pendingMembersCount: pendingCount,
        totalEnrolledCount: totalEnrolled,
        payoutMemberId: assignedId,
        payoutMemberName: winnerMember?.name,
        payoutMemberPhone: winnerMember?.phone,
        payoutAmount: netChit,
        payoutDate: payout?.paymentDate,
        payoutMode: payout?.paymentMode,
        payoutStatus: payout?.status || 'Pending',
        payoutReferenceNo: payout?.referenceNo,
        payoutNotes: payout?.notes,
        assignedMemberIds: assignedId ? [assignedId] : [],
        assignedMembers,
        isCustomEdited: isCustom,
      });
    }
    return result;
  };

  const calculatedMembers = useMemo(() => {
    const chitScheduleMap = new Map<string, MonthlyScheduleItem[]>();
    chits.forEach((c) => chitScheduleMap.set(c.id, getMonthlySchedule(c)));

    return members.map((m) => {
      const chitIdSet = new Set<string>();
      if (m.enrolledChitIds) m.enrolledChitIds.forEach((id) => chitIdSet.add(id));
      if (m.chitId) chitIdSet.add(m.chitId);
      chits.forEach((c) => {
        if (c.enrolledMemberIds?.includes(m.id)) chitIdSet.add(c.id);
      });

      const memberChits = chits.filter((c) => chitIdSet.has(c.id));
      const memberTxns = transactions.filter((t) => (t.memberId === m.id || t.payerMemberId === m.id) && t.type !== 'Payout');
      const totalPaid = memberTxns.reduce((sum, t) => sum + (t.amount || 0), 0);

      if (memberChits.length === 0) {
        return {
          ...m,
          totalPaid,
          pendingAmount: 0,
          paymentStatus: totalPaid > 0 ? ('Paid' as const) : ('Pending' as const),
        };
      }

      let totalExpected = 0;
      let totalDuePending = 0;
      let hasOverdue = false;
      let hasPartial = false;
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      memberChits.forEach((chit) => {
        const schedule = chitScheduleMap.get(chit.id) || getMonthlySchedule(chit);
        const duration = chit.durationMonths || schedule.length || 1;
        const start = chit.startDate ? new Date(chit.startDate) : today;
        const elapsed = Math.max(1, (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth()) + 1);
        const currentMonthIdx = Math.min(duration, elapsed);

        for (let mon = 1; mon <= duration; mon++) {
          const item = schedule.find((s) => s.monthNumber === mon);
          const due = item?.netPayable || item?.monthlyInstallment || chit.monthlyInstallment || 0;
          const paidThisMonth = memberTxns
            .filter((t) => t.chitId === chit.id && (t.monthNumber === mon || t.monthId === `${chit.id}-M${mon}` || new RegExp(`\\bMonth\\s+${mon}\\b(?!\\d)`).test(t.notes || '')))
            .reduce((sum, t) => sum + (t.amount || 0), 0);
          const remainingDue = Math.max(0, due - paidThisMonth);

          if (chit.status === 'Completed' || mon <= currentMonthIdx || (item?.dueDate && item.dueDate <= todayStr) || paidThisMonth > 0) {
            totalExpected += due;
            totalDuePending += remainingDue;
            if (remainingDue > 0) {
              if (item?.dueDate && item.dueDate < todayStr && paidThisMonth === 0) hasOverdue = true;
              else if (paidThisMonth > 0) hasPartial = true;
            }
          }
        }
      });

      let status: 'Paid' | 'Pending' | 'Partial' | 'Overdue' = 'Pending';
      if (totalDuePending === 0 && totalExpected > 0) status = 'Paid';
      else if (hasOverdue) status = 'Overdue';
      else if (hasPartial || totalPaid > 0) status = 'Partial';

      return {
        ...m,
        totalPaid,
        pendingAmount: totalDuePending,
        paymentStatus: status,
      };
    });
  }, [members, chits, transactions, manualWinnerAssignments, payouts]);

  const addChit = (chitData: Partial<ChitScheme> & { name: string; chitAmount: number }): ChitScheme => {
    const id = `CHIT-${Math.floor(100 + Math.random() * 900)}`;
    const duration = chitData.durationMonths || 0;
    const isConfigured = duration > 0;
    const count = chitData.memberCount || chitData.membersCount || duration || 20;
    const base = chitData.baseMonthlyAmount !== undefined
      ? chitData.baseMonthlyAmount
      : chitData.monthlyInstallment !== undefined && chitData.monthlyInstallment > 0
      ? chitData.monthlyInstallment
      : calculateBaseMonthly(chitData.chitAmount, count);

    const newChit: ChitScheme = {
      id,
      companyId: chitData.companyId || getActiveCompanyId(),
      name: chitData.name,
      chitAmount: chitData.chitAmount,
      membersCount: count,
      memberCount: count,
      durationMonths: duration,
      monthlyInstallment: chitData.monthlyInstallment === undefined ? base : chitData.monthlyInstallment,
      baseMonthlyAmount: base,
      initialBidAmount: chitData.initialBidAmount === undefined ? 0 : chitData.initialBidAmount,
      bidReductionMethod: chitData.bidReductionMethod || 'Auto',
      bidReductionValue: chitData.bidReductionValue === undefined ? 0 : chitData.bidReductionValue,
      collectedAmount: 0,
      pendingAmount: chitData.chitAmount,
      startDate: chitData.startDate || new Date().toISOString().split('T')[0],
      endDate: chitData.endDate || '',
      commissionPercentage: chitData.commissionPercentage === undefined ? 5 : chitData.commissionPercentage,
      gracePeriodDays: chitData.gracePeriodDays === undefined ? 5 : chitData.gracePeriodDays,
      status: chitData.status || (isConfigured ? 'Active' : 'Draft'),
      description: chitData.description || '',
      installmentType: chitData.installmentType || 'Fixed',
      monthlyIncreaseAmount: chitData.monthlyIncreaseAmount === undefined ? chitData.stepUpConfig?.increaseValue || 0 : chitData.monthlyIncreaseAmount,
      stepUpConfig: chitData.stepUpConfig,
      auctions: chitData.auctions || [],
      isConfigured,
      enrolledMemberIds: chitData.enrolledMemberIds || [],
      monthMemberAssignments: {},
    };

    setChits((prev) => [newChit, ...prev]);
    updateAppData((prev) => ({ ...prev, chits: [newChit, ...prev.chits] }));
    apiCreateChit(newChit).catch((e) => console.warn('API create chit error', e));

    logActivity({
      action: 'CREATE',
      module: 'Chits',
      recordId: newChit.id,
      recordName: newChit.name,
      description: `Created new chit scheme "${newChit.name}" with total value of ₹${newChit.chitAmount.toLocaleString('en-IN')}`,
      afterData: newChit,
      status: 'Success',
    });

    addToast('Chit Created', `Scheme ${newChit.name} created successfully`, 'success');
    return newChit;
  };

  const updateChit = (id: string, chitData: Partial<ChitScheme>) => {
    const existing = chits.find((c) => c.id === id);
    setChits((prev) => prev.map((c) => (c.id === id ? { ...c, ...chitData } : c)));
    updateAppData((prev) => ({ ...prev, chits: prev.chits.map((c) => (c.id === id ? { ...c, ...chitData } : c)) }));
    apiUpdateChit(id, chitData).catch((e) => console.warn('API update chit error', e));

    if (existing) {
      logActivity({
        action: 'UPDATE',
        module: 'Chits',
        recordId: id,
        recordName: existing.name,
        description: `Updated chit scheme parameters for "${existing.name}"`,
        beforeData: existing,
        afterData: { ...existing, ...chitData },
        status: 'Success',
      });
    }

    addToast('Chit Updated', 'Scheme details saved successfully', 'success');
  };

  const deleteChit = (id: string) => {
    const existing = chits.find((c) => c.id === id);
    if (!existing) return;
    recentlyDeletedRef.current.add(id);
    setChits((prev) => prev.filter((c) => c.id !== id));
    setMembers((prev) => prev.filter((m) => m.chitId !== id).map((m) => ({ ...m, enrolledChitIds: m.enrolledChitIds?.filter((x) => x !== id) })));
    setTransactions((prev) => prev.filter((t) => t.chitId !== id));
    setPayouts((prev) => prev.filter((p) => p.chitId !== id));
    apiDeleteChit(id).catch((e) => console.warn('API delete chit error', e));

    updateAppData((prev) => ({
      ...prev,
      chits: prev.chits.filter((c) => c.id !== id),
      members: prev.members.filter((m) => m.chitId !== id).map((m) => ({ ...m, enrolledChitIds: m.enrolledChitIds?.filter((x) => x !== id) })),
      transactions: prev.transactions.filter((t) => t.chitId !== id),
      payouts: prev.payouts.filter((p) => p.chitId !== id),
    }));

    logActivity({
      action: 'DELETE',
      module: 'Chits',
      recordId: id,
      recordName: existing.name,
      description: `Deleted chit scheme "${existing.name}" (Value: ₹${existing.chitAmount.toLocaleString('en-IN')})`,
      beforeData: existing,
      status: 'Success',
    });

    addToast('Chit Deleted', `Scheme ${existing.name} has been deleted`, 'warning');
  };

  const assignMembersToChit = (chitId: string, memberIds: string[]) => {
    const chit = chits.find((c) => c.id === chitId);
    if (!chit || !memberIds.length) return;
    const combined = Array.from(new Set([...(chit.enrolledMemberIds || []), ...memberIds]));

    setChits((prev) => prev.map((c) => (c.id === chitId ? { ...c, enrolledMemberIds: combined } : c)));
    setMembers((prev) =>
      prev.map((m) => {
        if (memberIds.includes(m.id)) {
          const list = Array.from(new Set([...(m.enrolledChitIds || (m.chitId ? [m.chitId] : [])), chitId]));
          return { ...m, chitId: m.chitId || chitId, chitName: m.chitName || chit.name, enrolledChitIds: list };
        }
        return m;
      })
    );

    updateAppData((prev) => ({
      ...prev,
      chits: prev.chits.map((c) => (c.id === chitId ? { ...c, enrolledMemberIds: combined } : c)),
      members: prev.members.map((m) => {
        if (memberIds.includes(m.id)) {
          const list = Array.from(new Set([...(m.enrolledChitIds || (m.chitId ? [m.chitId] : [])), chitId]));
          return { ...m, chitId: m.chitId || chitId, chitName: m.chitName || chit.name, enrolledChitIds: list };
        }
        return m;
      }),
    }));
    addToast('Members Assigned', `${memberIds.length} member(s) assigned to ${chit.name}`, 'success');
  };

  const removeMemberFromChit = (chitId: string, memberId: string) => {
    const chit = chits.find((c) => c.id === chitId);
    setChits((prev) =>
      prev.map((c) => (c.id === chitId ? { ...c, enrolledMemberIds: (c.enrolledMemberIds || []).filter((x) => x !== memberId) } : c))
    );
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === memberId) {
          const updated = (m.enrolledChitIds || (m.chitId ? [m.chitId] : [])).filter((x) => x !== chitId);
          const newChitId = m.chitId === chitId ? updated[0] || '' : m.chitId;
          const newName = newChitId ? chits.find((c) => c.id === newChitId)?.name || '' : '';
          return { ...m, chitId: newChitId, chitName: newName, enrolledChitIds: updated };
        }
        return m;
      })
    );

    updateAppData((prev) => ({
      ...prev,
      chits: prev.chits.map((c) => (c.id === chitId ? { ...c, enrolledMemberIds: (c.enrolledMemberIds || []).filter((x) => x !== memberId) } : c)),
      members: prev.members.map((m) => {
        if (m.id === memberId) {
          const updated = (m.enrolledChitIds || (m.chitId ? [m.chitId] : [])).filter((x) => x !== chitId);
          const newChitId = m.chitId === chitId ? updated[0] || '' : m.chitId;
          const newName = newChitId ? prev.chits.find((c) => c.id === newChitId)?.name || '' : '';
          return { ...m, chitId: newChitId, chitName: newName, enrolledChitIds: updated };
        }
        return m;
      }),
    }));
    addToast('Member Removed', `Member removed from ${chit?.name || 'chit'}`, 'info');
  };

  const updateMonthStatus = (chitId: string, monthNumber: number, status: MonthStatus) => {
    setChits((prev) =>
      prev.map((c) => {
        if (c.id === chitId) {
          const current = c.monthStatuses || {};
          return { ...c, monthStatuses: { ...current, [monthNumber]: status } };
        }
        return c;
      })
    );
    updateAppData((prev) => ({
      ...prev,
      chits: prev.chits.map((c) => {
        if (c.id === chitId) {
          const current = c.monthStatuses || {};
          return { ...c, monthStatuses: { ...current, [monthNumber]: status } };
        }
        return c;
      }),
    }));
    addToast('Month Status Updated', `Month ${monthNumber} set to ${status}`, 'success');
  };

  const assignMemberToMonth = (chitId: string, monthNumber: number, memberId: string | string[] | null) => {
    const singleId = Array.isArray(memberId) ? memberId[0]?.trim() || null : (typeof memberId === 'string' && memberId.trim()) || null;

    setManualWinnerAssignments((prev) => {
      const copy = { ...(prev[chitId] || {}) };
      if (singleId) copy[monthNumber] = singleId;
      else delete copy[monthNumber];
      return { ...prev, [chitId]: copy };
    });

    setChits((prev) =>
      prev.map((c) => {
        if (c.id === chitId) {
          const copy = { ...(c.monthMemberAssignments || {}) };
          if (singleId) copy[monthNumber] = [singleId];
          else delete copy[monthNumber];
          return { ...c, monthMemberAssignments: copy };
        }
        return c;
      })
    );

    updateAppData((prev) => {
      const copy = { ...(prev.manualWinnerAssignments[chitId] || {}) };
      if (singleId) copy[monthNumber] = singleId;
      else delete copy[monthNumber];
      const updatedChits = prev.chits.map((c) => {
        if (c.id === chitId) {
          const mcopy = { ...(c.monthMemberAssignments || {}) };
          if (singleId) mcopy[monthNumber] = [singleId];
          else delete mcopy[monthNumber];
          return { ...c, monthMemberAssignments: mcopy };
        }
        return c;
      });
      return { ...prev, manualWinnerAssignments: { ...prev.manualWinnerAssignments, [chitId]: copy }, chits: updatedChits };
    });

    const mem = members.find((m) => m.id === singleId);
    addToast(singleId ? 'Winner Selected' : 'Winner Cleared', singleId && mem ? `Month ${monthNumber} Winner set to ${mem.name}` : `Month ${monthNumber} Winner cleared`, 'success');
  };

  const removeMemberFromMonth = (chitId: string, monthNumber: number, memberId: string) => {
    setChits((prev) =>
      prev.map((c) => {
        if (c.id === chitId) {
          const map = { ...(c.monthMemberAssignments || {}) };
          const list = Array.isArray(map[monthNumber]) ? map[monthNumber] : map[monthNumber] ? [map[monthNumber] as any] : [];
          const filtered = list.filter((id: string) => id !== memberId);
          if (filtered.length > 0) map[monthNumber] = filtered;
          else delete map[monthNumber];
          return { ...c, monthMemberAssignments: map };
        }
        return c;
      })
    );

    updateAppData((prev) => ({
      ...prev,
      chits: prev.chits.map((c) => {
        if (c.id === chitId) {
          const map = { ...(c.monthMemberAssignments || {}) };
          const list = Array.isArray(map[monthNumber]) ? map[monthNumber] : map[monthNumber] ? [map[monthNumber] as any] : [];
          const filtered = list.filter((id: string) => id !== memberId);
          if (filtered.length > 0) map[monthNumber] = filtered;
          else delete map[monthNumber];
          return { ...c, monthMemberAssignments: map };
        }
        return c;
      }),
    }));
    addToast('Member Removed', `Member removed from Month ${monthNumber}`, 'info');
  };

  const updateMonthDetails = (chitId: string, monthNumber: number, details: any) => {
    setChits((prev) =>
      prev.map((c) => {
        if (c.id === chitId) {
          const copy = { ...(c.monthOverrides || {}) };
          copy[monthNumber] = { ...copy[monthNumber], ...details };
          return { ...c, monthOverrides: copy };
        }
        return c;
      })
    );
    updateAppData((prev) => ({
      ...prev,
      chits: prev.chits.map((c) => {
        if (c.id === chitId) {
          const copy = { ...(c.monthOverrides || {}) };
          copy[monthNumber] = { ...copy[monthNumber], ...details };
          return { ...c, monthOverrides: copy };
        }
        return c;
      }),
    }));
    addToast('Month Updated', `Month ${monthNumber} calculation details saved`, 'success');
  };

  const addMember = (memberData: Partial<Member> & { name: string; phone: string }): Member => {
    const nums = members
      .map((m) => {
        const match = m.id.match(/^CH(\d+)$/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => !isNaN(n) && n > 0);
    const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
    const id = `CH${String(maxNum + 1).padStart(3, '0')}`;
    const targetChit = memberData.chitId ? chits.find((c) => c.id === memberData.chitId) : null;
    const enrolledIds = memberData.enrolledChitIds || (memberData.chitId ? [memberData.chitId] : []);

    const newMember: Member = {
      id,
      companyId: memberData.companyId || getActiveCompanyId(),
      name: memberData.name.trim(),
      phone: memberData.phone.trim(),
      email: memberData.email?.trim() || '',
      address: memberData.address?.trim() || '',
      chitId: memberData.chitId || '',
      chitName: targetChit ? targetChit.name : memberData.chitName || '',
      monthlyDue: targetChit ? targetChit.monthlyInstallment : memberData.monthlyDue || 0,
      totalPaid: 0,
      pendingAmount: memberData.monthlyDue || 0,
      status: memberData.status || 'Active',
      paymentStatus: 'Pending',
      joinedDate: memberData.joinedDate || new Date().toISOString().split('T')[0],
      isAssigned: true,
      enrolledChitIds: enrolledIds,
    };

    setMembers((prev) => [newMember, ...prev]);
    if (enrolledIds.length > 0) {
      setChits((prev) =>
        prev.map((c) => {
          if (enrolledIds.includes(c.id)) {
            const list = c.enrolledMemberIds || [];
            if (!list.includes(id)) return { ...c, enrolledMemberIds: [...list, id] };
          }
          return c;
        })
      );
    }

    updateAppData((prev) => {
      const chitsUpdated = prev.chits.map((c) => {
        if (enrolledIds.includes(c.id)) {
          const list = c.enrolledMemberIds || [];
          if (!list.includes(id)) return { ...c, enrolledMemberIds: [...list, id] };
        }
        return c;
      });
      return { ...prev, members: [newMember, ...prev.members], chits: chitsUpdated };
    });

    logActivity({
      action: 'CREATE',
      module: 'Members',
      recordId: newMember.id,
      recordName: newMember.name,
      description: `Registered new member "${newMember.name}" (${newMember.id}, Phone: ${newMember.phone})`,
      afterData: newMember,
      status: 'Success',
    });

    apiCreateMember(newMember).catch((e) => console.warn('API create member error', e));

    addToast('Member Registered', `Member ${newMember.name} (${id}) added to Member Directory`, 'success');
    return newMember;
  };

  const updateMember = (id: string, memberData: Partial<Member>) => {
    const existing = members.find((m) => m.id === id);
    let updatedMemberObj: Member | null = null;

    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const targetChit = memberData.chitId ? chits.find((c) => c.id === memberData.chitId) : null;
          updatedMemberObj = {
            ...m,
            ...memberData,
            chitName: targetChit ? targetChit.name : memberData.chitName || m.chitName,
            monthlyDue: targetChit ? targetChit.monthlyInstallment : memberData.monthlyDue || m.monthlyDue,
          };
          return updatedMemberObj;
        }
        return m;
      })
    );

    if (memberData.name) {
      setTransactions((prev) => prev.map((t) => (t.memberId === id ? { ...t, memberName: memberData.name! } : t)));
    }

    updateAppData((prev) => {
      const updatedMembers = prev.members.map((m) => {
        if (m.id === id) {
          const targetChit = memberData.chitId ? prev.chits.find((c) => c.id === memberData.chitId) : null;
          return {
            ...m,
            ...memberData,
            chitName: targetChit ? targetChit.name : memberData.chitName || m.chitName,
            monthlyDue: targetChit ? targetChit.monthlyInstallment : memberData.monthlyDue || m.monthlyDue,
          };
        }
        return m;
      });
      const updatedTxns = memberData.name
        ? prev.transactions.map((t) => (t.memberId === id ? { ...t, memberName: memberData.name! } : t))
        : prev.transactions;
      return { ...prev, members: updatedMembers, transactions: updatedTxns };
    });

    if (existing && updatedMemberObj) {
      logActivity({
        action: 'UPDATE',
        module: 'Members',
        recordId: id,
        recordName: existing.name,
        description: `Updated member profile details for "${existing.name}" (${id})`,
        beforeData: existing,
        afterData: updatedMemberObj,
        status: 'Success',
      });
    }

    apiUpdateMember(id, memberData).catch((e) => console.warn('API update member error', e));

    addToast('Member Updated', `Profile details for member ${id} saved`, 'success');
  };

  const deleteMember = (id: string) => {
    const existing = members.find((m) => m.id === id);
    if (!existing) return;
    recentlyDeletedRef.current.add(id);
    const hasTxns = transactions.some((t) => t.memberId === id);
    const hasAssignments = chits.some((c) =>
      Object.values(c.monthMemberAssignments || {}).some((val) => (Array.isArray(val) ? val.includes(id) : val === id))
    );

    apiDeleteMember(id).catch((e) => console.warn('API delete member error', e));

    if (hasTxns || hasAssignments) {
      setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'Inactive', isAssigned: false } : m)));
      updateAppData((prev) => ({
        ...prev,
        members: prev.members.map((m) => (m.id === id ? { ...m, status: 'Inactive', isAssigned: false } : m)),
      }));

      logActivity({
        action: 'DELETE',
        module: 'Members',
        recordId: id,
        recordName: existing.name,
        description: `Deactivated member "${existing.name}" (${id}) to preserve transaction ledger history`,
        beforeData: existing,
        afterData: { ...existing, status: 'Inactive', isAssigned: false },
        status: 'Success',
      });

      addToast('Member Deactivated', `Member ${existing.name} (${id}) deactivated safely to preserve financial history.`, 'warning');
    } else {
      setMembers((prev) => prev.filter((m) => m.id !== id));
      setChits((prev) =>
        prev.map((c) => {
          const map = { ...(c.monthMemberAssignments || {}) };
          let changed = false;
          Object.keys(map).forEach((k) => {
            const list = map[Number(k)];
            if (Array.isArray(list)) {
              if (list.includes(id)) {
                map[Number(k)] = list.filter((x) => x !== id);
                changed = true;
              }
            } else if (list === id) {
              delete map[Number(k)];
              changed = true;
            }
          });
          return changed ? { ...c, monthMemberAssignments: map } : c;
        })
      );
      updateAppData((prev) => ({
        ...prev,
        members: prev.members.filter((m) => m.id !== id),
        chits: prev.chits.map((c) => {
          const map = { ...(c.monthMemberAssignments || {}) };
          let changed = false;
          Object.keys(map).forEach((k) => {
            const list = map[Number(k)];
            if (Array.isArray(list)) {
              if (list.includes(id)) {
                map[Number(k)] = list.filter((x) => x !== id);
                changed = true;
              }
            } else if (list === id) {
              delete map[Number(k)];
              changed = true;
            }
          });
          return changed ? { ...c, monthMemberAssignments: map } : c;
        }),
      }));

      logActivity({
        action: 'DELETE',
        module: 'Members',
        recordId: id,
        recordName: existing.name,
        description: `Deleted member record for "${existing.name}" (${id})`,
        beforeData: existing,
        status: 'Success',
      });

      addToast('Member Deleted', `Member ${existing.name} (${id}) deleted successfully.`, 'success');
    }
  };

  const reorderChitMembers = (chitId: string, orderedMembers: Member[]) => {
    setMembers((prev) => {
      const orderSet = new Set(orderedMembers.map((m) => m.id));
      let idx = 0;
      return prev.map((m) => (m.chitId === chitId && orderSet.has(m.id) ? orderedMembers[idx++] : m));
    });
    updateAppData((prev) => {
      const orderSet = new Set(orderedMembers.map((m) => m.id));
      let idx = 0;
      return { ...prev, members: prev.members.map((m) => (m.chitId === chitId && orderSet.has(m.id) ? orderedMembers[idx++] : m)) };
    });
    addToast('Order Saved', 'Member sequence updated', 'info');
  };

  const recordAuction = (auctionData: Partial<Auction> & { chitId: string; monthNumber: number }) => {
    const id = `AUC-${Date.now()}`;
    const newAuction = { ...auctionData, id } as Auction;
    setChits((prev) =>
      prev.map((c) => {
        if (c.id === auctionData.chitId) {
          const list = c.auctions || [];
          return { ...c, auctions: [newAuction, ...list.filter((a) => a.monthNumber !== auctionData.monthNumber)] };
        }
        return c;
      })
    );
    updateAppData((prev) => ({
      ...prev,
      chits: prev.chits.map((c) => {
        if (c.id === auctionData.chitId) {
          const list = c.auctions || [];
          return { ...c, auctions: [newAuction, ...list.filter((a) => a.monthNumber !== auctionData.monthNumber)] };
        }
        return c;
      }),
    }));
    addToast('Auction Recorded', `Month ${auctionData.monthNumber} auction results saved`, 'success');
  };

  const assignMemberToSlot = (slotId: string, data: Partial<Member>) => {
    setMembers((prev) => prev.map((m) => (m.id === slotId ? { ...m, ...data, isAssigned: true } : m)));
    updateAppData((prev) => ({ ...prev, members: prev.members.map((m) => (m.id === slotId ? { ...m, ...data, isAssigned: true } : m)) }));
    addToast('Slot Assigned', 'Member assigned to slot successfully', 'success');
  };

  const unassignMemberFromSlot = (slotId: string) => {
    setMembers((prev) => prev.map((m) => (m.id === slotId ? { ...m, name: 'Not Assigned', phone: '', email: '', address: '', isAssigned: false } : m)));
    updateAppData((prev) => ({
      ...prev,
      members: prev.members.map((m) => (m.id === slotId ? { ...m, name: 'Not Assigned', phone: '', email: '', address: '', isAssigned: false } : m)),
    }));
    addToast('Slot Unassigned', 'Slot is now available', 'info');
  };

  const getChitSlots = (chit: ChitScheme): ChitSlot[] => {
    const count = chit.membersCount || chit.durationMonths || 20;
    const enrolled = getChitEnrolledMembers(chit.id);
    const slots: ChitSlot[] = [];

    for (let i = 1; i <= count; i++) {
      const assigned = enrolled[i - 1];
      if (assigned) {
        slots.push({ ...assigned, slotNumber: i, isAssigned: true });
      } else {
        slots.push({
          id: `SLOT-${chit.id}-${i}`,
          name: 'Not Assigned',
          phone: '',
          email: '',
          address: '',
          chitId: chit.id,
          chitName: chit.name,
          monthlyDue: chit.monthlyInstallment,
          totalPaid: 0,
          pendingAmount: chit.monthlyInstallment,
          status: 'Active',
          paymentStatus: 'Pending',
          joinedDate: new Date().toISOString().split('T')[0],
          slotNumber: i,
          isAssigned: false,
        });
      }
    }
    return slots;
  };

  const collectPayment = (params: any): PaymentTransaction => {
    const memId = params.memberId || params.payerMemberId;
    const member = members.find((m) => m.id === memId);
    const chit = chits.find((c) => c.id === (params.chitId || member?.chitId));

    const finalMemId = member ? member.id : memId || 'MEM-0';
    const finalMemName = member ? member.name : params.memberName || 'Member';
    const finalMemPhone = member ? member.phone : params.memberPhone || '';
    const finalChitId = chit ? chit.id : params.chitId || member?.chitId || '';
    const finalChitName = chit ? chit.name : member?.chitName || 'Chit Scheme';
    const dueAmount = params.dueAmount !== undefined ? params.dueAmount : member ? member.monthlyDue : params.amount;
    const remaining = Math.max(0, dueAmount - params.amount);

    let status = params.status;
    if (!status) {
      status = params.amount > 0 ? (params.amount >= dueAmount && dueAmount > 0 ? 'Paid' : 'Partial') : 'none';
    }

    const dateFormatted = params.date ? params.date.replace(/-/g, '') : new Date().toISOString().split('T')[0].replace(/-/g, '');
    const randCode = String(Math.floor(10000 + Math.random() * 90000));
    const receiptNo = `${companySettings.receiptPrefix || 'REC-'}${dateFormatted}-${randCode}`;

    const newTxn: PaymentTransaction = {
      id: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      companyId: params.companyId || getActiveCompanyId(),
      receiptNo,
      memberId: finalMemId,
      payerMemberId: finalMemId,
      memberName: finalMemName,
      memberPhone: finalMemPhone,
      chitId: finalChitId,
      chitName: finalChitName,
      monthNumber: params.monthNumber,
      monthId: params.monthId || (finalChitId && params.monthNumber ? `${finalChitId}-M${params.monthNumber}` : undefined),
      amount: params.amount,
      paidAmount: params.amount,
      dueAmount,
      monthlyDue: dueAmount,
      previousPending: member ? member.pendingAmount : 0,
      currentDue: dueAmount,
      remainingBalance: remaining,
      paymentMode: params.paymentMode,
      date: params.date,
      paymentDate: params.date,
      paidTo: params.paidTo || 'Organizer',
      paidToType: params.paidToType || (params.paidTo && params.paidTo.toLowerCase().includes('winner') ? 'WINNER' : 'ORGANIZER'),
      paidToMemberId: params.paidToMemberId === undefined ? null : params.paidToMemberId,
      receiverId: params.receiverId,
      receiverName: params.receiverName || params.paidTo || 'Organizer',
      collectedBy: `${currentRole}`,
      status,
      referenceNo: params.referenceNo || params.referenceId || '',
      referenceId: params.referenceId || params.referenceNo || '',
      notes: params.notes || `Collection recorded for ${finalChitName}${params.monthNumber ? ` - Month ${params.monthNumber}` : ''}`,
      type: 'Collection',
      createdAt: params.createdAt || new Date().toISOString(),
      receiptUrl: params.receiptUrl,
    };

    setTransactions((prev) => [newTxn, ...prev]);
    if (finalChitId) {
      setChits((prev) =>
        prev.map((c) =>
          c.id === finalChitId
            ? {
                ...c,
                collectedAmount: (c.collectedAmount || 0) + params.amount,
                pendingAmount: Math.max(0, (c.pendingAmount || c.chitAmount) - params.amount),
              }
            : c
        )
      );
    }

    updateAppData((prev) => ({
      ...prev,
      transactions: [newTxn, ...prev.transactions],
      chits: prev.chits.map((c) =>
        c.id === finalChitId
          ? {
              ...c,
              collectedAmount: (c.collectedAmount || 0) + params.amount,
              pendingAmount: Math.max(0, (c.pendingAmount || c.chitAmount) - params.amount),
            }
          : c
      ),
    }));

    logActivity({
      action: 'CREATE',
      module: 'Payments',
      recordId: newTxn.id,
      recordName: `Receipt #${receiptNo}`,
      description: `Recorded collection payment of ₹${params.amount.toLocaleString('en-IN')} (${params.paymentMode}) for member "${finalMemName}" in "${finalChitName}"`,
      afterData: newTxn,
      status: 'Success',
    });

    apiCreateTransaction(newTxn).catch((e) => console.warn('API create transaction error', e));

    addToast('Payment Recorded!', `Receipt #${receiptNo} created for ₹${params.amount.toLocaleString('en-IN')}`, 'success');
    setActiveReceiptModal(newTxn);
    return newTxn;
  };

  const updateTransaction = (id: string, data: Partial<PaymentTransaction>) => {
    const existing = transactions.find((t) => t.id === id);
    if (!existing) return;
    const diff = (data.amount === undefined ? existing.amount : data.amount) - existing.amount;

    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
    apiUpdateTransaction(id, data).catch((e) => console.warn('API update transaction error', e));
    if (diff !== 0 && existing.type === 'Collection' && existing.chitId) {
      setChits((prev) =>
        prev.map((c) =>
          c.id === existing.chitId
            ? {
                ...c,
                collectedAmount: Math.max(0, (c.collectedAmount || 0) + diff),
                pendingAmount: Math.max(0, (c.pendingAmount || c.chitAmount) - diff),
              }
            : c
        )
      );
    }

    updateAppData((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) => (t.id === id ? { ...t, ...data } : t)),
      chits:
        diff !== 0 && existing.type === 'Collection' && existing.chitId
          ? prev.chits.map((c) =>
              c.id === existing.chitId
                ? {
                    ...c,
                    collectedAmount: Math.max(0, (c.collectedAmount || 0) + diff),
                    pendingAmount: Math.max(0, (c.pendingAmount || c.chitAmount) - diff),
                  }
                : c
            )
          : prev.chits,
    }));

    logActivity({
      action: 'UPDATE',
      module: 'Payments',
      recordId: id,
      recordName: `Receipt #${existing.receiptNo || existing.id}`,
      description: `Updated payment transaction details for receipt #${existing.receiptNo || existing.id} (Member: ${existing.memberName})`,
      beforeData: existing,
      afterData: { ...existing, ...data },
      status: 'Success',
    });

    addToast('Payment Updated', `Receipt #${existing.receiptNo || existing.id} details saved successfully`, 'success');
  };

  const deleteTransaction = (id: string) => {
    const existing = transactions.find((t) => t.id === id);
    if (!existing) return;
    recentlyDeletedRef.current.add(id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    apiDeleteTransaction(id).catch((e) => console.warn('API delete transaction error', e));
    if (existing.type === 'Collection' && existing.chitId) {
      setChits((prev) =>
        prev.map((c) =>
          c.id === existing.chitId
            ? {
                ...c,
                collectedAmount: Math.max(0, (c.collectedAmount || 0) - existing.amount),
                pendingAmount: (c.pendingAmount || c.chitAmount) + existing.amount,
              }
            : c
        )
      );
    }

    updateAppData((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
      chits:
        existing.type === 'Collection' && existing.chitId
          ? prev.chits.map((c) =>
              c.id === existing.chitId
                ? {
                    ...c,
                    collectedAmount: Math.max(0, (c.collectedAmount || 0) - existing.amount),
                    pendingAmount: (c.pendingAmount || c.chitAmount) + existing.amount,
                  }
                : c
            )
          : prev.chits,
    }));

    logActivity({
      action: 'DELETE',
      module: 'Payments',
      recordId: id,
      recordName: `Receipt #${existing.receiptNo || existing.id}`,
      description: `Deleted payment transaction #${existing.receiptNo || existing.id} (Amount: ₹${existing.amount.toLocaleString('en-IN')})`,
      beforeData: existing,
      status: 'Success',
    });

    addToast('Transaction Deleted', `Transaction #${existing.receiptNo || existing.id} has been removed.`, 'info');
  };

  const recordPayout = (params: any): ChitPayout => {
    const chit = chits.find((c) => c.id === params.chitId);
    const member = members.find((m) => m.id === params.memberId);
    const winnerName = member ? member.name : params.memberName || 'Winning Member';
    const winnerPhone = member ? member.phone : params.memberPhone || '';
    const chitName = chit ? chit.name : 'Chit Scheme';

    const newPayout: ChitPayout = {
      id: `POUT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      companyId: params.companyId || getActiveCompanyId(),
      chitId: params.chitId,
      monthId: `${params.chitId}-M${params.monthNumber}`,
      monthNumber: params.monthNumber,
      memberId: params.memberId,
      memberName: winnerName,
      memberPhone: winnerPhone,
      amount: params.amount,
      paymentDate: params.paymentDate,
      paymentMode: params.paymentMode,
      status: params.status || 'Paid',
      referenceNo: params.referenceNo || params.referenceId || '',
      referenceId: params.referenceId || params.referenceNo || '',
      receiptUrl: params.receiptUrl,
      paidByType: params.paidByType || 'ORGANIZER',
      notes: params.notes || `Month ${params.monthNumber} Chit Payout to ${winnerName}`,
      type: 'Payout',
      createdAt: new Date().toISOString(),
    };

    setPayouts((prev) => [newPayout, ...prev.filter((p) => p.chitId !== params.chitId || p.monthNumber !== params.monthNumber)]);
    setChits((prev) =>
      prev.map((c) => {
        if (c.id === params.chitId) {
          const map = { ...(c.monthPayouts || {}), [params.monthNumber]: newPayout };
          return { ...c, monthPayouts: map };
        }
        return c;
      })
    );

    const receiptNo = `POUT-${params.paymentDate ? params.paymentDate.replace(/-/g, '') : new Date().toISOString().split('T')[0].replace(/-/g, '')}-${String(Math.floor(10000 + Math.random() * 90000))}`;
    const newTxn: PaymentTransaction = {
      id: `TXN-POUT-${Date.now()}`,
      receiptNo,
      memberId: params.memberId,
      memberName: winnerName,
      memberPhone: winnerPhone,
      chitId: params.chitId,
      chitName,
      amount: params.amount,
      paidAmount: params.amount,
      dueAmount: params.amount,
      monthlyDue: params.amount,
      paymentMode: params.paymentMode,
      date: params.paymentDate,
      paymentDate: params.paymentDate,
      status: params.status === 'Paid' ? 'Paid' : 'Pending',
      notes: params.notes || `Payout for Month ${params.monthNumber}`,
      monthNumber: params.monthNumber,
      monthId: `${params.chitId}-M${params.monthNumber}`,
      referenceNo: params.referenceNo || params.referenceId || '',
      referenceId: params.referenceId || params.referenceNo || '',
      receiptUrl: params.receiptUrl,
      type: 'Payout',
      createdAt: new Date().toISOString(),
    };

    setTransactions((prev) => [newTxn, ...prev.filter((t) => t.chitId !== params.chitId || t.monthNumber !== params.monthNumber || t.type !== 'Payout')]);

    updateAppData((prev) => {
      const updatedPayouts = [newPayout, ...prev.payouts.filter((p) => p.chitId !== params.chitId || p.monthNumber !== params.monthNumber)];
      const updatedChits = prev.chits.map((c) => {
        if (c.id === params.chitId) {
          const map = { ...(c.monthPayouts || {}), [params.monthNumber]: newPayout };
          return { ...c, monthPayouts: map };
        }
        return c;
      });
      const updatedTxns = [
        newTxn,
        ...prev.transactions.filter((t) => t.chitId !== params.chitId || t.monthNumber !== params.monthNumber || t.type !== 'Payout'),
      ];
      return { ...prev, payouts: updatedPayouts, chits: updatedChits, transactions: updatedTxns };
    });

    logActivity({
      action: 'CREATE',
      module: 'Payments',
      recordId: newPayout.id,
      recordName: `Month ${params.monthNumber} Payout`,
      description: `Disbursed prize payout of ₹${params.amount.toLocaleString('en-IN')} to "${winnerName}" (${chitName}, Month ${params.monthNumber})`,
      afterData: newPayout,
      status: 'Success',
    });

    apiCreatePayout(newPayout).catch((e) => console.warn('API create payout error', e));

    addToast('Payout Recorded', `Month ${params.monthNumber} payout of ₹${params.amount.toLocaleString('en-IN')} to ${winnerName} saved.`, 'success');
    return newPayout;
  };

  const deletePayout = (chitId: string, monthNumber: number) => {
    const existing = payouts.find((p) => p.chitId === chitId && p.monthNumber === monthNumber);
    setPayouts((prev) => prev.filter((p) => p.chitId !== chitId || p.monthNumber !== monthNumber));
    apiDeletePayout(chitId, monthNumber).catch((e) => console.warn('API delete payout error', e));
    setChits((prev) =>
      prev.map((c) => {
        if (c.id === chitId) {
          const map = { ...(c.monthPayouts || {}) };
          delete map[monthNumber];
          return { ...c, monthPayouts: map };
        }
        return c;
      })
    );
    setTransactions((prev) => prev.filter((t) => t.chitId !== chitId || t.monthNumber !== monthNumber || t.type !== 'Payout'));

    updateAppData((prev) => ({
      ...prev,
      payouts: prev.payouts.filter((p) => p.chitId !== chitId || p.monthNumber !== monthNumber),
      chits: prev.chits.map((c) => {
        if (c.id === chitId) {
          const map = { ...(c.monthPayouts || {}) };
          delete map[monthNumber];
          return { ...c, monthPayouts: map };
        }
        return c;
      }),
      transactions: prev.transactions.filter((t) => t.chitId !== chitId || t.monthNumber !== monthNumber || t.type !== 'Payout'),
    }));

    if (existing) {
      logActivity({
        action: 'DELETE',
        module: 'Payments',
        recordId: existing.id,
        recordName: `Month ${monthNumber} Payout`,
        description: `Cancelled payout record for Month ${monthNumber} (Amount: ₹${existing.amount.toLocaleString('en-IN')})`,
        beforeData: existing,
        status: 'Success',
      });
    }

    addToast('Payout Removed', `Month ${monthNumber} payout record cleared.`, 'info');
  };

  const openReceipt = (txn: PaymentTransaction) => setActiveReceiptModal(txn);
  const closeReceipt = () => setActiveReceiptModal(null);

  const clearAllData = () => {
    setChits([]);
    setMembers([]);
    setTransactions([]);
    setPayouts([]);
    setManualWinnerAssignments({});
    updateAppData((prev) => ({
      ...prev,
      chits: [],
      members: [],
      transactions: [],
      payouts: [],
      manualWinnerAssignments: {},
    }));
    clearAllAuditLogs();
    addToast('Data Cleared', 'All test schemes, members, transactions, and audit logs have been cleared successfully.', 'info');
  };

  return (
    <ChitContext.Provider
      value={{
        currentRole,
        setCurrentRole,
        theme,
        toggleTheme,
        companySettings,
        updateCompanySettings,
        chits,
        addChit,
        updateChit,
        deleteChit,
        assignMembersToChit,
        removeMemberFromChit,
        getChitEnrolledMembers,
        updateMonthStatus,
        assignMemberToMonth,
        removeMemberFromMonth,
        updateMonthDetails,
        manualWinnerAssignments,
        members: calculatedMembers,
        addMember,
        updateMember,
        deleteMember,
        reorderChitMembers,
        getMonthlySchedule,
        recordAuction,
        assignMemberToSlot,
        unassignMemberFromSlot,
        getChitSlots,
        transactions,
        collectPayment,
        updateTransaction,
        deleteTransaction,
        payouts,
        recordPayout,
        deletePayout,
        toasts,
        addToast,
        removeToast,
        activeReceiptModal,
        openReceipt,
        closeReceipt,
        clearAllData,
        syncWithBackend,
        migrateOfflineData,
      }}
    >
      {children}
    </ChitContext.Provider>
  );
};

export const useChit = (): ChitContextType => {
  const ctx = useContext(ChitContext);
  if (!ctx) throw new Error('useChit must be used within a ChitProvider');
  return ctx;
};
