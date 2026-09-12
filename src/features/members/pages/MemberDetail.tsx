import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChit } from '@/shared/context/ChitContext';
import { useAuth, PERMISSIONS } from '@/features/auth';
import { StatCard, StatusBadge, Modal } from '@/shared/components/ui';
import { ArrowLeft, Phone, Mail, MapPin, Layers, CheckCircle2, AlertTriangle, Clock, Eye, Edit } from 'lucide-react';
import { PaymentTransaction, Member } from '@/types';

export const MemberDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { members, chits, transactions, manualWinnerAssignments, getMonthlySchedule, openReceipt, updateMember } = useChit();
  const { hasPermission, isSuperAdmin } = useAuth();
  const canEditPayment = isSuperAdmin() || hasPermission(PERMISSIONS.PAYMENTS_EDIT);

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedSchemeFilter, setSelectedSchemeFilter] = useState('all');

  const member = members.find((m) => m.id === id) || members[0];

  const enrolledChits = useMemo(() => {
    if (!member) return [];
    const idSet = new Set<string>();
    if (member.enrolledChitIds) member.enrolledChitIds.forEach((cId) => idSet.add(cId));
    if (member.chitId) idSet.add(member.chitId);
    chits.forEach((c) => {
      if (c.enrolledMemberIds?.includes(member.id)) idSet.add(c.id);
    });
    return chits.filter((c) => idSet.has(c.id));
  }, [member, chits]);

  const ledgerItems = useMemo(() => {
    if (!member) return [];
    const items: any[] = [];

    enrolledChits.forEach((chit) => {
      const schedule = getMonthlySchedule(chit);
      const duration = chit.durationMonths || schedule.length || 1;

      for (let m = 1; m <= duration; m++) {
        const scheduleItem = schedule.find((s) => s.monthNumber === m);
        const monthLabel = scheduleItem?.monthLabel || `Month ${m}`;
        const dueDate = scheduleItem?.dueDate || '-';
        const monthlyDue = scheduleItem?.netPayable || scheduleItem?.monthlyInstallment || chit.monthlyInstallment || 0;

        const monthTxns = transactions.filter(
          (t) =>
            t.chitId === chit.id &&
            (t.monthNumber === m || t.notes?.includes(`Month ${m}`) || t.monthId === `${chit.id}-M${m}`) &&
            (t.memberId === member.id || t.payerMemberId === member.id) &&
            t.type !== 'Payout' &&
            !t.notes?.toLowerCase().includes('winner payout')
        );

        const amountPaid = monthTxns.reduce((sum, t) => sum + (t.amount || 0), 0);
        const balance = Math.max(0, monthlyDue - amountPaid);
        const latestStatus = monthTxns.length > 0 ? monthTxns[0].status : null;
        let status = 'none';
        if (latestStatus && latestStatus !== 'none') status = latestStatus;
        else if (monthlyDue > 0 && amountPaid >= monthlyDue) status = 'Paid';
        else if (amountPaid > 0) status = 'Partial Paid';

        const sortedTxns = [...monthTxns].sort((a, b) => {
          const tA = new Date(a.paymentDate || a.date || a.createdAt || 0).getTime();
          const tB = new Date(b.paymentDate || b.date || b.createdAt || 0).getTime();
          return tB - tA;
        });

        const latestTxn = sortedTxns.length > 0 ? sortedTxns[0] : null;
        const paymentDate = (latestTxn && (latestTxn.paymentDate || latestTxn.date)) || '-';
        const paymentMode = monthTxns.length > 0 ? Array.from(new Set(monthTxns.map((t) => t.paymentMode).filter(Boolean))).join(', ') || '-' : '-';
        const receiptNo = (latestTxn && latestTxn.receiptNo) || '-';
        const referenceId = (latestTxn && (latestTxn.referenceId || latestTxn.referenceNo)) || '-';

        let paidTo = '-';
        let paidToPhone: string | undefined;

        if (monthTxns.length > 0 && amountPaid > 0) {
          const winnerId = manualWinnerAssignments[chit.id]?.[m];
          const winner = winnerId ? members.find((mem) => mem.id === winnerId) : undefined;
          if (winner) {
            paidTo = winner.name;
            paidToPhone = winner.phone;
          } else {
            paidTo = 'Organizer';
          }
        }

        items.push({
          key: `${chit.id}-M${m}`,
          chitId: chit.id,
          chitName: chit.name,
          monthNumber: m,
          monthLabel,
          dueDate,
          monthlyDue,
          amountPaid,
          balance,
          paidTo,
          paidToPhone,
          paymentDate,
          paymentMode,
          status,
          receiptNo,
          referenceId,
          rawTransaction: latestTxn,
        });
      }
    });

    return items;
  }, [member, enrolledChits, transactions, chits, members, manualWinnerAssignments, getMonthlySchedule]);

  const filteredLedger = useMemo(() => {
    if (selectedSchemeFilter === 'all') return ledgerItems;
    return ledgerItems.filter((item) => item.chitId === selectedSchemeFilter);
  }, [ledgerItems, selectedSchemeFilter]);

  const totalPaid = useMemo(() => ledgerItems.reduce((sum, item) => sum + item.amountPaid, 0), [ledgerItems]);
  const totalPending = useMemo(() => ledgerItems.filter((i) => i.status === 'Pending' || i.status === 'none').reduce((sum, i) => sum + i.balance, 0), [ledgerItems]);
  const totalPartial = useMemo(() => ledgerItems.filter((i) => i.status === 'Partial Paid').reduce((sum, i) => sum + i.balance, 0), [ledgerItems]);

  const handleOpenReceipt = (receiptNo: string, rawTxn?: PaymentTransaction, fallbackItem?: any) => {
    if (rawTxn) {
      openReceipt({
        ...rawTxn,
        monthlyDue: rawTxn.monthlyDue ?? fallbackItem?.monthlyDue ?? 0,
        amount: rawTxn.amount ?? fallbackItem?.amountPaid ?? 0,
        remainingBalance: rawTxn.remainingBalance ?? fallbackItem?.balance ?? 0,
        paidTo: rawTxn.paidTo || (fallbackItem?.paidTo && fallbackItem.paidTo !== '-' ? fallbackItem.paidTo : undefined),
      });
    } else if (fallbackItem) {
      openReceipt({
        id: `REC-GEN-${Date.now()}`,
        receiptNo: receiptNo || 'REC-LEDGER',
        memberId: member.id,
        memberName: member.name,
        chitId: fallbackItem.chitId || member.chitId || '',
        chitName: fallbackItem.chitName || member.chitName || '',
        amount: fallbackItem.amountPaid || 0,
        monthlyDue: fallbackItem.monthlyDue || 0,
        previousPending: 0,
        currentDue: fallbackItem.monthlyDue || 0,
        remainingBalance: fallbackItem.balance || 0,
        paymentMode: fallbackItem.paymentMode || 'Cash',
        date: fallbackItem.paymentDate === '-' ? new Date().toISOString().split('T')[0] : fallbackItem.paymentDate,
        collectedBy: 'Super Admin',
        paidTo: fallbackItem.paidTo && fallbackItem.paidTo !== '-' ? fallbackItem.paidTo : undefined,
        status: fallbackItem.status === 'Paid' ? 'Paid' : 'Partial',
        notes: `Payment receipt generated from ledger for ${fallbackItem.monthLabel}`,
      });
    }
  };

  if (!member) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p>Member not found.</p>
        <button
          onClick={() => navigate('/members')}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold cursor-pointer"
        >
          Return to Members Directory
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/members')}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 mb-2 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Members</span>
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black text-slate-100 tracking-tight">{member.name}</h1>
            <span className="font-mono text-xs font-bold text-blue-400 bg-blue-600/15 border border-blue-500/30 px-3 py-1 rounded-full">
              Member ID: {member.id}
            </span>
            <StatusBadge status={member.status || 'Active'} />
          </div>
          <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
            <span>
              Phone: <strong className="text-slate-200 font-mono">{member.phone}</strong>
            </span>
            <span>•</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-400">Assigned Chits:</span>
              {enrolledChits.length > 0 ? (
                enrolledChits.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/chits/${c.id}`)}
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/25 hover:bg-blue-500/20 hover:border-blue-400 cursor-pointer transition-colors"
                  >
                    {c.name}
                  </button>
                ))
              ) : (
                <span className="text-[11px] text-slate-500 font-mono px-2 py-0.5 rounded bg-[#0B0F17] border border-[#1F293D]">
                  No chits assigned
                </span>
              )}
            </div>
          </div>
        </div>

        {canEditPayment && (
          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              onClick={() => setIsStatusModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500 hover:text-slate-950 font-semibold text-xs transition-all cursor-pointer"
              title="Edit Payment Status"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Edit Payment Status</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Paid"
          value={`₹${totalPaid.toLocaleString('en-IN')}`}
          subtitle="Cleared installment contributions"
          icon={CheckCircle2}
          highlightColor="emerald"
        />
        <StatCard
          title="Total Pending"
          value={`₹${totalPending.toLocaleString('en-IN')}`}
          subtitle={`${ledgerItems.filter((i) => i.status === 'Pending' || i.status === 'none').length} unpaid monthly installments`}
          icon={AlertTriangle}
          highlightColor="rose"
        />
        <StatCard
          title="Total Partial"
          value={`₹${totalPartial.toLocaleString('en-IN')}`}
          subtitle={`${ledgerItems.filter((i) => i.status === 'Partial Paid').length} partially paid dues`}
          icon={Clock}
          highlightColor="amber"
        />
      </div>

      {/* Profile Info */}
      <div className="bg-[#121827] border border-[#1F293D] rounded-2xl p-5 shadow-xl">
        <h3 className="text-sm font-bold text-slate-100 mb-3 pb-2.5 border-b border-[#1F293D] flex items-center justify-between">
          <span>Member Profile & Contact Details</span>
          <span className="text-[11px] font-mono text-slate-400 font-normal">
            Joined {member.joinedDate || 'N/A'}
          </span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 text-xs">
          <div className="flex items-center gap-3 bg-[#0B0F17] p-3 rounded-xl border border-[#1F293D]">
            <Phone className="w-4 h-4 text-blue-400 shrink-0" />
            <div>
              <span className="text-slate-400 block text-[10px]">Phone Number</span>
              <span className="font-mono font-semibold text-slate-200">{member.phone}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-[#0B0F17] p-3 rounded-xl border border-[#1F293D]">
            <Mail className="w-4 h-4 text-blue-400 shrink-0" />
            <div>
              <span className="text-slate-400 block text-[10px]">Email Address</span>
              <span className="font-semibold text-slate-200 truncate max-w-[170px] inline-block">
                {member.email || 'N/A'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-[#0B0F17] p-3 rounded-xl border border-[#1F293D]">
            <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="text-slate-400 block text-[10px]">Residential Address</span>
              <span className="font-semibold text-slate-200 truncate max-w-[170px] inline-block">
                {member.address || 'N/A'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-[#0B0F17] p-3 rounded-xl border border-[#1F293D]">
            <Layers className="w-4 h-4 text-purple-400 shrink-0" />
            <div>
              <span className="text-slate-400 block text-[10px]">Enrolled Schemes</span>
              <span className="font-mono font-bold text-slate-200">
                {enrolledChits.length} {enrolledChits.length === 1 ? 'Scheme' : 'Schemes'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-[#121827] border border-[#1F293D] rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>My Payments</span>
              <span className="text-xs font-normal text-slate-400 font-mono">
                (Enrolled monthly installment ledger)
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Monthly installment dues, payments made, remaining balances, and receipts
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            {enrolledChits.length > 1 && (
              <div className="flex items-center gap-2 text-xs font-sans mr-1">
                <span className="text-slate-400 font-medium">Filter Scheme:</span>
                <select
                  value={selectedSchemeFilter}
                  onChange={(e) => setSelectedSchemeFilter(e.target.value)}
                  className="bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="all">All Schemes ({enrolledChits.length})</option>
                  {enrolledChits.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <span className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 px-2.5 py-1 rounded-lg">
              Paid: ₹{totalPaid.toLocaleString('en-IN')}
            </span>
            <span className="bg-rose-500/10 border border-rose-500/25 text-rose-400 px-2.5 py-1 rounded-lg">
              Due Balance: ₹{(totalPending + totalPartial).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {filteredLedger.length === 0 ? (
          <div className="bg-[#0B0F17] border border-[#1F293D] rounded-xl p-8 text-center text-slate-400">
            <Layers className="w-8 h-8 mx-auto text-slate-600 mb-2" />
            <p className="font-semibold text-slate-300">No installments found for this member.</p>
            <p className="text-xs text-slate-500 mt-1">Ensure this member is enrolled in an active chit scheme.</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar rounded-xl border border-[#1F293D]/70">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#0B0F17] border-b border-[#1F293D] text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3 min-w-[130px]">Chit / Scheme</th>
                  <th className="py-3 px-3 min-w-[120px]">Month</th>
                  <th className="py-3 px-3 text-right min-w-[100px]">Monthly Due</th>
                  <th className="py-3 px-3 text-right min-w-[100px]">Amount Paid</th>
                  <th className="py-3 px-3 min-w-[140px]">Paid To</th>
                  <th className="py-3 px-3 text-right min-w-[90px]">Balance</th>
                  <th className="py-3 px-3 min-w-[110px]">Payment Date</th>
                  <th className="py-3 px-3 min-w-[80px]">Mode</th>
                  <th className="py-3 px-3 text-center min-w-[90px]">Status</th>
                  <th className="py-3 px-3 text-right min-w-[110px]">Receipt / Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F293D]/50">
                {filteredLedger.map((item) => (
                  <tr key={item.key} className="hover:bg-[#182032] transition-colors group">
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-200 block">{item.chitName}</span>
                      <span className="text-[10px] font-mono text-slate-500">{item.chitId}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-200 block">{item.monthLabel}</span>
                      <span className="text-[10px] text-slate-500 font-mono">Due: {item.dueDate}</span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-medium text-slate-300">
                      ₹{item.monthlyDue.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold">
                      {item.amountPaid > 0 ? (
                        <span className="text-emerald-400">₹{item.amountPaid.toLocaleString('en-IN')}</span>
                      ) : (
                        <span className="text-slate-500">₹0</span>
                      )}
                    </td>
                    <td className="py-3 px-3 align-middle">
                      {item.paidTo && item.paidTo !== '-' ? (
                        <div>
                          <div className="font-bold text-white text-xs leading-tight whitespace-nowrap member-name-text">
                            {item.paidTo}
                          </div>
                          {item.paidToPhone && (
                            <div className="text-[11px] font-mono text-slate-400 leading-tight mt-0.5 whitespace-nowrap">
                              {item.paidToPhone}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500 font-mono text-[11px]">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {item.balance > 0 ? (
                        <span className="text-rose-400 font-semibold">₹{item.balance.toLocaleString('en-IN')}</span>
                      ) : (
                        <span className="text-slate-500">₹0</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-300 font-mono text-[11px]">
                      {item.paymentDate === '-' ? <span className="text-slate-600">-</span> : item.paymentDate}
                    </td>
                    <td className="py-3 px-3">
                      {item.paymentMode === '-' ? (
                        <span className="text-slate-600 text-[11px]">-</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-[#1A2338] border border-[#26344E] text-[11px] font-medium text-slate-300">
                          {item.paymentMode}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      {item.receiptNo !== '-' || item.referenceId !== '-' ? (
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <span className="font-mono text-[10px] text-slate-400">
                            {item.receiptNo === '-' ? item.referenceId : item.receiptNo}
                          </span>
                          <button
                            onClick={() => handleOpenReceipt(item.receiptNo, item.rawTransaction, item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/15 transition-colors cursor-pointer"
                            title="View Official Receipt"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-600 font-mono text-[11px]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Payment Status Modal */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title="Edit Payment Status"
        subtitle={`Update payment details for ${member.name} (${member.id})`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const status = (form.elements.namedItem('status') as HTMLSelectElement).value as any;
            const paid = Number((form.elements.namedItem('paid') as HTMLInputElement).value);
            const pending = Number((form.elements.namedItem('pending') as HTMLInputElement).value);
            const notes = (form.elements.namedItem('notes') as HTMLInputElement).value;
            updateMember(member.id, {
              paymentStatus: status,
              totalPaid: paid,
              pendingAmount: pending,
              notes,
            });
            setIsStatusModalOpen(false);
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block text-slate-300 font-medium mb-1">Payment Status</label>
            <select
              name="status"
              defaultValue={member.paymentStatus || 'Pending'}
              className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
              <option value="Pending">Pending</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-300 font-medium mb-1">Total Paid (₹)</label>
            <input
              name="paid"
              type="number"
              defaultValue={member.totalPaid || 0}
              className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-slate-300 font-medium mb-1">Pending Amount (₹)</label>
            <input
              name="pending"
              type="number"
              defaultValue={member.pendingAmount || 0}
              className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-slate-300 font-medium mb-1">Notes</label>
            <input
              name="notes"
              type="text"
              defaultValue={member.notes || ''}
              className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsStatusModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-[#1F293D] text-slate-300 hover:bg-[#2B3952] text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
