import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChit } from '@/shared/context/ChitContext';
import { useAuth, PERMISSIONS } from '@/features/auth';
import { StatCard, StatusBadge, Modal } from '@/shared/components/ui';
import { SearchableMemberSelect } from '../components/SearchableMemberSelect';
import {
  ChitScheme,
  MonthlyScheduleItem,
  Member,
  PaymentMode,
  PaymentTransaction,
  MonthStatus,
  MonthCustomDetails,
} from '@/types';
import { getAppData, compressReceiptImage } from '@/shared/utils/storage';
import {
  ArrowLeft,
  Edit,
  UserPlus,
  UserCheck,
  UserMinus,
  User,
  Coins,
  Users,
  Calendar,
  Wallet,
  AlertTriangle,
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  ExternalLink,
  Receipt,
  CreditCard,
  Eye,
  Award,
  Check,
  Plus,
  Upload,
  X,
  Download,
} from 'lucide-react';

export const ChitDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission, isSuperAdmin } = useAuth();

  const canEditChit = isSuperAdmin() || hasPermission(PERMISSIONS.CHITS_EDIT);
  const canDeleteChit = isSuperAdmin() || hasPermission(PERMISSIONS.CHITS_DELETE);
  const canCreatePayment = isSuperAdmin() || hasPermission(PERMISSIONS.PAYMENTS_CREATE);
  const canEditPayment = isSuperAdmin() || hasPermission(PERMISSIONS.PAYMENTS_EDIT);

  const {
    chits,
    members,
    updateChit,
    deleteChit,
    assignMembersToChit,
    assignMemberToMonth,
    removeMemberFromMonth,
    updateMonthDetails,
    addMember,
    getMonthlySchedule,
    transactions,
    collectPayment,
    updateTransaction,
    deleteTransaction,
    recordPayout,
  } = useChit();

  let scheme = chits.find((c) => c.id === id);
  if (!scheme) {
    const appData = getAppData();
    scheme = appData.chits.find((c) => c.id === id);
  }

  // Monthly Period Search & Filters
  const [monthSearchQuery, setMonthSearchQuery] = useState('');
  const [monthStatusFilter, setMonthStatusFilter] = useState('All');
  const [isDeleteChitModalOpen, setIsDeleteChitModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);

  // Assign Member to Month state
  const [assignMonthNumber, setAssignMonthNumber] = useState<number | null>(null);
  const [assignMemberSearch, setAssignMemberSearch] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Member Month Details Modal State
  const [selectedMemberMonthDetails, setSelectedMemberMonthDetails] = useState<{
    monthItem: MonthlyScheduleItem;
    member: Member;
  } | null>(null);

  // Edit Month Modal State
  const [editingMonthItem, setEditingMonthItem] = useState<MonthlyScheduleItem | null>(null);
  const [editMonthForm, setEditMonthForm] = useState({
    grossInstallment: 0,
    dividendAmount: 0,
    netPayable: 0,
    totalCollection: 0,
    chitValue: 0,
  });
  const [editMonthError, setEditMonthError] = useState('');

  const [newMemberForm, setNewMemberForm] = useState({ name: '', phone: '', email: '', address: '' });

  // Edit / Configure Scheme Form
  const [editData, setEditData] = useState({
    name: scheme?.name || '',
    chitAmount: scheme?.chitAmount || 0,
    durationMonths: scheme?.durationMonths || 20,
    monthlyInstallment: scheme?.monthlyInstallment || 5000,
    installmentType: scheme?.installmentType || 'Fixed',
    commissionPercentage: scheme?.commissionPercentage !== undefined ? scheme.commissionPercentage : 5,
    lateFeeAmount: (scheme as any)?.lateFeeAmount !== undefined ? (scheme as any).lateFeeAmount : 200,
    startDate: scheme?.startDate || new Date().toISOString().split('T')[0],
    endDate: scheme?.endDate || '2027-12-31',
    status: scheme?.status || 'Active',
    description: scheme?.description || '',
  });

  React.useEffect(() => {
    if (isEditModalOpen && scheme) {
      setEditData({
        name: scheme.name,
        chitAmount: scheme.chitAmount,
        durationMonths: scheme.durationMonths || 20,
        monthlyInstallment: scheme.monthlyInstallment || (scheme.durationMonths ? Math.round(scheme.chitAmount / scheme.durationMonths) : 5000),
        installmentType: scheme.installmentType || 'Fixed',
        commissionPercentage: scheme.commissionPercentage !== undefined ? scheme.commissionPercentage : 5,
        lateFeeAmount: (scheme as any)?.lateFeeAmount !== undefined ? (scheme as any).lateFeeAmount : 200,
        startDate: scheme.startDate || new Date().toISOString().split('T')[0],
        endDate: scheme.endDate || '2027-12-31',
        status: scheme.status || 'Active',
        description: scheme.description || '',
      });
    }
  }, [isEditModalOpen, scheme?.id]);

  // Dedicated Month Payment Entry Modal State (Chit Calculation Sheet Table)
  const [paymentEntryModalItem, setPaymentEntryModalItem] = useState<MonthlyScheduleItem | null>(null);

  // Active Member Payment Entry / Edit Sub-Modal State
  const [activePaymentMemberData, setActivePaymentMemberData] = useState<{
    member: Member;
    due: number;
    existingTxn?: PaymentTransaction;
  } | null>(null);

  // Read-Only Payment Details Modal State (When clicking "Details" on Paid member)
  const [activePaymentDetails, setActivePaymentDetails] = useState<{
    member: Member;
    due: number;
    totalPaid: number;
    transaction?: PaymentTransaction;
  } | null>(null);

  // Member Payment Form State
  const [paymentEntryForm, setPaymentEntryForm] = useState<{
    amount: number | '';
    status: 'Pending' | 'Partial Paid' | 'Paid' | '';
    paidToType: 'ORGANIZER' | 'WINNER';
    paymentMode: PaymentMode;
    paymentDate: string;
    referenceId: string;
    receiptUrl: string;
    notes: string;
  }>({
    amount: 0,
    status: '',
    paidToType: 'ORGANIZER',
    paymentMode: 'UPI',
    paymentDate: new Date().toISOString().split('T')[0],
    referenceId: '',
    receiptUrl: '',
    notes: '',
  });
  const [paymentEntryError, setPaymentEntryError] = useState('');

  // Winner Payout Sub-Form State
  const [isWinnerPayoutFormOpen, setIsWinnerPayoutFormOpen] = useState(false);
  const [winnerPayoutForm, setWinnerPayoutForm] = useState<{
    amount: number;
    paymentMode: PaymentMode;
    paymentDate: string;
    referenceId: string;
    receiptUrl: string;
    notes: string;
  }>({
    amount: 0,
    paymentMode: 'UPI',
    paymentDate: new Date().toISOString().split('T')[0],
    referenceId: '',
    receiptUrl: '',
    notes: '',
  });
  const [winnerPayoutError, setWinnerPayoutError] = useState('');

  // Screenshot / Receipt Lightbox Modal State
  const [receiptPreview, setReceiptPreview] = useState<{ url: string; title: string } | null>(null);

  const handleReceiptUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedUrl = await compressReceiptImage(file, 1000, 1000, 0.7);
      setter(compressedUrl);
    } catch (err: any) {
      alert(err.message || 'Failed to process receipt image. Please choose another file.');
    }
  };

  if (!scheme) {
    return (
      <div className="p-8 text-center text-slate-400">
        <h2 className="text-xl font-bold text-slate-200">Scheme Not Found</h2>
        <p className="mt-2 text-sm">The requested chit scheme does not exist or has been deleted.</p>
        <button onClick={() => navigate('/chits')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold">
          Back to Chits
        </button>
      </div>
    );
  }

  // Month-by-Month Schedule derived from duration
  const monthlySchedule = getMonthlySchedule(scheme);

  const filteredMonthlySchedule = monthlySchedule.filter((item) => {
    const q = monthSearchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      item.monthLabel.toLowerCase().includes(q) ||
      `month ${item.monthNumber}`.includes(q) ||
      (item.assignedMembers && item.assignedMembers.some((m) => m.name.toLowerCase().includes(q) || m.phone.includes(q))) ||
      (item.assignedMemberName && item.assignedMemberName.toLowerCase().includes(q));
    const matchesStatus = monthStatusFilter === 'All' || item.status === monthStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const assignedCount = Object.values(scheme.monthMemberAssignments || {}).filter((val) =>
    Array.isArray(val) ? val.length > 0 : Boolean(val)
  ).length;

  const schemeEnrolledMembers = (scheme.enrolledMemberIds && scheme.enrolledMemberIds.length > 0)
    ? members.filter((m) => scheme.enrolledMemberIds?.includes(m.id))
    : members.filter((m) => m.chitId === scheme?.id || m.enrolledChitIds?.includes(scheme?.id || '') || (m.status === 'Active' && m.name !== 'Not Assigned'));

  // Inline Spreadsheet Cell Editing Handler
  const handleInlineCellChange = (
    monthNumber: number,
    field: 'monthlyPayment' | 'bidAmount' | 'dividendAmount',
    val: number
  ) => {
    if (!scheme) return;
    const numVal = isNaN(val) ? 0 : Math.max(0, val);
    const existingOv = scheme.monthOverrides?.[monthNumber] || {};
    const updatedOv: MonthCustomDetails = {
      ...existingOv,
      [field]: numVal,
    };

    if (field === 'bidAmount') {
      const baseMonthly =
        scheme.baseMonthlyAmount && scheme.baseMonthlyAmount > 0
          ? scheme.baseMonthlyAmount
          : (scheme.monthlyInstallment && scheme.monthlyInstallment > 0
              ? scheme.monthlyInstallment
              : (scheme.memberCount ? Math.round(scheme.chitAmount / scheme.memberCount) : 25000));
      const newPayment = Math.max(0, baseMonthly - numVal);
      if (updatedOv.monthlyPayment === undefined) {
        updatedOv.monthlyPayment = newPayment;
        updatedOv.netPayable = newPayment;
      }
      if (updatedOv.dividendAmount === undefined) {
        const mCount = scheme.memberCount || 20;
        updatedOv.dividendAmount = Math.round((numVal / mCount) * 100) / 100;
      }
      if (updatedOv.netChitAmount === undefined) {
        updatedOv.netChitAmount = Math.max(0, scheme.chitAmount - numVal);
      }
    } else if (field === 'monthlyPayment') {
      updatedOv.netPayable = numVal;
    }

    updateMonthDetails(scheme.id, monthNumber, updatedOv);
  };

  // Inline Spreadsheet Member Assignment Handler
  const handleInlineMemberAssign = (monthNumber: number, memberId: string) => {
    if (!scheme) return;
    if (memberId) {
      assignMemberToMonth(scheme.id, monthNumber, [memberId]);
      if (!scheme.enrolledMemberIds?.includes(memberId)) {
        assignMembersToChit(scheme.id, [memberId]);
      }
    } else {
      assignMemberToMonth(scheme.id, monthNumber, []);
    }
  };

  const handleOpenPaymentEntryModal = (item: MonthlyScheduleItem) => {
    setPaymentEntryModalItem(item);
    setActivePaymentMemberData(null);
    setActivePaymentDetails(null);
    const payoutAmt = item.netChitAmount || item.chitValue || (scheme ? Math.max(0, scheme.chitAmount - (item.bidAmount || 0)) : 0);
    const existingPayoutTxn = transactions.find(
      (t) => t.chitId === scheme?.id && t.monthNumber === item.monthNumber && t.type === 'Payout'
    );

    setWinnerPayoutForm({
      amount: existingPayoutTxn ? existingPayoutTxn.amount : (item.payoutAmount || payoutAmt),
      paymentMode: existingPayoutTxn ? existingPayoutTxn.paymentMode : (item.payoutMode || 'UPI'),
      paymentDate: existingPayoutTxn ? (existingPayoutTxn.paymentDate || existingPayoutTxn.date) : (item.payoutDate || new Date().toISOString().split('T')[0]),
      referenceId: existingPayoutTxn ? (existingPayoutTxn.referenceId || existingPayoutTxn.referenceNo || '') : (item.payoutReferenceNo || ''),
      receiptUrl: existingPayoutTxn ? (existingPayoutTxn.receiptUrl || '') : '',
      notes: existingPayoutTxn ? (existingPayoutTxn.notes || '') : (item.payoutNotes || ''),
    });
    setWinnerPayoutError('');
    setIsWinnerPayoutFormOpen(false);
  };

  const handleOpenPaymentFormForMember = (m: Member, dueAmt: number, existingTxn?: PaymentTransaction) => {
    setActivePaymentMemberData({
      member: m,
      due: dueAmt,
      existingTxn,
    });

    const isWinnerPaidTo = existingTxn?.paidToType === 'WINNER' ||
      (existingTxn?.paidTo && !existingTxn.paidTo.toLowerCase().includes('organizer'));

    let initialStatus: 'Pending' | 'Partial Paid' | 'Paid' | '' = '';
    if (existingTxn && existingTxn.status) {
      if (existingTxn.status === 'Paid') {
        initialStatus = 'Paid';
      } else if (existingTxn.status === 'Partial Paid' || existingTxn.status === 'Partial') {
        initialStatus = 'Partial Paid';
      } else if (existingTxn.status === 'Pending') {
        initialStatus = 'Pending';
      } else {
        initialStatus = '';
      }
    } else {
      initialStatus = '';
    }

    setPaymentEntryForm({
      amount: existingTxn ? (existingTxn.amount !== undefined ? existingTxn.amount : dueAmt) : dueAmt,
      status: initialStatus,
      paidToType: isWinnerPaidTo ? 'WINNER' : 'ORGANIZER',
      paymentMode: (existingTxn?.paymentMode as PaymentMode) || 'UPI',
      paymentDate: existingTxn?.paymentDate || existingTxn?.date || new Date().toISOString().split('T')[0],
      referenceId: existingTxn?.referenceId || existingTxn?.referenceNo || '',
      receiptUrl: existingTxn?.receiptUrl || '',
      notes: existingTxn?.notes || '',
    });
    setPaymentEntryError('');
  };

  const handlePaymentEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentEntryModalItem || !scheme || !activePaymentMemberData) return;

    const { member, due, existingTxn } = activePaymentMemberData;
    const mNum = paymentEntryModalItem.monthNumber;
    const enteredAmount = Number(paymentEntryForm.amount);

    if (isNaN(enteredAmount) || enteredAmount < 0) {
      setPaymentEntryError('Please enter a valid payment amount.');
      return;
    }

    // Do not allow Paid status when amount is greater than monthly due
    if (enteredAmount > due) {
      setPaymentEntryError(`Amount cannot exceed the monthly due of ₹${due.toLocaleString('en-IN')}.`);
      return;
    }

    const rawWinnerAssignment = scheme.monthMemberAssignments?.[mNum];
    const assignmentFromMap = Array.isArray(rawWinnerAssignment) ? rawWinnerAssignment[0] : (rawWinnerAssignment || '');
    const assignedWinnerId = paymentEntryModalItem.assignedMemberIds?.[0] || paymentEntryModalItem.assignedMemberId || assignmentFromMap || '';
    const winnerMember = members.find((m) => m.id === assignedWinnerId);
    const winnerName = winnerMember ? winnerMember.name : (paymentEntryModalItem.assignedMemberName || '');

    if (paymentEntryForm.paidToType === 'WINNER' && !winnerName && !assignedWinnerId) {
      setPaymentEntryError('No winner has been assigned for this month in the Chit Calculation Sheet yet.');
      return;
    }

    const finalPaidTo = paymentEntryForm.paidToType === 'WINNER'
      ? (winnerName || 'Month Winner')
      : 'Chit Organizer';
    const finalReceiverName = finalPaidTo;
    const finalPaidToMemberId = paymentEntryForm.paidToType === 'WINNER' ? (assignedWinnerId || null) : null;
    const selectedStatus = paymentEntryForm.status ? paymentEntryForm.status : null;

    if (existingTxn) {
      updateTransaction(existingTxn.id, {
        amount: enteredAmount,
        paidAmount: enteredAmount,
        paidTo: finalPaidTo,
        paidToType: paymentEntryForm.paidToType,
        paidToMemberId: finalPaidToMemberId,
        receiverName: finalReceiverName,
        paymentMode: paymentEntryForm.paymentMode,
        date: paymentEntryForm.paymentDate,
        paymentDate: paymentEntryForm.paymentDate,
        referenceNo: paymentEntryForm.referenceId,
        referenceId: paymentEntryForm.referenceId,
        receiptUrl: paymentEntryForm.receiptUrl,
        notes: paymentEntryForm.notes,
        status: selectedStatus,
      });
    } else {
      collectPayment({
        chitId: scheme.id,
        monthNumber: mNum,
        monthId: `${scheme.id}-M${mNum}`,
        memberId: member.id,
        payerMemberId: member.id,
        memberName: member.name,
        memberPhone: member.phone,
        amount: enteredAmount,
        dueAmount: due,
        paidTo: finalPaidTo,
        paidToType: paymentEntryForm.paidToType,
        paidToMemberId: finalPaidToMemberId,
        receiverName: finalReceiverName,
        paymentMode: paymentEntryForm.paymentMode,
        date: paymentEntryForm.paymentDate,
        referenceNo: paymentEntryForm.referenceId,
        referenceId: paymentEntryForm.referenceId,
        receiptUrl: paymentEntryForm.receiptUrl,
        notes: paymentEntryForm.notes,
        status: selectedStatus,
        createdAt: new Date().toISOString(),
      });
    }

    setActivePaymentMemberData(null);
  };

  const handleWinnerPayoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentEntryModalItem || !scheme) return;

    const mNum = paymentEntryModalItem.monthNumber;
    const rawWinnerAssignment = scheme.monthMemberAssignments?.[mNum];
    const assignmentFromMap = Array.isArray(rawWinnerAssignment) ? rawWinnerAssignment[0] : (rawWinnerAssignment || '');
    const assignedWinnerId = paymentEntryModalItem.assignedMemberIds?.[0] || paymentEntryModalItem.assignedMemberId || assignmentFromMap || '';
    const winnerMember = members.find((m) => m.id === assignedWinnerId);
    const winnerName = winnerMember ? winnerMember.name : (paymentEntryModalItem.assignedMemberName || '');

    if (!winnerName && !assignedWinnerId) {
      setWinnerPayoutError('Please assign a member to this month in the Chit Calculation Sheet before recording winner payout.');
      return;
    }

    const enteredAmount = Number(winnerPayoutForm.amount);
    if (isNaN(enteredAmount) || enteredAmount <= 0) {
      setWinnerPayoutError('Payout amount must be greater than zero.');
      return;
    }

    updateMonthDetails(scheme.id, mNum, {
      payoutMemberId: winnerMember?.id || assignedWinnerId,
      payoutMemberName: winnerName,
      payoutMemberPhone: winnerMember?.phone,
      payoutAmount: enteredAmount,
      payoutDate: winnerPayoutForm.paymentDate,
      payoutMode: winnerPayoutForm.paymentMode,
      payoutStatus: 'Paid',
      payoutReferenceNo: winnerPayoutForm.referenceId,
      payoutNotes: winnerPayoutForm.notes,
    } as any);

    const existingPayoutTxn = transactions.find(
      (t) => t.chitId === scheme.id && t.monthNumber === mNum && t.type === 'Payout'
    );

    if (existingPayoutTxn) {
      updateTransaction(existingPayoutTxn.id, {
        amount: enteredAmount,
        paymentMode: winnerPayoutForm.paymentMode,
        date: winnerPayoutForm.paymentDate,
        paymentDate: winnerPayoutForm.paymentDate,
        referenceNo: winnerPayoutForm.referenceId,
        referenceId: winnerPayoutForm.referenceId,
        receiptUrl: winnerPayoutForm.receiptUrl,
        notes: winnerPayoutForm.notes,
      });
    } else {
      recordPayout({
        chitId: scheme.id,
        monthNumber: mNum,
        memberId: winnerMember?.id || assignedWinnerId || 'WINNER',
        memberName: winnerName || 'Month Winner',
        memberPhone: winnerMember?.phone || '',
        amount: enteredAmount,
        paymentDate: winnerPayoutForm.paymentDate,
        paymentMode: winnerPayoutForm.paymentMode,
        referenceNo: winnerPayoutForm.referenceId,
        referenceId: winnerPayoutForm.referenceId,
        receiptUrl: winnerPayoutForm.receiptUrl,
        notes: `Winner Payout for Month ${mNum}: ${winnerPayoutForm.notes}`,
        status: 'Paid',
      });
    }

    setIsWinnerPayoutFormOpen(false);
  };

  const handleDeleteWinnerPayout = (mNum: number) => {
    if (!scheme) return;
    if (confirm(`Reset Winner Payout for Month ${mNum} to Pending?`)) {
      updateMonthDetails(scheme.id, mNum, {
        payoutStatus: 'Pending',
        payoutAmount: 0,
        payoutDate: undefined,
        payoutReferenceNo: undefined,
        payoutNotes: undefined,
      } as any);
      const payoutTxn = transactions.find(
        (t) => t.chitId === scheme.id && t.monthNumber === mNum && t.type === 'Payout'
      );
      if (payoutTxn) {
        deleteTransaction(payoutTxn.id);
      }
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editData.name || editData.durationMonths < 1) return;
    updateChit(scheme.id, {
      ...editData,
      isConfigured: true,
    });
    setIsEditModalOpen(false);
  };

  const handleAddMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberForm.name || !newMemberForm.phone) return;
    addMember({
      name: newMemberForm.name,
      phone: newMemberForm.phone,
      email: newMemberForm.email,
      address: newMemberForm.address,
      chitId: scheme.id,
      chitName: scheme.name,
      monthlyDue: scheme.monthlyInstallment,
      status: 'Active',
      joinedDate: new Date().toISOString().split('T')[0],
      enrolledChitIds: [scheme.id],
    });
    setNewMemberForm({ name: '', phone: '', email: '', address: '' });
    setIsAddMemberModalOpen(false);
  };

  const handleSaveAssignMember = () => {
    if (assignMonthNumber !== null) {
      assignMemberToMonth(scheme.id, assignMonthNumber, selectedMemberIds);
      setAssignMonthNumber(null);
      setSelectedMemberIds([]);
      setAssignMemberSearch('');
    }
  };

  const handleOpenEditMonth = (item: MonthlyScheduleItem) => {
    setEditingMonthItem(item);
    setEditMonthForm({
      grossInstallment: item.grossInstallment,
      dividendAmount: item.dividendAmount,
      netPayable: item.netPayable,
      totalCollection: item.totalCollection,
      chitValue: item.chitValue,
    });
    setEditMonthError('');
  };

  const handleSaveEditMonth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMonthItem) return;

    if (
      editMonthForm.grossInstallment < 0 ||
      editMonthForm.dividendAmount < 0 ||
      editMonthForm.netPayable < 0 ||
      editMonthForm.totalCollection < 0 ||
      editMonthForm.chitValue < 0
    ) {
      setEditMonthError('All values must be valid non-negative numbers.');
      return;
    }

    updateMonthDetails(scheme.id, editingMonthItem.monthNumber, editMonthForm);
    setEditingMonthItem(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-10 w-full">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/chits')}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Chits
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-100 tracking-tight">{scheme.name}</h1>
            <StatusBadge status={scheme.status} size="md" />
            <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-blue-600/20 text-blue-300 border border-blue-500/30">
              {scheme.durationMonths} Months Scheme
            </span>
          </div>
          {scheme.description && <p className="text-xs text-slate-400 mt-1">{scheme.description}</p>}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {canEditChit && (
            <button
              type="button"
              onClick={() => setIsAddMemberModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" /> Enroll Member
            </button>
          )}
          {canEditChit && (!scheme.durationMonths || scheme.durationMonths === 0 || !scheme.isConfigured) && (
            <button
              type="button"
              id="configure-chit-btn"
              onClick={() => setIsEditModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/30 transition-all"
            >
              <Coins className="w-4 h-4" /> Configure Scheme
            </button>
          )}
          {canEditChit && (
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#121827] border border-[#1F293D] hover:border-slate-500 text-slate-200 text-xs font-semibold transition-all"
            >
              <Edit className="w-3.5 h-3.5 text-slate-400" /> Edit Scheme
            </button>
          )}
          {canDeleteChit && (
            <button
              type="button"
              onClick={() => setIsDeleteChitModalOpen(true)}
              className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 text-xs transition-colors"
              title="Delete Scheme"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Pool Value"
          value={`₹${scheme.chitAmount.toLocaleString('en-IN')}`}
          subtitle={`${scheme.durationMonths} Months Duration`}
          icon={Coins}
          highlightColor="blue"
        />
        <StatCard
          title="Base Monthly Payment"
          value={`₹${(scheme.monthlyInstallment || 0).toLocaleString('en-IN')}`}
          subtitle="Fixed or Variable"
          icon={Wallet}
          highlightColor="emerald"
        />
        <StatCard
          title="Total Scheme Months"
          value={`${monthlySchedule.length} Months`}
          subtitle="Full tenure mapped"
          icon={Calendar}
          highlightColor="purple"
        />
        <StatCard
          title="Assigned Month Members"
          value={`${assignedCount} / ${scheme.durationMonths}`}
          subtitle="Months with assigned members"
          icon={Users}
          highlightColor="amber"
        />
      </div>

      {/* Chit Calculation Sheet Table Section */}
      <div id="monthly-schedule-section" className="bg-[#121827] border border-[#1F293D] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" /> Chit Calculation Sheet ({monthlySchedule.length} Months)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live calculation metrics, assigned payout members, and direct Payment Entry for Month 1 to Month {scheme.durationMonths}
            </p>
          </div>
        </div>

        {/* Monthly Period Filter & Search Bar */}
        <div id="monthly-filter-bar" className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#0B0F17] border border-[#1F293D] p-3 rounded-xl">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search month or member name..."
              value={monthSearchQuery}
              onChange={(e) => setMonthSearchQuery(e.target.value)}
              className="w-full bg-[#121827] border border-[#1F293D] rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="flex items-center gap-1 bg-[#121827] border border-[#1F293D] p-1 rounded-lg w-full sm:w-auto overflow-x-auto">
              {['All', 'Active', 'Completed'].map((st) => (
                <button
                  key={st}
                  onClick={() => setMonthStatusFilter(st)}
                  className={`px-3 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${
                    monthStatusFilter === st
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chit Calculation Sheet Table */}
        {filteredMonthlySchedule.length > 0 ? (
          <div className="overflow-x-auto custom-scrollbar border border-[#1F293D] rounded-xl shadow-lg">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#0B0F17] text-[11px] font-bold text-slate-300 uppercase font-mono tracking-wider border-b border-[#1F293D] sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-3 w-14 text-center border-r border-[#1F293D]/60">S.No</th>
                  <th className="py-3 px-3 w-28 border-r border-[#1F293D]/60">Month</th>
                  <th className="py-3 px-3 text-right border-r border-[#1F293D]/60 min-w-[140px]">Monthly Payment</th>
                  <th className="py-3 px-3 text-right border-r border-[#1F293D]/60 min-w-[130px]">Bid Amount</th>
                  <th className="py-3 px-3 text-right border-r border-[#1F293D]/60 min-w-[130px]">Dividend Amount</th>
                  <th className="py-3 px-3 text-right border-r border-[#1F293D]/60 min-w-[140px]">Net Chit Amount</th>
                  <th className="py-3 px-4 min-w-[220px] border-r border-[#1F293D]/60">Assigned Member</th>
                  <th className="py-3 px-4 min-w-[190px]">Payment Entry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F293D]/70 font-mono text-xs">
                {filteredMonthlySchedule.map((item, rowIdx) => {
                  const assignedId = item.assignedMemberIds?.[0] || item.assignedMemberId || scheme.monthMemberAssignments?.[item.monthNumber] || '';
                  const activeMembers = members.filter((m) => m.status === 'Active' && m.name !== 'Not Assigned');
                  const monthTxns = transactions.filter(
                    (t) => t.chitId === scheme.id && t.monthNumber === item.monthNumber && t.type !== 'Payout'
                  );
                  const monthCollected = monthTxns.reduce((sum, t) => sum + t.amount, 0);
                  const paidMemberIds = new Set(monthTxns.filter((t) => t.amount > 0).map((t) => t.memberId));
                  const paidMembersCount = paidMemberIds.size;
                  const totalChitMembersCount = schemeEnrolledMembers.length > 0 ? schemeEnrolledMembers.length : (scheme.memberCount || scheme.membersCount || 20);

                  return (
                    <tr
                      key={`sheet-row-${item.monthNumber}`}
                      className="hover:bg-[#151D2F] transition-colors group"
                    >
                      {/* S.No */}
                      <td className="py-2.5 px-3 text-center border-r border-[#1F293D]/60 text-slate-400 font-mono text-xs">
                        {item.monthNumber}
                      </td>

                      {/* Month */}
                      <td className="py-2.5 px-3 border-r border-[#1F293D]/60 font-mono font-bold text-slate-200 text-xs whitespace-nowrap">
                        Month {item.monthNumber}
                      </td>

                      {/* Monthly Payment (Editable Cell) */}
                      <td className="py-1 px-2 text-right border-r border-[#1F293D]/60 font-mono">
                        <div className="flex items-center justify-end">
                          <span className="text-slate-500 mr-1 text-xs">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={item.monthlyPayment}
                            onChange={(e) =>
                              handleInlineCellChange(item.monthNumber, 'monthlyPayment', Number(e.target.value))
                            }
                            className="w-24 bg-transparent hover:bg-[#0B0F17] focus:bg-[#0B0F17] border border-transparent hover:border-[#1F293D] focus:border-blue-500 rounded px-1.5 py-1 text-right text-emerald-400 font-bold focus:outline-none transition-colors"
                          />
                        </div>
                      </td>

                      {/* Bid Amount (Editable Cell) */}
                      <td className="py-1 px-2 text-right border-r border-[#1F293D]/60 font-mono">
                        <div className="flex items-center justify-end">
                          <span className="text-slate-500 mr-1 text-xs">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={item.bidAmount || 0}
                            onChange={(e) =>
                              handleInlineCellChange(item.monthNumber, 'bidAmount', Number(e.target.value))
                            }
                            className="w-24 bg-transparent hover:bg-[#0B0F17] focus:bg-[#0B0F17] border border-transparent hover:border-[#1F293D] focus:border-blue-500 rounded px-1.5 py-1 text-right text-amber-400 font-semibold focus:outline-none transition-colors"
                          />
                        </div>
                      </td>

                      {/* Dividend Amount (Editable Cell) */}
                      <td className="py-1 px-2 text-right border-r border-[#1F293D]/60 font-mono">
                        <div className="flex items-center justify-end">
                          <span className="text-slate-500 mr-1 text-xs">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.dividendAmount || 0}
                            onChange={(e) =>
                              handleInlineCellChange(item.monthNumber, 'dividendAmount', Number(e.target.value))
                            }
                            className="w-24 bg-transparent hover:bg-[#0B0F17] focus:bg-[#0B0F17] border border-transparent hover:border-[#1F293D] focus:border-blue-500 rounded px-1.5 py-1 text-right text-blue-400 font-semibold focus:outline-none transition-colors"
                          />
                        </div>
                      </td>

                      {/* Net Chit Amount (Formula Display) */}
                      <td className="py-2.5 px-3 text-right border-r border-[#1F293D]/60 font-mono font-bold text-purple-300">
                        ₹{(item.netChitAmount || item.chitValue || 0).toLocaleString('en-IN')}
                      </td>

                      {/* Assigned Member (Searchable Inline Dropdown) */}
                      <td className="py-1.5 px-3 font-sans min-w-[220px] border-r border-[#1F293D]/60">
                        <SearchableMemberSelect
                          value={typeof assignedId === 'string' ? assignedId : ''}
                          onChange={(newMemberId) => handleInlineMemberAssign(item.monthNumber, newMemberId)}
                          members={activeMembers}
                          placeholder="Not Assigned"
                          openUpward={rowIdx >= 5 && rowIdx >= filteredMonthlySchedule.length - 4}
                        />
                      </td>

                      {/* Payment Entry Action & Summary Cell */}
                      <td className="py-1.5 px-3 font-sans min-w-[190px]">
                        {monthTxns.length === 0 ? (
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentEntryModal(item)}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-slate-700 hover:border-emerald-500/60 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 transition-all font-sans font-semibold text-xs"
                            title={`Record Payment for Month ${item.monthNumber}`}
                          >
                            <Plus className="w-3.5 h-3.5 text-emerald-400" />
                            <span>+ Payment Entry</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentEntryModal(item)}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg bg-[#0B0F17] hover:bg-[#161F30] border border-emerald-500/30 hover:border-emerald-500/70 transition-all group/entry shadow-sm"
                            title={`Click to view / add payments for Month ${item.monthNumber}`}
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-slate-200 group-hover/entry:text-white flex items-center gap-1">
                                <CreditCard className="w-3 h-3 text-emerald-400" /> Payment Entry
                              </span>
                              <span className="font-mono text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                                {paidMembersCount} / {totalChitMembersCount} Paid
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-1 text-[11px] font-mono">
                              <span className="font-bold text-emerald-400">
                                ₹{monthCollected.toLocaleString('en-IN')}
                              </span>
                              <span className="text-[10px] text-slate-500 group-hover/entry:text-blue-400 font-sans">
                                Details →
                              </span>
                            </div>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Table Footer Totals */}
              <tfoot className="bg-[#0B0F17] font-mono text-xs font-bold border-t-2 border-[#1F293D] text-slate-300">
                <tr>
                  <td colSpan={2} className="py-3 px-3 text-slate-400 border-r border-[#1F293D]/60">
                    Total ({monthlySchedule.length} Months)
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-400 border-r border-[#1F293D]/60 font-bold">
                    ₹{monthlySchedule.reduce((sum, item) => sum + (item.monthlyPayment || 0), 0).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-3 text-right text-amber-400 border-r border-[#1F293D]/60">
                    ₹{monthlySchedule.reduce((sum, item) => sum + (item.bidAmount || 0), 0).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-3 text-right text-blue-400 border-r border-[#1F293D]/60">
                    ₹{monthlySchedule.reduce((sum, item) => sum + (item.dividendAmount || 0), 0).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-3 text-right text-purple-300 border-r border-[#1F293D]/60 font-bold">
                    ₹{scheme.chitAmount.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-3 text-slate-400 text-center font-sans font-medium text-[11px] border-r border-[#1F293D]/60">
                    {Object.values(scheme.monthMemberAssignments || {}).filter(Boolean).length} / {monthlySchedule.length} Months Assigned
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-400 font-mono font-bold text-xs">
                    ₹{transactions.filter((t) => t.chitId === scheme.id && t.type !== 'Payout').reduce((sum, t) => sum + t.amount, 0).toLocaleString('en-IN')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center bg-[#0B0F17] border border-[#1F293D] rounded-xl text-slate-400 text-xs">
            No monthly periods match your search or status filter.
          </div>
        )}
      </div>

      {/* Dedicated Month Payment Entry Modal */}
      <Modal
        isOpen={paymentEntryModalItem !== null}
        onClose={() => {
          setPaymentEntryModalItem(null);
          setActivePaymentMemberData(null);
          setActivePaymentDetails(null);
        }}
        title={`Payment Entry — Month ${paymentEntryModalItem?.monthNumber}`}
        subtitle={
          paymentEntryModalItem && scheme
            ? `${scheme.name} • Monthly Installment: ₹${(paymentEntryModalItem.monthlyPayment || paymentEntryModalItem.netPayable || scheme.monthlyInstallment).toLocaleString('en-IN')}`
            : ''
        }
        maxWidth="4xl"
      >
        {paymentEntryModalItem && scheme && (() => {
          const item = paymentEntryModalItem;
          const mNum = item.monthNumber;
          const monthlyDue = item.monthlyPayment || item.netPayable || scheme.monthlyInstallment;

          const chitMembers = schemeEnrolledMembers.length > 0
            ? schemeEnrolledMembers
            : members.filter((m) => m.status === 'Active' && m.name !== 'Not Assigned');

          const totalMembers = chitMembers.length;

          // Member installment collection transactions (never mixed with payout)
          const monthTxns = transactions.filter(
            (t) => t.chitId === scheme.id && t.monthNumber === mNum && t.type !== 'Payout'
          );

          const totalCollected = monthTxns.reduce((sum, t) => sum + t.amount, 0);
          const paidMemberIds = new Set(monthTxns.filter((t) => t.amount >= monthlyDue).map((t) => t.memberId));
          const paidMembers = paidMemberIds.size;
          const pendingMembers = Math.max(0, totalMembers - paidMembers);
          const totalExpected = monthlyDue * totalMembers;
          const balance = Math.max(0, totalExpected - totalCollected);

          const rawWinnerAssignment = scheme.monthMemberAssignments?.[mNum];
          const assignmentFromMap = Array.isArray(rawWinnerAssignment) ? rawWinnerAssignment[0] : (rawWinnerAssignment || '');
          const assignedWinnerId = item.assignedMemberIds?.[0] || item.assignedMemberId || assignmentFromMap || '';
          const winnerMember = members.find((m) => m.id === assignedWinnerId);
          const winnerName = winnerMember ? winnerMember.name : (item.assignedMemberName || '');
          const payoutAmt = item.netChitAmount || item.chitValue || Math.max(0, scheme.chitAmount - (item.bidAmount || 0));

          const payoutTxn = transactions.find(
            (t) => t.chitId === scheme.id && t.monthNumber === mNum && t.type === 'Payout'
          );
          const isWinnerPaid = item.payoutStatus === 'Paid' || !!payoutTxn;

          return (
            <div className="space-y-4 text-xs max-h-[85vh] overflow-y-auto pr-1 custom-scrollbar">
              {/* Top Compact Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-[#0B0F17] p-2.5 rounded-xl border border-[#1F293D]">
                <div className="bg-[#121827] p-2 rounded-lg border border-[#1F293D]">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Month Winner</span>
                  <span className="text-xs font-bold text-amber-300 truncate mt-0.5 block" title={winnerName || 'Not Assigned'}>
                    {winnerName || 'Not Assigned'}
                  </span>
                </div>
                <div className="bg-[#121827] p-2 rounded-lg border border-[#1F293D]">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Monthly Due</span>
                  <span className="text-xs font-mono font-bold text-slate-100 mt-0.5 block">
                    ₹{monthlyDue.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="bg-[#121827] p-2 rounded-lg border border-[#1F293D]">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Paid Members</span>
                  <span className="text-xs font-mono font-bold text-emerald-400 mt-0.5 block">
                    {paidMembers} / {totalMembers}
                  </span>
                </div>
                <div className="bg-[#121827] p-2 rounded-lg border border-[#1F293D]">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Collected</span>
                  <span className="text-xs font-mono font-bold text-emerald-400 mt-0.5 block">
                    ₹{totalCollected.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="bg-[#121827] p-2 rounded-lg border border-[#1F293D] col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Pending</span>
                  <span className={`text-xs font-mono font-bold mt-0.5 block ${balance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    ₹{balance.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* SECTION A — MEMBER INSTALLMENT PAYMENTS */}
              <div className="bg-[#0B0F17] border border-[#1F293D] rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-[#1F293D] pb-2">
                  <div>
                    <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-400" /> MEMBER INSTALLMENT PAYMENTS
                    </h4>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Record, view, or update installment payments for enrolled members
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const firstPending = chitMembers.find((m) => {
                        const mTxns = monthTxns.filter((t) => t.memberId === m.id);
                        return mTxns.reduce((sum, t) => sum + t.amount, 0) < monthlyDue;
                      }) || chitMembers[0];
                      if (firstPending) {
                        const mTxns = monthTxns.filter((t) => t.memberId === firstPending.id);
                        handleOpenPaymentFormForMember(firstPending, monthlyDue, mTxns[0]);
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Add Payment
                  </button>
                </div>

                {/* Member Installments Table */}
                <div className="overflow-x-auto custom-scrollbar border border-[#1F293D] rounded-lg">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#121827] text-[10px] uppercase font-mono font-bold text-slate-400 border-b border-[#1F293D]">
                      <tr>
                        <th className="py-2.5 px-3 text-left w-[24%] min-w-[140px]">MEMBER</th>
                        <th className="py-2.5 px-3 text-right w-[10%] min-w-[65px]">DUE</th>
                        <th className="py-2.5 px-3 text-right w-[10%] min-w-[65px]">PAID</th>
                        <th className="py-2.5 px-3 text-left w-[16%] min-w-[100px]">PAID TO</th>
                        <th className="py-2.5 px-3 text-left w-[9%] min-w-[65px]">MODE</th>
                        <th className="py-2.5 px-3 text-left w-[15%] min-w-[105px]">RECEIPT / DATE</th>
                        <th className="py-2.5 px-3 text-left w-[16%] min-w-[125px]">STATUS / ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1F293D]/60 text-xs">
                      {chitMembers.map((m) => {
                        const mTxns = monthTxns.filter((t) => t.memberId === m.id);
                        const totalPaidByMem = mTxns.reduce((sum, t) => sum + t.amount, 0);
                        const dueForMem = monthlyDue;
                        const primaryTxn = mTxns[0];
                        const savedStatus = primaryTxn?.status;
                        const isPaid = savedStatus === 'Paid';
                        const isPartial = savedStatus === 'Partial Paid' || savedStatus === 'Partial';
                        const isPending = savedStatus === 'Pending';
                        const st: 'Paid' | 'Partial Paid' | 'Pending' | null = isPaid
                          ? 'Paid'
                          : isPartial
                          ? 'Partial Paid'
                          : isPending
                          ? 'Pending'
                          : null;

                        const isWinnerPaidTo = primaryTxn?.paidToType === 'WINNER' ||
                          (primaryTxn?.paidTo && !primaryTxn.paidTo.toLowerCase().includes('organizer'));
                        const displayPaidTo = isWinnerPaidTo
                          ? (winnerName || primaryTxn?.receiverName || 'Month Winner')
                          : 'Chit Organizer';
                        // Resolve actual member from global members list using member ID or payment transaction references
                        const resolvedMember = members.find((globalM) => 
                          globalM.id === m.id || 
                          (primaryTxn?.memberId && globalM.id === primaryTxn.memberId) ||
                          (primaryTxn?.payerMemberId && globalM.id === primaryTxn.payerMemberId)
                        ) || m;

                        const memberName = (resolvedMember?.name?.trim()) || 
                          (primaryTxn?.memberName?.trim()) || 
                          (m?.name?.trim()) || 
                          'Unknown Member';

                        const memberPhone = (resolvedMember?.phone?.trim()) || 
                          (primaryTxn?.memberPhone?.trim()) || 
                          (m?.phone?.trim()) || 
                          '';

                        return (
                          <tr key={`mem-inst-row-${m.id}`} className="hover:bg-slate-100/70 dark:hover:bg-[#121827]/60 transition-colors">
                            {/* 1. MEMBER: Name and Phone */}
                            <td className="py-2.5 px-3 align-middle">
                              <div className="font-bold text-white text-xs leading-tight whitespace-nowrap member-name-text">
                                {memberName}
                              </div>
                              <div className="text-[11px] font-mono text-slate-400 leading-tight mt-0.5 whitespace-nowrap">
                                {memberPhone || '-'}
                              </div>
                            </td>

                            {/* 2. DUE: Monthly Expected Amount */}
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-200 align-middle whitespace-nowrap">
                              ₹{dueForMem.toLocaleString('en-IN')}
                            </td>

                            {/* 3. PAID: Actual Paid Amount */}
                            <td className="py-2.5 px-3 text-right font-mono font-bold align-middle whitespace-nowrap">
                              <span className={isPaid ? 'text-emerald-600 dark:text-emerald-400 font-bold' : isPartial ? 'text-sky-600 dark:text-sky-300 font-bold' : 'text-slate-400 dark:text-slate-400 font-medium'}>
                                ₹{totalPaidByMem.toLocaleString('en-IN')}
                              </span>
                            </td>

                            {/* 4. PAID TO: Chit Organizer or Month Winner */}
                            <td className="py-2.5 px-3 align-middle">
                              {primaryTxn && totalPaidByMem > 0 ? (
                                <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded border whitespace-nowrap ${
                                  isWinnerPaidTo
                                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                    : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
                                }`}>
                                  {displayPaidTo}
                                </span>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-500 font-mono">-</span>
                              )}
                            </td>

                            {/* 5. MODE: UPI, Cash, Bank Transfer */}
                            <td className="py-2.5 px-3 align-middle">
                              {primaryTxn && totalPaidByMem > 0 ? (
                                <span className="inline-block text-[11px] font-mono px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                  {primaryTxn.paymentMode}
                                </span>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-500 font-mono">-</span>
                              )}
                            </td>

                            {/* 6. RECEIPT / DATE: Combined Column (Stacked Vertically) */}
                            <td className="py-2.5 px-3 align-middle">
                              {primaryTxn && totalPaidByMem > 0 ? (
                                <div className="flex flex-col items-start leading-tight">
                                  {primaryTxn.receiptUrl ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setReceiptPreview({
                                          url: primaryTxn.receiptUrl!,
                                          title: `Receipt — ${m.name} (Month ${mNum})`,
                                        })
                                      }
                                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 rounded transition-colors whitespace-nowrap"
                                      title="View Uploaded Receipt"
                                    >
                                      <Eye className="w-3 h-3" /> View Receipt
                                    </button>
                                  ) : (
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                                      No Receipt
                                    </span>
                                  )}
                                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1 whitespace-nowrap">
                                    {primaryTxn.paymentDate || primaryTxn.date || '-'}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-start leading-tight">
                                  <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">-</span>
                                  <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px] mt-0.5">-</span>
                                </div>
                              )}
                            </td>

                            {/* 7. STATUS / ACTION: Unified Column */}
                            <td className="py-2.5 px-3 align-middle">
                              {st === 'Paid' ? (
                                <div className="inline-flex items-center gap-2 whitespace-nowrap">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 min-w-[46px] text-center">
                                    Paid
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActivePaymentDetails({
                                        member: m,
                                        due: dueForMem,
                                        totalPaid: totalPaidByMem,
                                        transaction: primaryTxn,
                                      })
                                    }
                                    className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white font-semibold text-[11px] transition-all"
                                  >
                                    Details
                                  </button>
                                </div>
                              ) : st === 'Partial Paid' ? (
                                <div className="inline-flex items-center gap-2 whitespace-nowrap">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 min-w-[70px] text-center">
                                    Partial Paid
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPaymentFormForMember(m, dueForMem, primaryTxn)}
                                    className="px-2.5 py-1 rounded bg-sky-600/20 text-sky-700 dark:text-sky-300 border border-sky-500/40 hover:bg-sky-600 hover:text-white font-semibold text-[11px] transition-all"
                                  >
                                    Edit
                                  </button>
                                </div>
                              ) : st === 'Pending' ? (
                                <div className="inline-flex items-center gap-2 whitespace-nowrap">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 min-w-[56px] text-center">
                                    Pending
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPaymentFormForMember(m, dueForMem, primaryTxn)}
                                    className="px-2.5 py-1 rounded bg-amber-600/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 hover:bg-amber-600 hover:text-white font-semibold text-[11px] transition-all"
                                  >
                                    Edit
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-2 whitespace-nowrap">
                                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 min-w-[76px] text-center">
                                    Select Status
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPaymentFormForMember(m, dueForMem, primaryTxn)}
                                    className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-all shadow-sm"
                                  >
                                    Pay
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION B — WINNER PAYOUT FROM ORGANIZER */}
              <div className="bg-[#0B0F17] border border-[#1F293D] rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-[#1F293D] pb-2">
                  <div>
                    <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-amber-400" /> WINNER PAYOUT FROM ORGANIZER
                    </h4>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Track chit fund payout disbursement to this month's winning member
                    </span>
                  </div>
                  {isWinnerPaid ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Payout Disbursed
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteWinnerPayout(mNum)}
                        className="text-[10px] text-rose-400 hover:text-rose-300 underline"
                      >
                        Reset Payout
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsWinnerPayoutFormOpen((prev) => !prev)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-sm transition-all"
                    >
                      {isWinnerPayoutFormOpen ? 'Cancel Payout Form' : '+ Record Winner Payout'}
                    </button>
                  )}
                </div>

                {/* Winner Payout Info Card */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 bg-[#121827] p-2.5 rounded-lg border border-[#1F293D]">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Assigned Winner</span>
                    <span className="text-xs font-bold text-slate-100 mt-0.5 block">{winnerName || 'Not Assigned'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Net Chit Payout Amount</span>
                    <span className="text-xs font-mono font-bold text-amber-400 mt-0.5 block">
                      ₹{payoutAmt.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Payout Status</span>
                    <span className={`text-xs font-semibold mt-0.5 block ${isWinnerPaid ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {isWinnerPaid ? 'Paid' : 'Pending'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Disbursed Date / Mode</span>
                    <span className="text-xs font-mono text-slate-300 mt-0.5 block">
                      {isWinnerPaid ? `${payoutTxn?.paymentDate || item.payoutDate || '-'} (${payoutTxn?.paymentMode || item.payoutMode || 'UPI'})` : '-'}
                    </span>
                  </div>
                </div>

                {/* Optional Payout Form */}
                {isWinnerPayoutFormOpen && !isWinnerPaid && (
                  <form onSubmit={handleWinnerPayoutSubmit} className="bg-[#101726] border border-amber-500/30 p-3 rounded-lg space-y-3 animate-fadeIn">
                    <h5 className="font-bold text-amber-300 text-xs">Record Payout to {winnerName || 'Winner'}</h5>
                    {winnerPayoutError && (
                      <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded text-rose-300 text-xs">
                        {winnerPayoutError}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-300 block mb-1">Amount Paid (₹)</label>
                        <input
                          type="number"
                          value={winnerPayoutForm.amount}
                          onChange={(e) => setWinnerPayoutForm({ ...winnerPayoutForm, amount: Number(e.target.value) })}
                          className="w-full bg-[#0B0F17] border border-[#1F293D] rounded px-2 py-1 text-xs text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-300 block mb-1">Payment Mode</label>
                        <select
                          value={winnerPayoutForm.paymentMode}
                          onChange={(e) => setWinnerPayoutForm({ ...winnerPayoutForm, paymentMode: e.target.value as PaymentMode })}
                          className="w-full bg-[#0B0F17] border border-[#1F293D] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                        >
                          <option value="UPI">UPI</option>
                          <option value="Cash">Cash</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-300 block mb-1">Disbursement Date</label>
                        <input
                          type="date"
                          value={winnerPayoutForm.paymentDate}
                          onChange={(e) => setWinnerPayoutForm({ ...winnerPayoutForm, paymentDate: e.target.value })}
                          className="w-full bg-[#0B0F17] border border-[#1F293D] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-300 block mb-1">Reference / UTR ID</label>
                        <input
                          type="text"
                          value={winnerPayoutForm.referenceId}
                          onChange={(e) => setWinnerPayoutForm({ ...winnerPayoutForm, referenceId: e.target.value })}
                          placeholder="e.g. UTR-987123"
                          className="w-full bg-[#0B0F17] border border-[#1F293D] rounded px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-300 block mb-1">Notes</label>
                        <input
                          type="text"
                          value={winnerPayoutForm.notes}
                          onChange={(e) => setWinnerPayoutForm({ ...winnerPayoutForm, notes: e.target.value })}
                          placeholder="Payout confirmation notes"
                          className="w-full bg-[#0B0F17] border border-[#1F293D] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1 border-t border-[#1F293D]">
                      <button
                        type="button"
                        onClick={() => setIsWinnerPayoutFormOpen(false)}
                        className="px-3 py-1 bg-slate-800 text-slate-300 text-xs rounded"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded shadow-sm"
                      >
                        Save Winner Payout
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Close Modal Button */}
              <div className="flex justify-end pt-2 border-t border-[#1F293D]">
                <button
                  type="button"
                  onClick={() => setPaymentEntryModalItem(null)}
                  className="px-4 py-1.5 rounded-lg bg-[#1F293D] text-slate-300 hover:bg-[#2B3952] text-xs font-semibold transition-colors"
                >
                  Close Window
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Sub-Modal: Payment Entry / Edit Form Modal */}
      <Modal
        isOpen={activePaymentMemberData !== null}
        onClose={() => setActivePaymentMemberData(null)}
        title={activePaymentMemberData?.existingTxn ? `Update Payment — ${activePaymentMemberData?.member.name}` : `Record Payment — ${activePaymentMemberData?.member.name}`}
        subtitle={
          activePaymentMemberData && paymentEntryModalItem
            ? `Month ${paymentEntryModalItem.monthNumber} • Monthly Due: ₹${activePaymentMemberData.due.toLocaleString('en-IN')}`
            : ''
        }
        maxWidth="md"
        zIndex="z-[60]"
      >
        {activePaymentMemberData && paymentEntryModalItem && (() => {
          const { member, due } = activePaymentMemberData;
          const mNum = paymentEntryModalItem.monthNumber;
          const rawWinnerAssignment = scheme.monthMemberAssignments?.[mNum];
          const assignmentFromMap = Array.isArray(rawWinnerAssignment) ? rawWinnerAssignment[0] : (rawWinnerAssignment || '');
          const assignedWinnerId = paymentEntryModalItem.assignedMemberIds?.[0] || paymentEntryModalItem.assignedMemberId || assignmentFromMap || '';
          const winnerMember = members.find((m) => m.id === assignedWinnerId);
          const winnerName = winnerMember ? winnerMember.name : (paymentEntryModalItem.assignedMemberName || '');

          const numAmount = Number(paymentEntryForm.amount);
          const isOverDue = numAmount > due;

          let statusWarning = '';
          if (paymentEntryForm.status === 'Paid') {
            if (numAmount === 0) {
              statusWarning = 'Amount paid is ₹0. Please verify the payment amount.';
            } else if (numAmount < due) {
              statusWarning = 'Amount paid is less than the monthly due. Please verify the status.';
            }
          } else if (paymentEntryForm.status === 'Partial Paid') {
            if (numAmount >= due) {
              statusWarning = 'Amount paid matches the monthly due. Please verify the status.';
            } else if (numAmount === 0) {
              statusWarning = 'Amount paid is ₹0. Please verify the payment amount.';
            }
          } else if (paymentEntryForm.status === 'Pending') {
            if (numAmount > 0) {
              statusWarning = `Amount paid is ₹${numAmount.toLocaleString('en-IN')}. Please verify the status.`;
            }
          }

          return (
            <form onSubmit={handlePaymentEntrySubmit} className="space-y-3.5 text-xs">
              {/* Member Brief Card */}
              <div className="bg-[#0B0F17] p-2.5 rounded-lg border border-[#1F293D] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block">Member Name & Phone</span>
                  <span className="font-bold text-slate-100 text-xs">{member.name}</span>
                  <span className="text-[11px] font-mono text-slate-400 ml-1.5">({member.phone || '-'})</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Monthly Due</span>
                  <span className="font-mono font-bold text-emerald-400 text-xs">₹{due.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {paymentEntryError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{paymentEntryError}</span>
                </div>
              )}

              {/* Amount Paid & Status Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Amount Paid */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Amount Paid (₹) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={due}
                    step="any"
                    value={paymentEntryForm.amount}
                    onChange={(e) =>
                      setPaymentEntryForm({
                        ...paymentEntryForm,
                        amount: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-lg px-3 py-2 text-slate-100 font-mono font-bold text-sm focus:outline-none focus:border-blue-500"
                    required
                  />
                  {numAmount > 0 && numAmount < due && (
                    <span className="text-[10px] text-sky-400 mt-0.5 block font-mono">
                      ₹{(due - numAmount).toLocaleString('en-IN')} remaining balance
                    </span>
                  )}
                </div>

                {/* Status Dropdown */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Status
                  </label>
                  <select
                    value={paymentEntryForm.status}
                    onChange={(e) =>
                      setPaymentEntryForm({
                        ...paymentEntryForm,
                        status: e.target.value as 'Pending' | 'Partial Paid' | 'Paid' | '',
                      })
                    }
                    className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-lg px-3 py-2 text-slate-100 font-semibold text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="" className="bg-[#121827] text-slate-400">
                      Select Status
                    </option>
                    <option value="Pending" className="bg-[#121827] text-slate-100">
                      Pending
                    </option>
                    <option value="Partial Paid" className="bg-[#121827] text-slate-100">
                      Partial Paid
                    </option>
                    <option value="Paid" className="bg-[#121827] text-slate-100">
                      Paid
                    </option>
                  </select>
                </div>
              </div>

              {/* Status Validation Warning (Non-blocking) */}
              {statusWarning && (
                <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-[11px] flex items-center gap-1.5 leading-tight">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span>{statusWarning}</span>
                </div>
              )}

              {/* Paid To: Chit Organizer vs Month Winner */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Paid To <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentEntryForm({ ...paymentEntryForm, paidToType: 'ORGANIZER' })}
                    className={`p-2 rounded-lg border text-left text-xs font-semibold transition-all ${
                      paymentEntryForm.paidToType === 'ORGANIZER'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-sm'
                        : 'bg-[#0B0F17] border-[#1F293D] text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>Chit Organizer</span>
                      {paymentEntryForm.paidToType === 'ORGANIZER' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentEntryForm({ ...paymentEntryForm, paidToType: 'WINNER' })}
                    className={`p-2 rounded-lg border text-left text-xs font-semibold transition-all ${
                      paymentEntryForm.paidToType === 'WINNER'
                        ? 'bg-amber-600/20 border-amber-500 text-amber-300 shadow-sm'
                        : 'bg-[#0B0F17] border-[#1F293D] text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{winnerName ? winnerName : 'Month Winner'}</span>
                      {paymentEntryForm.paidToType === 'WINNER' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                  </button>
                </div>
              </div>

              {/* Mode & Date */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Payment Mode <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={paymentEntryForm.paymentMode}
                    onChange={(e) => setPaymentEntryForm({ ...paymentEntryForm, paymentMode: e.target.value as PaymentMode })}
                    className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Payment Date <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={paymentEntryForm.paymentDate}
                    onChange={(e) => setPaymentEntryForm({ ...paymentEntryForm, paymentDate: e.target.value })}
                    className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Mode & Receipt Section */}
              <div className="p-2.5 bg-[#0B0F17] border border-[#1F293D] rounded-lg space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 block">Payment Receipt / Screenshot</label>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#121827] hover:bg-[#1a2337] border border-[#1F293D] text-slate-200 text-xs font-semibold transition-colors">
                    <Upload className="w-3.5 h-3.5 text-blue-400" />
                    <span>Upload Receipt</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => handleReceiptUpload(e, (url) => setPaymentEntryForm({ ...paymentEntryForm, receiptUrl: url }))}
                    />
                  </label>
                  {paymentEntryForm.receiptUrl && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setReceiptPreview({ url: paymentEntryForm.receiptUrl, title: `Receipt — ${member.name}` })}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 underline"
                      >
                        <Eye className="w-3 h-3" /> Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentEntryForm({ ...paymentEntryForm, receiptUrl: '' })}
                        className="p-1 text-slate-400 hover:text-rose-400 rounded"
                        title="Remove Receipt"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Reference ID & Notes */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">Reference / UTR ID</label>
                  <input
                    type="text"
                    value={paymentEntryForm.referenceId}
                    onChange={(e) => setPaymentEntryForm({ ...paymentEntryForm, referenceId: e.target.value })}
                    placeholder="e.g. UPI-123456"
                    className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-lg px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">Notes</label>
                  <input
                    type="text"
                    value={paymentEntryForm.notes}
                    onChange={(e) => setPaymentEntryForm({ ...paymentEntryForm, notes: e.target.value })}
                    placeholder="e.g. Paid in full"
                    className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-[#1F293D]">
                <button
                  type="button"
                  onClick={() => setActivePaymentMemberData(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#1F293D] text-slate-300 text-xs font-semibold hover:bg-[#2B3952] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isOverDue}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" /> Save Payment
                </button>
              </div>
            </form>
          );
        })()}
      </Modal>

      {/* Sub-Modal: Read-Only Payment Details Modal */}
      <Modal
        isOpen={activePaymentDetails !== null}
        onClose={() => setActivePaymentDetails(null)}
        title="Payment Details"
        subtitle={
          activePaymentDetails && paymentEntryModalItem
            ? `Month ${paymentEntryModalItem.monthNumber} • ${activePaymentDetails.member.name}`
            : ''
        }
        maxWidth="sm"
        zIndex="z-[60]"
      >
        {activePaymentDetails && (() => {
          const { member, due, totalPaid, transaction } = activePaymentDetails;
          const isWinnerPaidTo = transaction?.paidToType === 'WINNER' ||
            (transaction?.paidTo && !transaction.paidTo.toLowerCase().includes('organizer'));
          const displayPaidTo = isWinnerPaidTo
            ? (transaction?.paidTo || 'Month Winner')
            : 'Chit Organizer';

          return (
            <div className="space-y-3.5 text-xs">
              <div className="bg-[#0B0F17] border border-[#1F293D] rounded-xl p-3.5 divide-y divide-[#1F293D]/60">
                <div className="py-1.5 flex justify-between">
                  <span className="text-slate-400">Member:</span>
                  <span className="font-bold text-slate-100">{member.name}</span>
                </div>
                <div className="py-1.5 flex justify-between">
                  <span className="text-slate-400">Phone:</span>
                  <span className="font-mono text-slate-200">{member.phone || '-'}</span>
                </div>
                <div className="py-1.5 flex justify-between">
                  <span className="text-slate-400">Monthly Due:</span>
                  <span className="font-mono font-semibold text-slate-200">₹{due.toLocaleString('en-IN')}</span>
                </div>
                <div className="py-1.5 flex justify-between">
                  <span className="text-slate-400">Amount Paid:</span>
                  <span className="font-mono font-bold text-emerald-400">₹{totalPaid.toLocaleString('en-IN')}</span>
                </div>
                <div className="py-1.5 flex justify-between">
                  <span className="text-slate-400">Paid To:</span>
                  <span className="font-semibold text-blue-300">{displayPaidTo}</span>
                </div>
                <div className="py-1.5 flex justify-between">
                  <span className="text-slate-400">Payment Mode:</span>
                  <span className="font-mono text-slate-200">{transaction?.paymentMode || 'UPI'}</span>
                </div>
                <div className="py-1.5 flex justify-between">
                  <span className="text-slate-400">Payment Date:</span>
                  <span className="font-mono text-slate-200">{transaction?.paymentDate || transaction?.date || '-'}</span>
                </div>
                <div className="py-1.5 flex justify-between items-center">
                  <span className="text-slate-400">Receipt:</span>
                  {transaction?.receiptUrl ? (
                    <button
                      type="button"
                      onClick={() =>
                        setReceiptPreview({
                          url: transaction.receiptUrl!,
                          title: `Receipt — ${member.name}`,
                        })
                      }
                      className="text-blue-400 hover:text-blue-300 underline font-semibold flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" /> View Receipt
                    </button>
                  ) : (
                    <span className="text-slate-500 font-mono">None</span>
                  )}
                </div>
                <div className="py-1.5 flex justify-between">
                  <span className="text-slate-400">Reference ID:</span>
                  <span className="font-mono text-slate-300">{transaction?.referenceId || transaction?.referenceNo || '-'}</span>
                </div>
                <div className="py-1.5 flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                    transaction?.status === 'Partial Paid' || transaction?.status === 'Partial'
                      ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                      : transaction?.status === 'Pending'
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : transaction?.status === 'Paid'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {transaction?.status || 'Select Status'}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#1F293D]">
                <button
                  type="button"
                  onClick={() => {
                    setActivePaymentDetails(null);
                    handleOpenPaymentFormForMember(member, due, transaction);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center gap-1"
                >
                  <Edit className="w-3 h-3" /> Edit Payment
                </button>
                <button
                  type="button"
                  onClick={() => setActivePaymentDetails(null)}
                  className="px-3 py-1.5 rounded-lg bg-[#1F293D] text-slate-300 hover:bg-[#2B3952] font-semibold text-xs transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Sub-Modal: Screenshot / Receipt Lightbox Modal */}
      <Modal
        isOpen={receiptPreview !== null}
        onClose={() => setReceiptPreview(null)}
        title={receiptPreview?.title || 'Payment Receipt'}
        maxWidth="lg"
        zIndex="z-[70]"
      >
        {receiptPreview && (
          <div className="space-y-4 text-xs">
            <div className="max-h-[65vh] overflow-auto flex items-center justify-center bg-[#0B0F17] rounded-xl border border-[#1F293D] p-2">
              <img
                src={receiptPreview.url}
                alt="Receipt"
                className="max-h-[60vh] max-w-full rounded-lg object-contain"
              />
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-[#1F293D]">
              <a
                href={receiptPreview.url}
                download="receipt.png"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#121827] border border-[#1F293D] hover:border-slate-500 text-slate-200 text-xs font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" /> Download
              </a>
              <button
                type="button"
                onClick={() => setReceiptPreview(null)}
                className="px-4 py-1.5 rounded-lg bg-[#1F293D] text-slate-300 hover:bg-[#2B3952] text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Member Month Details Modal */}
      <Modal
        isOpen={selectedMemberMonthDetails !== null}
        onClose={() => setSelectedMemberMonthDetails(null)}
        title="Member Details"
        subtitle={selectedMemberMonthDetails ? `Month ${selectedMemberMonthDetails.monthItem.monthNumber} • ${selectedMemberMonthDetails.member.name} • ${scheme.name}` : ''}
        maxWidth="lg"
      >
        {selectedMemberMonthDetails && (() => {
          const { monthItem, member } = selectedMemberMonthDetails;

          // Filter payment transactions specifically for this member + chit + monthNumber
          const memberMonthTxns = transactions.filter((t) => {
            const isMember = t.memberId === member.id;
            const isChit = !t.chitId || t.chitId === scheme.id;
            const isMonth =
              t.monthNumber === monthItem.monthNumber ||
              (t.notes && t.notes.toLowerCase().includes(`month ${monthItem.monthNumber}`));
            return isMember && isChit && isMonth;
          });

          let paymentRecords = memberMonthTxns.map((t) => ({
            id: t.id,
            date: t.date,
            amount: t.amount,
            method: t.paymentMode,
            receiptNo: t.receiptNo || 'N/A',
            notes: t.notes || '',
          }));

          const totalAmountPayable = monthItem.netPayable;
          const amountPaid = paymentRecords.reduce((sum, r) => sum + r.amount, 0);
          const balance = Math.max(0, totalAmountPayable - amountPaid);

          let paymentStatus: 'Paid' | 'Partial' | 'Pending' = 'Pending';
          if (amountPaid > 0 && balance === 0) {
            paymentStatus = 'Paid';
          } else if (amountPaid > 0 && balance > 0) {
            paymentStatus = 'Partial';
          } else {
            paymentStatus = 'Pending';
          }

          // Disbursement / Auction Details for Month & Member
          const auctionRecord = scheme.auctions?.find(
            (a) =>
              a.monthNumber === monthItem.monthNumber &&
              (a.winningMemberId === member.id || a.winningMemberName === member.name)
          );

          const isDisbursed =
            !!auctionRecord ||
            (monthItem.assignedMemberId === member.id &&
              (monthItem.status === 'Completed' || monthItem.status === 'Auction Completed'));

          const chitAmount = scheme.chitAmount;
          const commission = Math.round((chitAmount * (scheme.commissionPercentage || 5)) / 100);
          const bidAmount = auctionRecord?.bidAmount || monthItem.dividendAmount || 0;
          const netPayablePayout = auctionRecord?.prizeAmount || Math.max(0, chitAmount - commission - bidAmount);
          const amountDisbursed = isDisbursed ? netPayablePayout : 0;
          const disbursementStatus = isDisbursed ? 'Paid' : 'Pending';
          const disbursementDate = auctionRecord?.auctionDate || monthItem.dueDate;
          const disbursementMethod = 'Bank Transfer';

          return (
            <div className="space-y-6 text-xs max-h-[75vh] overflow-y-auto pr-1">
              {/* Section 1: Complete Member Month Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Member Info */}
                <div className="p-3.5 bg-[#0B0F17] border border-[#1F293D] rounded-xl space-y-1.5">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-blue-400" /> Member
                  </span>
                  <p className="font-bold text-slate-100 text-sm">{member.name}</p>
                  <p className="text-[11px] font-mono text-slate-400">Phone: {member.phone || 'N/A'}</p>
                  {member.email && <p className="text-[10px] text-slate-500 truncate">{member.email}</p>}
                </div>

                {/* Chit Info */}
                <div className="p-3.5 bg-[#0B0F17] border border-[#1F293D] rounded-xl space-y-1.5">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-purple-400" /> Chit
                  </span>
                  <p className="font-bold text-slate-100 text-sm">{scheme.name}</p>
                  <p className="text-[11px] font-mono text-slate-400">Value: ₹{scheme.chitAmount.toLocaleString('en-IN')}</p>
                  <p className="text-[10px] text-slate-500">Duration: {scheme.durationMonths} Months</p>
                </div>

                {/* Month Info */}
                <div className="p-3.5 bg-[#0B0F17] border border-[#1F293D] rounded-xl space-y-1.5">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Month
                  </span>
                  <p className="font-bold text-slate-100 text-sm">Month {monthItem.monthNumber}</p>
                  <p className="text-[11px] font-mono text-slate-400">{monthItem.monthLabel}</p>
                  <div className="pt-0.5">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                      {monthItem.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Payment Details */}
              <div className="bg-[#0B0F17] border border-[#1F293D] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#1F293D] pb-2">
                  <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-emerald-400" /> Payment Summary
                  </h4>
                  <StatusBadge status={paymentStatus} size="sm" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 bg-[#121827] rounded-lg border border-[#1F293D]">
                    <span className="text-[10px] text-slate-400 font-medium block">Total Amount Payable</span>
                    <span className="text-sm font-mono font-bold text-slate-100 mt-1 block">
                      ₹{totalAmountPayable.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="p-2.5 bg-[#121827] rounded-lg border border-[#1F293D]">
                    <span className="text-[10px] text-slate-400 font-medium block">Amount Paid</span>
                    <span className="text-sm font-mono font-bold text-emerald-400 mt-1 block">
                      ₹{amountPaid.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="p-2.5 bg-[#121827] rounded-lg border border-[#1F293D]">
                    <span className="text-[10px] text-slate-400 font-medium block">Balance</span>
                    <span
                      className={`text-sm font-mono font-bold mt-1 block ${
                        balance === 0 ? 'text-slate-400' : balance < totalAmountPayable ? 'text-amber-400' : 'text-rose-400'
                      }`}
                    >
                      ₹{balance.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="p-2.5 bg-[#121827] rounded-lg border border-[#1F293D]">
                    <span className="text-[10px] text-slate-400 font-medium block">Payment Status</span>
                    <span
                      className={`text-xs font-bold mt-1.5 block ${
                        paymentStatus === 'Paid'
                          ? 'text-emerald-400'
                          : paymentStatus === 'Partial'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {paymentStatus}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 3: Where Money Was Paid / Payment History */}
              <div className="bg-[#0B0F17] border border-[#1F293D] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#1F293D] pb-2">
                  <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-blue-400" /> Payment History & Receipts
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {paymentRecords.length} Record{paymentRecords.length === 1 ? '' : 's'}
                  </span>
                </div>

                {paymentRecords.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#1F293D] text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Amount</th>
                          <th className="py-2 px-3">Payment Method</th>
                          <th className="py-2 px-3">Receipt Number</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1F293D]/60 font-mono text-[11px]">
                        {paymentRecords.map((r, idx) => (
                          <tr key={r.id || idx} className="hover:bg-[#121827]/60 transition-colors">
                            <td className="py-2.5 px-3 text-slate-200">{r.date}</td>
                            <td className="py-2.5 px-3 font-bold text-emerald-400">₹{r.amount.toLocaleString('en-IN')}</td>
                            <td className="py-2.5 px-3 text-slate-300">
                              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[10px] font-sans font-semibold">
                                {r.method}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-400">{r.receiptNo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 text-center bg-[#121827]/50 rounded-lg border border-dashed border-[#1F293D] text-slate-400 text-xs">
                    No payment transactions recorded for Month {monthItem.monthNumber} yet.
                  </div>
                )}
              </div>

              {/* Section 4: "YARUKU KUDUTHU IRUKAGA" / DISBURSEMENT DETAILS */}
              <div className="bg-[#0B0F17] border border-[#1F293D] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#1F293D] pb-2">
                  <div>
                    <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-amber-400" /> Chit Payout / Disbursement Details
                    </h4>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Disbursement information for this chit scheme month
                    </span>
                  </div>
                  <StatusBadge status={disbursementStatus} size="sm" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 bg-[#121827] rounded-lg border border-[#1F293D]">
                    <span className="text-[10px] text-slate-400 font-medium block">Chit Amount</span>
                    <span className="text-xs font-mono font-bold text-slate-100 mt-1 block">
                      ₹{chitAmount.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="p-2.5 bg-[#121827] rounded-lg border border-[#1F293D]">
                    <span className="text-[10px] text-slate-400 font-medium block">Commission ({scheme.commissionPercentage}%)</span>
                    <span className="text-xs font-mono font-bold text-purple-400 mt-1 block">
                      ₹{commission.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="p-2.5 bg-[#121827] rounded-lg border border-[#1F293D]">
                    <span className="text-[10px] text-slate-400 font-medium block">Net Payable Payout</span>
                    <span className="text-xs font-mono font-bold text-amber-400 mt-1 block">
                      ₹{netPayablePayout.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="p-2.5 bg-[#121827] rounded-lg border border-[#1F293D]">
                    <span className="text-[10px] text-slate-400 font-medium block">Amount Disbursed</span>
                    <span className={`text-xs font-mono font-bold mt-1 block ${isDisbursed ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {isDisbursed ? `₹${amountDisbursed.toLocaleString('en-IN')}` : '₹0'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                  <div className="p-2.5 bg-[#121827] rounded-lg border border-[#1F293D]">
                    <span className="text-[10px] text-slate-400 font-medium block">Recipient / Payee</span>
                    <span className="text-xs font-semibold text-slate-200 mt-0.5 block">
                      {isDisbursed ? member.name : 'Not Disbursed'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-[#121827] rounded-lg border border-[#1F293D]">
                    <span className="text-[10px] text-slate-400 font-medium block">Disbursement Date</span>
                    <span className="text-xs font-mono text-slate-200 mt-0.5 block">
                      {isDisbursed ? disbursementDate : 'Not Disbursed'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-[#121827] rounded-lg border border-[#1F293D]">
                    <span className="text-[10px] text-slate-400 font-medium block">Payment Method</span>
                    <span className="text-xs font-semibold text-slate-200 mt-0.5 block">
                      {isDisbursed ? disbursementMethod : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-[#1F293D]">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMemberMonthDetails(null);
                    navigate(`/members/${member.id}`);
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600 hover:text-white text-blue-300 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> View Full Member Profile
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMemberMonthDetails(null)}
                  className="w-full sm:w-auto px-5 py-2 rounded-xl bg-[#1F293D] text-slate-200 hover:bg-[#2B3952] text-xs font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Edit Month Calculation Modal */}
      <Modal
        isOpen={editingMonthItem !== null}
        onClose={() => setEditingMonthItem(null)}
        title={`Edit Month ${editingMonthItem?.monthNumber}`}
        subtitle={`Update monthly calculations for Month ${editingMonthItem?.monthNumber} in ${scheme.name}`}
        maxWidth="md"
      >
        {editingMonthItem && (
          <form onSubmit={handleSaveEditMonth} className="space-y-4 text-xs">
            {editMonthError && (
              <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-xs">
                {editMonthError}
              </div>
            )}

            <div>
              <label className="block text-slate-300 font-medium mb-1">Month Number</label>
              <input
                type="text"
                disabled
                value={`Month ${editingMonthItem.monthNumber}`}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-400 font-mono text-xs cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Monthly Installment (₹)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={editMonthForm.grossInstallment}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    const gross = isNaN(parsed) ? 0 : Math.max(0, parsed);
                    const net = Math.max(0, gross - editMonthForm.dividendAmount);
                    setEditMonthForm({
                      ...editMonthForm,
                      grossInstallment: gross,
                      netPayable: net,
                    });
                  }}
                  className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 font-mono text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Dividend / Discount (₹)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={editMonthForm.dividendAmount}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    const div = isNaN(parsed) ? 0 : Math.max(0, parsed);
                    const net = Math.max(0, editMonthForm.grossInstallment - div);
                    const comm = Math.round((scheme.chitAmount * (scheme.commissionPercentage || 4)) / 100);
                    const totalColl = Math.round(div * scheme.durationMonths + comm);
                    const val = Math.max(0, scheme.chitAmount - totalColl);

                    setEditMonthForm({
                      ...editMonthForm,
                      dividendAmount: div,
                      netPayable: net,
                      totalCollection: totalColl,
                      chitValue: val,
                    });
                  }}
                  className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-purple-300 font-mono text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Amount Payable (₹)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={editMonthForm.netPayable}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    setEditMonthForm({ ...editMonthForm, netPayable: isNaN(parsed) ? 0 : Math.max(0, parsed) });
                  }}
                  className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-emerald-400 font-mono text-sm font-bold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Total Collection (₹)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={editMonthForm.totalCollection}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    setEditMonthForm({ ...editMonthForm, totalCollection: isNaN(parsed) ? 0 : Math.max(0, parsed) });
                  }}
                  className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-blue-400 font-mono text-sm font-bold focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Chit Value (₹)</label>
              <input
                type="number"
                required
                min="0"
                value={editMonthForm.chitValue}
                onChange={(e) => {
                  const parsed = Number(e.target.value);
                  setEditMonthForm({ ...editMonthForm, chitValue: isNaN(parsed) ? 0 : Math.max(0, parsed) });
                }}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-amber-400 font-mono text-sm font-bold focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="p-3 bg-[#0B0F17] border border-[#1F293D] rounded-xl">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block tracking-wider mb-1">Assigned Member</span>
              <span className="font-bold text-slate-200 text-xs">
                {editingMonthItem.assignedMemberName
                  ? `${editingMonthItem.assignedMemberName} (${editingMonthItem.assignedMemberPhone})`
                  : 'Not Assigned'}
              </span>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#1F293D]">
              <button
                type="button"
                onClick={() => setEditingMonthItem(null)}
                className="px-4 py-2 rounded-xl bg-[#1F293D] text-slate-300 hover:bg-[#2B3952] text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Save Changes
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Assign Member Modal */}
      <Modal
        isOpen={assignMonthNumber !== null}
        onClose={() => setAssignMonthNumber(null)}
        title={`Assign Members to Month ${assignMonthNumber}`}
        subtitle={`Select members for Month ${assignMonthNumber} in ${scheme.name}`}
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search member by name or phone..."
              value={assignMemberSearch}
              onChange={(e) => setAssignMemberSearch(e.target.value)}
              className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Members List */}
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {members.filter((m) => {
              const matchesSearch =
                m.name.toLowerCase().includes(assignMemberSearch.toLowerCase()) ||
                m.phone.includes(assignMemberSearch);
              return matchesSearch;
            }).length > 0 ? (
              members
                .filter((m) => {
                  const matchesSearch =
                    m.name.toLowerCase().includes(assignMemberSearch.toLowerCase()) ||
                    m.phone.includes(assignMemberSearch);
                  return matchesSearch;
                })
                .map((m) => {
                  const isSelected = selectedMemberIds.includes(m.id);
                  const existingAssignments = scheme.monthMemberAssignments || {};
                  const otherAssignedMonths: number[] = [];
                  Object.entries(existingAssignments).forEach(([mNumStr, val]) => {
                    const mNum = Number(mNumStr);
                    if (mNum !== assignMonthNumber) {
                      if (Array.isArray(val) && val.includes(m.id)) {
                        otherAssignedMonths.push(mNum);
                      } else if (val === m.id) {
                        otherAssignedMonths.push(mNum);
                      }
                    }
                  });

                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedMemberIds((prev) => prev.filter((id) => id !== m.id));
                        } else {
                          setSelectedMemberIds((prev) => [...prev, m.id]);
                        }
                      }}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-950/40 border-blue-500/60 shadow-sm'
                          : 'bg-[#0B0F17] border-[#1F293D] hover:border-blue-500/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded border-slate-700 bg-[#121827] text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-100 text-sm">{m.name}</span>
                            {isSelected && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                Selected
                              </span>
                            )}
                            {otherAssignedMonths.length > 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Assigned to Month {otherAssignedMonths.join(', ')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 font-mono">
                            <span>{m.phone}</span>
                            {m.email && <span>• {m.email}</span>}
                          </div>
                        </div>
                      </div>

                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-[#121827] text-slate-400 border border-[#1F293D]'
                      }`}>
                        {isSelected ? 'Selected' : 'Select'}
                      </span>
                    </div>
                  );
                })
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs bg-[#0B0F17] rounded-xl border border-[#1F293D]">
                No members found in system. Add a new member first.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-[#1F293D]">
            <button
              type="button"
              onClick={() => {
                setIsAddMemberModalOpen(true);
              }}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" /> Enroll New Member to System
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setAssignMonthNumber(null)}
                className="px-4 py-2 rounded-xl bg-[#1F293D] text-slate-300 text-xs font-semibold hover:bg-[#2B3952] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (assignMonthNumber !== null) {
                    assignMemberToMonth(scheme.id, assignMonthNumber, selectedMemberIds);
                    setAssignMonthNumber(null);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all flex items-center gap-1.5"
              >
                <UserCheck className="w-3.5 h-3.5" /> Assign Selected Members ({selectedMemberIds.length})
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Add Member Modal */}
      <Modal
        isOpen={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
        title={`Enroll Member to ${scheme.name}`}
        subtitle="Add an enrolled member to system"
      >
        <form onSubmit={handleAddMemberSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">Full Name</label>
            <input
              type="text"
              name="name"
              required
              placeholder="e.g. Ramesh Chandra"
              value={newMemberForm.name}
              onChange={(e) => setNewMemberForm({ ...newMemberForm, name: e.target.value })}
              className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Phone Number</label>
              <input
                type="text"
                name="phone"
                required
                placeholder="9876543210"
                value={newMemberForm.phone}
                onChange={(e) => setNewMemberForm({ ...newMemberForm, phone: e.target.value })}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Email Address</label>
              <input
                type="email"
                name="email"
                placeholder="ramesh@example.com"
                value={newMemberForm.email}
                onChange={(e) => setNewMemberForm({ ...newMemberForm, email: e.target.value })}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-slate-300 font-medium mb-1">Address</label>
            <input
              type="text"
              name="address"
              placeholder="MG Road, Bengaluru"
              value={newMemberForm.address}
              onChange={(e) => setNewMemberForm({ ...newMemberForm, address: e.target.value })}
              className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#1F293D]">
            <button
              type="button"
              onClick={() => setIsAddMemberModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-[#1F293D] text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30"
            >
              Enroll Member
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit / Configure Chit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={scheme.durationMonths > 0 ? "Edit Chit Scheme Rules" : "Configure Chit Scheme"}
        subtitle={`Set duration, installments, and terms for ${scheme.name}`}
        maxWidth="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Chit Name</label>
              <input
                type="text"
                name="name"
                required
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Chit Amount (₹)</label>
              <input
                type="number"
                name="chitAmount"
                required
                min="1000"
                value={editData.chitAmount}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setEditData({ ...editData, chitAmount: isNaN(val) ? 0 : Math.max(0, val) });
                }}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Duration (Months)</label>
              <input
                type="number"
                name="durationMonths"
                required
                min="1"
                max="120"
                value={editData.durationMonths || ''}
                onChange={(e) => {
                  const parsed = Number(e.target.value);
                  const d = isNaN(parsed) ? 0 : Math.max(0, parsed);
                  const inst = d > 0 ? Math.round(editData.chitAmount / d) : editData.monthlyInstallment;
                  setEditData({ ...editData, durationMonths: d, monthlyInstallment: inst });
                }}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">Controls generated monthly periods</span>
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Monthly Base Installment (₹)</label>
              <input
                type="number"
                name="monthlyInstallment"
                required
                min="100"
                value={editData.monthlyInstallment}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setEditData({ ...editData, monthlyInstallment: isNaN(val) ? 0 : Math.max(0, val) });
                }}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Installment Type</label>
              <select
                name="installmentType"
                value={editData.installmentType}
                onChange={(e) => setEditData({ ...editData, installmentType: e.target.value as any })}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="Fixed">Fixed Installment (Standard)</option>
                <option value="StepUp">Step-Up Installment (Increasing)</option>
                <option value="Auction">Auction / Dividend Based</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Commission %</label>
              <input
                type="number"
                name="commissionPercentage"
                min="0"
                max="50"
                value={editData.commissionPercentage}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setEditData({ ...editData, commissionPercentage: isNaN(val) ? 0 : Math.max(0, val) });
                }}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Start Date</label>
              <input
                type="date"
                name="startDate"
                value={editData.startDate}
                onChange={(e) => setEditData({ ...editData, startDate: e.target.value })}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">End Date</label>
              <input
                type="date"
                name="endDate"
                value={editData.endDate}
                onChange={(e) => setEditData({ ...editData, endDate: e.target.value })}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Late Fee (₹)</label>
              <input
                type="number"
                name="lateFeeAmount"
                value={editData.lateFeeAmount}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setEditData({ ...editData, lateFeeAmount: isNaN(val) ? 0 : Math.max(0, val) });
                }}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Status</label>
              <select
                value={editData.status}
                onChange={(e) => setEditData({ ...editData, status: e.target.value as any })}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="Active">Active</option>
                <option value="Draft">Draft</option>
                <option value="Upcoming">Upcoming</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Description (Optional)</label>
            <input
              type="text"
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#1F293D]">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-[#1F293D] text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editData.durationMonths < 1 || !editData.name}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition-all"
            >
              Save Configuration
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteChitModalOpen}
        onClose={() => setIsDeleteChitModalOpen(false)}
        title="Delete Chit Scheme"
        subtitle="This action is destructive and cannot be undone."
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-300">
            Are you sure you want to delete the chit scheme{' '}
            <strong className="text-rose-400 font-bold">{scheme.name}</strong>?
          </p>
          <div className="p-3 bg-[#0B0F17] border border-rose-500/30 rounded-xl space-y-1">
            <span className="text-[11px] text-rose-400 font-semibold block">Destructive Deletion Summary:</span>
            <p className="text-slate-400">
              Scheme Value: <strong className="text-slate-200">₹{scheme.chitAmount.toLocaleString('en-IN')}</strong>
            </p>
            <p className="text-slate-400">
              Duration: <strong className="text-slate-200">{scheme.durationMonths} Months</strong>
            </p>
            <p className="text-slate-400 text-[11px]">
              All generated monthly periods for this chit scheme will be deleted.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-[#1F293D]">
            <button
              type="button"
              onClick={() => setIsDeleteChitModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-[#1F293D] text-slate-300 hover:bg-[#2B3952] text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canDeleteChit) return;
                deleteChit(scheme.id);
                setIsDeleteChitModalOpen(false);
                navigate('/chits');
              }}
              disabled={!canDeleteChit}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-lg shadow-rose-600/30 transition-all"
            >
              Confirm & Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
