import React, { useState } from 'react';
import { useChit } from '@/shared/context/ChitContext';
import { StatCard, StatusBadge } from '@/shared/components/ui';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Coins,
  Users,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  CreditCard,
  Building,
  Smartphone,
  Banknote,
  Receipt,
} from 'lucide-react';

import { isDateInPeriod, DateFilterType } from '@/shared/utils/dateUtils';

export const Dashboard: React.FC = () => {
  const { chits, members, transactions, openReceipt } = useChit();
  const navigate = useNavigate();
  const [activeDateFilter, setActiveDateFilter] = useState<DateFilterType>('This Month');
  const [customFrom, setCustomFrom] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [customTo, setCustomTo] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });

  const dateFilters: DateFilterType[] = ['Today', 'Yesterday', 'This Week', 'This Month', 'Last Month', 'Custom'];

  // Filter transactions based on date filter (exclude Payouts)
  const filteredTransactions = transactions.filter((t) =>
    t.type !== 'Payout' && isDateInPeriod(t.date, activeDateFilter, customFrom, customTo)
  );

  // Dynamic Metrics
  const totalChitsCount = chits.length;
  const activeMembersList = members.filter(
    (m) => m.status === 'Active' && m.isAssigned !== false && m.name !== 'Not Assigned'
  );
  const activeMembersCount = activeMembersList.length;
  const periodCollectionTotal = filteredTransactions.reduce((acc, curr) => acc + curr.amount, 0);

  const cashCollection = filteredTransactions
    .filter((t) => t.paymentMode === 'Cash')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const upiCollection = filteredTransactions
    .filter((t) => t.paymentMode === 'UPI' || t.paymentMode === 'GPay' || t.paymentMode === 'PhonePe')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const bankCollection = filteredTransactions
    .filter((t) => t.paymentMode === 'Bank' || t.paymentMode === 'Bank Transfer' || t.paymentMode === 'Cheque')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const otherCollection = filteredTransactions
    .filter(
      (t) =>
        t.paymentMode !== 'Cash' &&
        t.paymentMode !== 'UPI' &&
        t.paymentMode !== 'GPay' &&
        t.paymentMode !== 'PhonePe' &&
        t.paymentMode !== 'Bank' &&
        t.paymentMode !== 'Bank Transfer' &&
        t.paymentMode !== 'Cheque'
    )
    .reduce((acc, curr) => acc + curr.amount, 0);

  const cashPercent = periodCollectionTotal > 0 ? Math.round((cashCollection / periodCollectionTotal) * 100) : 0;
  const upiPercent = periodCollectionTotal > 0 ? Math.round((upiCollection / periodCollectionTotal) * 100) : 0;
  const bankPercent = periodCollectionTotal > 0 ? Math.round((bankCollection / periodCollectionTotal) * 100) : 0;
  const otherPercent = periodCollectionTotal > 0 ? Math.round((otherCollection / periodCollectionTotal) * 100) : 0;

  // Filter out inactive/soft-deleted and unassigned members from headline pending total
  const totalPendingAmount = activeMembersList.reduce((acc, curr) => acc + (curr.pendingAmount || 0), 0);
  const overdueMembersCount = activeMembersList.filter((m) => m.paymentStatus === 'Overdue').length;
  const partialMembersCount = activeMembersList.filter((m) => m.paymentStatus === 'Partial').length;

  const todayTransactions = transactions.filter((t) => t.type !== 'Payout' && isDateInPeriod(t.date, 'Today'));
  const todayPaidCount = todayTransactions.length;
  // Compute today's due count from active members who currently have outstanding dues/pending payments
  const membersWithDues = activeMembersList.filter(
    (m) => m.pendingAmount > 0 || m.paymentStatus === 'Pending' || m.paymentStatus === 'Overdue' || m.paymentStatus === 'Partial'
  );
  const todayDueCount = membersWithDues.length > 0 ? membersWithDues.length : todayPaidCount;
  const todayPendingCount = membersWithDues.length;
  const todayClearedPercent =
    todayDueCount > 0 ? Math.min(100, Math.round((todayPaidCount / (todayDueCount + todayPaidCount)) * 100)) : (todayPaidCount > 0 ? 100 : 0);
  const recentTransactions = filteredTransactions.slice(0, 8);

  return (
    <div className="space-y-8 animate-fadeIn pb-10">
      {/* Header & Date Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Overview of all chit schemes and collections</p>
        </div>

        {/* Date Filter Pills */}
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#121827] border border-[#1F293D] p-1 rounded-xl overflow-x-auto custom-scrollbar">
            {dateFilters.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveDateFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeDateFilter === filter
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#1C2539]'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {activeDateFilter === 'Custom' && (
            <div className="flex items-center gap-2 bg-[#121827] border border-[#1F293D] p-2 rounded-xl text-xs">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-[#0B0F17] border border-[#1F293D] rounded-lg px-2 py-1 text-slate-200"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-[#0B0F17] border border-[#1F293D] rounded-lg px-2 py-1 text-slate-200"
              />
            </div>
          )}
        </div>
      </div>

      {/* Top Row: KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Chits"
          value={String(totalChitsCount)}
          subtitle="All active & upcoming schemes"
          icon={Coins}
          highlightColor="purple"
        />
        <StatCard
          title="Active Members"
          value={String(activeMembersCount)}
          subtitle="Enrolled members across schemes"
          icon={Users}
          highlightColor="blue"
        />
        <StatCard
          title={`${activeDateFilter} Collection`}
          value={`₹${periodCollectionTotal.toLocaleString('en-IN')}`}
          subtitle={`${filteredTransactions.length} receipts recorded`}
          icon={Wallet}
          highlightColor="emerald"
        />
        <StatCard
          title="Total Pending"
          value={`₹${totalPendingAmount.toLocaleString('en-IN')}`}
          subtitle={`From ${overdueMembersCount} overdue members`}
          icon={AlertTriangle}
          highlightColor="rose"
        />
      </div>

      {/* Second Row: Quick Daily Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#121827] border border-[#1F293D] rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Total Enrolled Members</p>
              <p className="text-lg font-bold text-slate-100">{todayDueCount} Members</p>
            </div>
          </div>
          <span className="text-xs text-slate-500 font-mono">Target: {todayDueCount}</span>
        </div>

        <div className="bg-[#121827] border border-[#1F293D] rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Today's Collections</p>
              <p className="text-lg font-bold text-emerald-400">{todayPaidCount} Receipts</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
            {todayClearedPercent}% Active
          </span>
        </div>

        <div className="bg-[#121827] border border-[#1F293D] rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Pending Payments</p>
              <p className="text-lg font-bold text-rose-400">{todayPendingCount} Members</p>
            </div>
          </div>
          <NavLink
            to="/chits"
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            View Chits <ArrowUpRight className="w-3.5 h-3.5" />
          </NavLink>
        </div>
      </div>

      {/* Two Large Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* COLLECTION SUMMARY */}
        <div className="bg-[#121827] border border-[#1F293D] rounded-2xl p-6 relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#1F293D]">
            <div>
              <h3 className="text-base font-bold text-slate-100 uppercase tracking-wider">
                COLLECTION SUMMARY ({activeDateFilter.toUpperCase()})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Breakdown by payment channel</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Total Collection</span>
              <p className="text-2xl font-black text-emerald-400 font-mono mt-0.5">
                ₹{periodCollectionTotal.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <div className={`grid grid-cols-1 ${otherCollection > 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3 sm:gap-4`}>
            <div className="bg-[#0B0F17] border border-[#1F293D] p-4 rounded-xl">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Banknote className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-medium">By Cash</span>
              </div>
              <p className="text-lg font-bold text-slate-100 font-mono">₹{cashCollection.toLocaleString('en-IN')}</p>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-amber-400 h-full rounded-full" style={{ width: `${cashPercent}%` }} />
              </div>
            </div>

            <div className="bg-[#0B0F17] border border-[#1F293D] p-4 rounded-xl">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Smartphone className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-medium">By UPI / Apps</span>
              </div>
              <p className="text-lg font-bold text-slate-100 font-mono">₹{upiCollection.toLocaleString('en-IN')}</p>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${upiPercent}%` }} />
              </div>
            </div>

            <div className="bg-[#0B0F17] border border-[#1F293D] p-4 rounded-xl">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Building className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-medium">By Bank / Transfer / Cheque</span>
              </div>
              <p className="text-lg font-bold text-slate-100 font-mono">₹{bankCollection.toLocaleString('en-IN')}</p>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-blue-400 h-full rounded-full" style={{ width: `${bankPercent}%` }} />
              </div>
            </div>

            {otherCollection > 0 && (
              <div className="bg-[#0B0F17] border border-[#1F293D] p-4 rounded-xl">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <CreditCard className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-medium">By Other</span>
                </div>
                <p className="text-lg font-bold text-slate-100 font-mono">₹{otherCollection.toLocaleString('en-IN')}</p>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div className="bg-purple-400 h-full rounded-full" style={{ width: `${otherPercent}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PENDING SUMMARY */}
        <div className="bg-[#121827] border border-[#1F293D] rounded-2xl p-6 relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#1F293D]">
            <div>
              <h3 className="text-base font-bold text-slate-100 uppercase tracking-wider">
                PENDING SUMMARY
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Overdue & partial installments</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Total Pending</span>
              <p className="text-2xl font-black text-rose-400 font-mono mt-0.5">
                ₹{totalPendingAmount.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-[#0B0F17] border border-[#1F293D] p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Overdue Members</p>
                <p className="text-2xl font-bold text-rose-400 mt-1">{overdueMembersCount}</p>
                <p className="text-[11px] text-slate-500 mt-1">Older than grace period</p>
              </div>
              <div className="p-3 rounded-lg bg-rose-500/10 text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-[#0B0F17] border border-[#1F293D] p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Partial Payments</p>
                <p className="text-2xl font-bold text-amber-400 mt-1">{partialMembersCount}</p>
                <p className="text-[11px] text-slate-500 mt-1">Partially paid dues</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400">
                <Clock className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Recent Collections Table Container */}
      <div className="bg-[#121827] border border-[#1F293D] rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100">Recent Collections</h3>
            <p className="text-xs text-slate-400">Latest installment payments recorded</p>
          </div>
          <NavLink
            to="/chits"
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            View Chits <ArrowUpRight className="w-3.5 h-3.5" />
          </NavLink>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1F293D] text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3">Receipt No</th>
                <th className="py-3 px-3">Member</th>
                <th className="py-3 px-3">Chit</th>
                <th className="py-3 px-3">Amount</th>
                <th className="py-3 px-3">Payment Mode</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F293D]/50 text-xs">
              {recentTransactions.map((txn) => (
                <tr key={txn.id} className="hover:bg-[#182032] transition-colors">
                  <td className="py-3.5 px-3 font-mono text-blue-300 font-medium">
                    {txn.receiptNo}
                  </td>
                  <td className="py-3.5 px-3 font-semibold text-slate-200">{txn.memberName}</td>
                  <td className="py-3.5 px-3 text-slate-400">{txn.chitName}</td>
                  <td className="py-3.5 px-3 font-mono font-bold text-emerald-400">
                    ₹{txn.amount.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 px-3 text-slate-300">
                    <span className="px-2 py-0.5 rounded bg-[#1A2338] border border-[#26344E] text-[11px]">
                      {txn.paymentMode}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-slate-400">{txn.date}</td>
                  <td className="py-3.5 px-3">
                    <StatusBadge status={txn.status || 'Pending'} />
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <button
                      onClick={() => openReceipt(txn)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                      title="View Receipt"
                    >
                      <Receipt className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
