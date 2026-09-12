import React, { useState, useEffect } from 'react';
import { useChit } from '@/shared/context/ChitContext';
import { useAuth, PERMISSIONS } from '@/features/auth';
import { exportTableToPdf, exportTableToCsv } from '../utils/exportUtils';
import { parseDate, filterByDate } from '@/shared/utils/dateUtils';
import {
  FileBarChart,
  Download,
  Printer,
  FileSpreadsheet,
  Search,
  RotateCcw,
  Calendar,
  Filter,
} from 'lucide-react';

const REPORT_TYPES = [
  'Daily Collection',
  'Monthly Collection',
  'Chit-wise Collection',
  'Member Payment Report',
  'Pending Report',
  'Overdue Report',
  'Staff Collection Report',
] as const;

type ReportType = (typeof REPORT_TYPES)[number];

export const Reports: React.FC = () => {
  const { transactions, chits, members, addToast } = useChit();
  const { hasPermission, isSuperAdmin } = useAuth();
  const canExport = isSuperAdmin() || hasPermission(PERMISSIONS.REPORTS_EXPORT);

  const [reportType, setReportType] = useState<ReportType>('Daily Collection');
  const [dateFilter, setDateFilter] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [schemeFilter, setSchemeFilter] = useState('All');
  const [modeFilter, setModeFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    if (fromDate && toDate) {
      const start = parseDate(fromDate);
      const end = parseDate(toDate);
      if (start && end && start.getTime() > end.getTime()) {
        setDateError('From Date cannot be after To Date');
      } else {
        setDateError('');
      }
    } else {
      setDateError('');
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [reportType, dateFilter, fromDate, toDate, schemeFilter, modeFilter, searchQuery]);

  const hasActiveFilters =
    dateFilter !== 'All' ||
    fromDate !== '' ||
    toDate !== '' ||
    schemeFilter !== 'All' ||
    modeFilter !== 'All' ||
    searchQuery !== '';

  const handleResetFilters = () => {
    setDateFilter('All');
    setFromDate('');
    setToDate('');
    setSchemeFilter('All');
    setModeFilter('All');
    setSearchQuery('');
    setDateError('');
    setCurrentPage(1);
  };

  const handleQuickDate = (val: string) => {
    setDateFilter(val);
    const now = new Date();
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (val === 'All') {
      setFromDate('');
      setToDate('');
    } else if (val === 'Today') {
      const todayStr = fmt(now);
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (val === 'Yesterday') {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      const yStr = fmt(y);
      setFromDate(yStr);
      setToDate(yStr);
    } else if (val === 'This Week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now);
      monday.setDate(diff);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setFromDate(fmt(monday));
      setToDate(fmt(sunday));
    } else if (val === 'This Month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFromDate(fmt(first));
      setToDate(fmt(last));
    } else if (val === 'Last Month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      setFromDate(fmt(first));
      setToDate(fmt(last));
    }
  };

  const matchesDate = (dateStr?: string | null) => {
    if (dateError) return false;
    if (!dateStr || dateStr === '-') return true;
    if (fromDate || toDate) {
      const parsed = parseDate(dateStr);
      if (!parsed) return true;
      if (fromDate) {
        const start = parseDate(fromDate);
        if (start) {
          start.setHours(0, 0, 0, 0);
          if (parsed.getTime() < start.getTime()) return false;
        }
      }
      if (toDate) {
        const end = parseDate(toDate);
        if (end) {
          end.setHours(23, 59, 59, 999);
          if (parsed.getTime() > end.getTime()) return false;
        }
      }
      return true;
    }
    return dateFilter === 'All' || filterByDate(dateStr, dateFilter);
  };

  const matchesScheme = (chitId?: string | null, chitName?: string | null) => {
    if (schemeFilter === 'All') return true;
    return chitId === schemeFilter || chitName === schemeFilter || chitName?.toLowerCase() === schemeFilter.toLowerCase();
  };

  const matchesMode = (mode?: string | null) => {
    if (modeFilter === 'All') return true;
    if (!mode) return false;
    const m = mode.toLowerCase();
    const filter = modeFilter.toLowerCase();
    return m === filter || (filter === 'bank' && m.includes('bank'));
  };

  // Filtered collections
  const getFilteredTransactions = () => {
    if (dateError) return [];
    return transactions.filter((t) => {
      if (t.type === 'Payout') return false;
      const q = searchQuery.toLowerCase().trim();
      const textMatch =
        !q ||
        t.memberName.toLowerCase().includes(q) ||
        t.memberId.toLowerCase().includes(q) ||
        t.receiptNo.toLowerCase().includes(q) ||
        t.chitName.toLowerCase().includes(q) ||
        (t.collectedBy || '').toLowerCase().includes(q);
      const schemeMatch = matchesScheme(t.chitId, t.chitName);
      const modeMatch = matchesMode(t.paymentMode);
      const dateMatch = matchesDate(t.date);
      return textMatch && schemeMatch && modeMatch && dateMatch;
    });
  };

  // Filtered schemes
  const getFilteredChits = () => {
    if (dateError) return [];
    return chits.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const textMatch = !q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
      const schemeMatch = matchesScheme(c.id, c.name);
      const dateMatch = matchesDate(c.startDate);
      return textMatch && schemeMatch && dateMatch;
    });
  };

  // Filtered members
  const getFilteredMembers = () => {
    if (dateError) return [];
    return members.filter((m) => {
      const q = searchQuery.toLowerCase().trim();
      const textMatch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        m.chitName.toLowerCase().includes(q);
      const schemeMatch = matchesScheme(m.chitId, m.chitName);
      let modeMatch = true;
      if (modeFilter !== 'All') {
        modeMatch = transactions.some((t) => t.type !== 'Payout' && t.memberId === m.id && matchesMode(t.paymentMode));
      }
      const statusMatch = reportType === 'Overdue Report' ? m.paymentStatus === 'Overdue' : m.pendingAmount > 0;
      const dateMatch = matchesDate(m.joinedDate);
      return textMatch && schemeMatch && modeMatch && statusMatch && dateMatch;
    });
  };

  const getReportData = () => {
    switch (reportType) {
      case 'Chit-wise Collection':
        return getFilteredChits();
      case 'Pending Report':
      case 'Overdue Report':
        return getFilteredMembers();
      default:
        return getFilteredTransactions();
    }
  };

  const getExportPayload = () => {
    switch (reportType) {
      case 'Chit-wise Collection': {
        const rows = getFilteredChits().map((c) => [
          c.name,
          `Rs. ${c.chitAmount.toLocaleString('en-IN')}`,
          `${members.filter((m) => m.chitId === c.id && m.name !== 'Not Assigned').length} Members`,
          `Rs. ${c.collectedAmount.toLocaleString('en-IN')}`,
          `Rs. ${c.pendingAmount.toLocaleString('en-IN')}`,
          c.status,
        ]);
        return {
          headers: ['Chit Scheme', 'Chit Value', 'Members', 'Collected Amount', 'Pending Amount', 'Status'],
          rows,
          filename: 'chit-collection-report',
        };
      }
      case 'Pending Report':
      case 'Overdue Report': {
        const rows = getFilteredMembers().map((m) => [
          m.id,
          m.name,
          m.phone,
          m.chitName,
          `Rs. ${m.monthlyDue.toLocaleString('en-IN')}`,
          `Rs. ${m.totalPaid.toLocaleString('en-IN')}`,
          `Rs. ${m.pendingAmount.toLocaleString('en-IN')}`,
          m.paymentStatus,
        ]);
        return {
          headers: ['Member ID', 'Name', 'Phone', 'Chit Scheme', 'Monthly Due', 'Total Paid', 'Pending Amount', 'Payment Status'],
          rows,
          filename: `${reportType.toLowerCase().replace(/\s+/g, '-')}-report`,
        };
      }
      default: {
        const rows = getFilteredTransactions().map((t) => [
          t.date,
          t.receiptNo,
          t.memberName,
          t.chitName,
          `Rs. ${t.amount.toLocaleString('en-IN')}`,
          t.paymentMode,
          t.collectedBy || '-',
          t.status || '-',
        ]);
        return {
          headers: ['Date', 'Receipt No', 'Member', 'Chit Scheme', 'Amount', 'Mode', 'Staff', 'Status'],
          rows,
          filename: `${reportType.toLowerCase().replace(/\s+/g, '-')}-report`,
        };
      }
    }
  };

  const handleExportCsv = () => {
    if (!canExport) {
      addToast('Permission Denied', 'You do not have permission to export reports.', 'error');
      return;
    }
    const { headers, rows, filename } = getExportPayload();
    exportTableToCsv({ filename, headers, rows });
    addToast('Excel Export', `${reportType} exported to CSV (${rows.length} records)`, 'success');
  };

  const handleExportPdf = () => {
    if (!canExport) {
      addToast('Permission Denied', 'You do not have permission to export reports.', 'error');
      return;
    }
    const { headers, rows, filename } = getExportPayload();
    const dateSub = fromDate && toDate ? `${fromDate} to ${toDate}` : dateFilter === 'All' ? 'All Dates' : dateFilter;
    const schemeSub = schemeFilter === 'All' ? 'All Schemes' : chits.find((c) => c.id === schemeFilter)?.name || schemeFilter;

    exportTableToPdf({
      title: `${reportType} Report`,
      subtitle: `Date Range: ${dateSub} | Scheme: ${schemeSub} | Mode: ${modeFilter} | Filtered Records: ${rows.length}`,
      headers,
      rows,
      filename,
      summaryStats: [
        { label: 'Report Type', value: reportType },
        { label: 'Total Records', value: rows.length },
        { label: 'Filter Scheme', value: schemeSub },
        { label: 'Filter Mode', value: modeFilter },
      ],
    });
    addToast('PDF Export', `${reportType} exported as PDF (${rows.length} records)`, 'success');
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">Reports</h1>
          <p className="text-sm text-slate-400 mt-1">Generate collection & financial audit reports</p>
        </div>

        {canExport && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#121827] border border-[#1F293D] hover:border-emerald-500/40 text-emerald-400 text-xs font-semibold transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>
            <button
              onClick={handleExportPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#121827] border border-[#1F293D] hover:border-blue-500/40 text-blue-400 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>
            <button
              onClick={() => {
                if (!canExport) {
                  addToast('Permission Denied', 'You do not have permission to print reports.', 'error');
                  return;
                }
                handleExportPdf();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Report</span>
            </button>
          </div>
        )}
      </div>

      {/* Report Types Tabs */}
      <div className="bg-[#121827] border border-[#1F293D] p-3 rounded-2xl">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">
          Select Report Type
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {REPORT_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setReportType(type)}
              className={`p-2.5 rounded-xl text-xs font-semibold text-left transition-all cursor-pointer ${
                reportType === type
                  ? 'bg-blue-600/20 border border-blue-500 text-blue-300 shadow-md'
                  : 'bg-[#0B0F17] border border-[#1F293D] text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#121827] border border-[#1F293D] p-4 rounded-2xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Quick Date Range */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Date Filter</label>
            <select
              value={dateFilter}
              onChange={(e) => handleQuickDate(e.target.value)}
              className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Dates</option>
              <option value="Today">Today</option>
              <option value="Yesterday">Yesterday</option>
              <option value="This Week">This Week</option>
              <option value="This Month">This Month</option>
              <option value="Last Month">Last Month</option>
            </select>
          </div>

          {/* Scheme Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Chit Scheme</label>
            <select
              value={schemeFilter}
              onChange={(e) => setSchemeFilter(e.target.value)}
              className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Schemes</option>
              {chits.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Mode Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Payment Mode</label>
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Modes</option>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>

          {/* Search Query */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Search</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search member, txn, staff..."
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Custom Date Pickers */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#1F293D]/60 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-[#0B0F17] border border-[#1F293D] rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-[#0B0F17] border border-[#1F293D] rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            {dateError && <span className="text-rose-400 text-xs">{dateError}</span>}
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#182032] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats Row */}
      {(() => {
        const data = getReportData();
        if (reportType === 'Chit-wise Collection') {
          const list = data as typeof chits;
          const totalVal = list.reduce((sum, c) => sum + c.chitAmount, 0);
          const totalCol = list.reduce((sum, c) => sum + c.collectedAmount, 0);
          const totalPen = list.reduce((sum, c) => sum + c.pendingAmount, 0);
          return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#121827] border border-[#1F293D] p-3.5 rounded-xl">
                <p className="text-[11px] text-slate-400 font-medium">Total Schemes</p>
                <p className="text-lg font-bold text-slate-100 font-mono mt-0.5">{list.length}</p>
              </div>
              <div className="bg-[#121827] border border-[#1F293D] p-3.5 rounded-xl">
                <p className="text-[11px] text-slate-400 font-medium">Total Chit Value</p>
                <p className="text-lg font-bold text-blue-400 font-mono mt-0.5">₹{totalVal.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-[#121827] border border-[#1F293D] p-3.5 rounded-xl">
                <p className="text-[11px] text-slate-400 font-medium">Total Collected</p>
                <p className="text-lg font-bold text-emerald-400 font-mono mt-0.5">₹{totalCol.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-[#121827] border border-[#1F293D] p-3.5 rounded-xl">
                <p className="text-[11px] text-slate-400 font-medium">Total Pending</p>
                <p className="text-lg font-bold text-rose-400 font-mono mt-0.5">₹{totalPen.toLocaleString('en-IN')}</p>
              </div>
            </div>
          );
        }
        if (reportType === 'Pending Report' || reportType === 'Overdue Report') {
          const list = data as typeof members;
          const totalDue = list.reduce((sum, m) => sum + m.monthlyDue, 0);
          const totalPaid = list.reduce((sum, m) => sum + m.totalPaid, 0);
          const totalPen = list.reduce((sum, m) => sum + m.pendingAmount, 0);
          return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#121827] border border-[#1F293D] p-3.5 rounded-xl">
                <p className="text-[11px] text-slate-400 font-medium">Matching Members</p>
                <p className="text-lg font-bold text-slate-100 font-mono mt-0.5">{list.length}</p>
              </div>
              <div className="bg-[#121827] border border-[#1F293D] p-3.5 rounded-xl">
                <p className="text-[11px] text-slate-400 font-medium">Monthly Dues</p>
                <p className="text-lg font-bold text-blue-400 font-mono mt-0.5">₹{totalDue.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-[#121827] border border-[#1F293D] p-3.5 rounded-xl">
                <p className="text-[11px] text-slate-400 font-medium">Total Paid</p>
                <p className="text-lg font-bold text-emerald-400 font-mono mt-0.5">₹{totalPaid.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-[#121827] border border-[#1F293D] p-3.5 rounded-xl">
                <p className="text-[11px] text-slate-400 font-medium">Total Balance</p>
                <p className="text-lg font-bold text-rose-400 font-mono mt-0.5">₹{totalPen.toLocaleString('en-IN')}</p>
              </div>
            </div>
          );
        }
        const list = data as typeof transactions;
        const totalAmount = list.reduce((sum, t) => sum + (t.amount || 0), 0);
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#121827] border border-[#1F293D] p-3.5 rounded-xl">
              <p className="text-[11px] text-slate-400 font-medium">Total Transactions</p>
              <p className="text-lg font-bold text-slate-100 font-mono mt-0.5">{list.length}</p>
            </div>
            <div className="bg-[#121827] border border-[#1F293D] p-3.5 rounded-xl">
              <p className="text-[11px] text-slate-400 font-medium">Total Collected</p>
              <p className="text-lg font-bold text-emerald-400 font-mono mt-0.5">₹{totalAmount.toLocaleString('en-IN')}</p>
            </div>
          </div>
        );
      })()}

      {/* Data Table */}
      <div className="bg-[#121827] border border-[#1F293D] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0B0F17] border-b border-[#1F293D] text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {reportType === 'Chit-wise Collection' ? (
                  <>
                    <th className="py-3.5 px-4">Chit Scheme</th>
                    <th className="py-3.5 px-4">Value</th>
                    <th className="py-3.5 px-4">Members</th>
                    <th className="py-3.5 px-4">Collected</th>
                    <th className="py-3.5 px-4">Pending</th>
                    <th className="py-3.5 px-4">Status</th>
                  </>
                ) : reportType === 'Pending Report' || reportType === 'Overdue Report' ? (
                  <>
                    <th className="py-3.5 px-4">Member</th>
                    <th className="py-3.5 px-4">Phone</th>
                    <th className="py-3.5 px-4">Scheme</th>
                    <th className="py-3.5 px-4">Monthly Due</th>
                    <th className="py-3.5 px-4">Total Paid</th>
                    <th className="py-3.5 px-4">Pending</th>
                    <th className="py-3.5 px-4">Status</th>
                  </>
                ) : (
                  <>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Receipt No</th>
                    <th className="py-3.5 px-4">Member</th>
                    <th className="py-3.5 px-4">Scheme</th>
                    <th className="py-3.5 px-4">Amount</th>
                    <th className="py-3.5 px-4">Mode</th>
                    <th className="py-3.5 px-4">Staff</th>
                    <th className="py-3.5 px-4">Status</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F293D]/60 text-slate-300">
              {(() => {
                const data = getReportData();
                if (data.length === 0) {
                  return (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                        No report records matching current filter criteria.
                      </td>
                    </tr>
                  );
                }

                if (reportType === 'Chit-wise Collection') {
                  const list = data as typeof chits;
                  return list.map((c) => (
                    <tr key={c.id} className="hover:bg-[#161E30] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-100">{c.name}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-400">
                        ₹{c.chitAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {members.filter((m) => m.chitId === c.id && m.name !== 'Not Assigned').length} Members
                      </td>
                      <td className="py-3.5 px-4 font-mono text-emerald-400">
                        ₹{c.collectedAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-rose-400">
                        ₹{c.pendingAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ));
                }

                if (reportType === 'Pending Report' || reportType === 'Overdue Report') {
                  const list = data as typeof members;
                  return list.map((m) => (
                    <tr key={m.id} className="hover:bg-[#161E30] transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-100 block">{m.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{m.id}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">{m.phone}</td>
                      <td className="py-3.5 px-4 text-blue-300">{m.chitName}</td>
                      <td className="py-3.5 px-4 font-mono">₹{m.monthlyDue.toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4 font-mono text-emerald-400">₹{m.totalPaid.toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-rose-400">
                        ₹{m.pendingAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            m.paymentStatus === 'Overdue'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {m.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ));
                }

                const list = data as typeof transactions;
                return list.map((t) => (
                  <tr key={t.id} className="hover:bg-[#161E30] transition-colors">
                    <td className="py-3.5 px-4 font-mono text-slate-400">{t.date}</td>
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-200">{t.receiptNo}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-100">{t.memberName}</td>
                    <td className="py-3.5 px-4 text-blue-300">{t.chitName}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                      ₹{t.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">{t.paymentMode}</td>
                    <td className="py-3.5 px-4 text-slate-400">{t.collectedBy || '-'}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        {t.status || 'Paid'}
                      </span>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
