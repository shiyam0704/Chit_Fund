import React, { useState } from 'react';
import { useChit } from '@/shared/context/ChitContext';
import { useAuth, PERMISSIONS } from '@/features/auth';
import { ChitScheme, InstallmentType } from '@/types';
import { StatusBadge, Modal } from '@/shared/components/ui';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Calendar, Users, ChevronRight, Trash2 } from 'lucide-react';

export const Chits: React.FC = () => {
  const { chits, members, addChit, deleteChit } = useChit();
  const { hasPermission, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  const canCreateChit = isSuperAdmin() || hasPermission(PERMISSIONS.CHITS_CREATE);
  const canDeleteChit = isSuperAdmin() || hasPermission(PERMISSIONS.CHITS_DELETE);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmChit, setDeleteConfirmChit] = useState<ChitScheme | null>(null);

  // Simple Create Chit Form State
  const [formData, setFormData] = useState<{
    name: string;
    chitAmount: number | string;
    memberCount: number | string;
    durationMonths: number | string;
    monthlyInstallment: number | string;
    description: string;
  }>({
    name: '',
    chitAmount: 500000,
    memberCount: 20,
    durationMonths: 20,
    monthlyInstallment: 0,
    description: '',
  });

  const handleOpenCreateChitModal = () => {
    setFormData({
      name: '',
      chitAmount: 500000,
      memberCount: 20,
      durationMonths: 20,
      monthlyInstallment: 0,
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === 'number') {
      const numVal = value === '' ? '' : parseFloat(value);
      setFormData((prev) => ({ ...prev, [name]: numVal }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const numTotalAmount = Number(formData.chitAmount) || 0;
  const numMemberCount = Number(formData.memberCount) || 0;
  const numDuration = Number(formData.durationMonths) || 0;
  const numMonthlyInstallment = Number(formData.monthlyInstallment) || 0;

  const isFormValid =
    formData.name.trim() !== '' &&
    numTotalAmount > 0 &&
    numMemberCount > 0 &&
    numDuration > 0 &&
    numMonthlyInstallment >= 0;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateChit || !isFormValid) return;

    const baseMonthly =
      numMonthlyInstallment > 0
        ? numMonthlyInstallment
        : Math.round(numTotalAmount / numMemberCount);

    const created = addChit({
      name: formData.name.trim(),
      chitAmount: numTotalAmount,
      memberCount: numMemberCount,
      membersCount: numMemberCount,
      durationMonths: numDuration,
      monthlyInstallment: numMonthlyInstallment,
      baseMonthlyAmount: baseMonthly,
      installmentType: 'Fixed',
      initialBidAmount: Math.round(baseMonthly * 0.27),
      bidReductionMethod: 'Auto',
      bidReductionValue: 0,
      description: formData.description ? formData.description.trim() : '',
      isConfigured: true,
      status: 'Active',
    });

    setIsModalOpen(false);
    if (created && created.id) {
      navigate(`/chits/${created.id}`);
    }
  };

  const filteredChits = chits.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">Chits</h1>
          <p className="text-sm text-slate-400 mt-1">Manage all chit schemes</p>
        </div>

        {canCreateChit && (
          <button
            onClick={handleOpenCreateChitModal}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> New Chit
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div id="chits-filter-bar" className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#121827] border border-[#1F293D] p-3 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by scheme name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="flex items-center gap-1 bg-[#0B0F17] border border-[#1F293D] p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
            {['All', 'Active', 'Completed', 'Upcoming', 'Draft'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Schemes Grid Cards */}
      {filteredChits.length > 0 ? (
        <div id="chits-cards-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
          {filteredChits.map((scheme) => {
            const collected = scheme.collectedAmount || 0;
            const pending = scheme.pendingAmount || 0;
            const totalVal = scheme.chitAmount;
            const progressPercent = Math.min(100, Math.round((collected / totalVal) * 100));
            const enrolledCount = members.filter(
              (m) => m.chitId === scheme.id && m.isAssigned !== false && m.name !== 'Not Assigned'
            ).length;

            return (
              <div
                key={scheme.id}
                className="chits-card-item bg-[#121827] border border-[#1F293D] rounded-2xl p-4.5 hover:border-blue-500/40 transition-all duration-200 shadow-xl shadow-black/20 flex flex-col justify-between group relative overflow-hidden w-full"
              >
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-lg font-bold text-blue-400 tracking-tight leading-tight">
                        {scheme.name}
                      </h3>
                      <p className="text-xs font-mono text-slate-400 font-medium mt-0.5">
                        ₹{scheme.chitAmount.toLocaleString('en-IN')} Scheme Value
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={scheme.status} />
                      {canDeleteChit && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmChit(scheme);
                          }}
                          title="Delete Chit Scheme"
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1 bg-[#0B0F17] border border-[#1F293D] py-2 px-1 rounded-xl my-2 text-center">
                    <div>
                      <p className="text-sm font-bold text-slate-100 flex items-center justify-center gap-1 font-mono">
                        <Users className="w-3.5 h-3.5 text-blue-400" /> {enrolledCount}
                      </p>
                      <span className="text-[9px] text-slate-500 uppercase font-semibold block tracking-wider mt-0.5">
                        ENROLLED
                      </span>
                    </div>
                    <div className="border-x border-[#1F293D]">
                      <p className="text-sm font-bold text-slate-100 flex items-center justify-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-blue-400" /> {scheme.durationMonths} M
                      </p>
                      <span className="text-[9px] text-slate-500 uppercase font-semibold block tracking-wider mt-0.5">
                        DURATION
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-100 font-mono mt-0.5">
                        ₹{scheme.monthlyInstallment.toLocaleString('en-IN')}
                      </p>
                      <span className="text-[9px] text-slate-500 uppercase font-semibold block tracking-wider mt-0.5">
                        MONTHLY
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-2 text-xs">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">
                        Collected: <span className="font-mono font-bold text-emerald-400">₹{collected.toLocaleString('en-IN')}</span>
                      </span>
                      <span className="text-slate-400">
                        Pending: <span className="font-mono font-bold text-rose-400">₹{pending.toLocaleString('en-IN')}</span>
                      </span>
                    </div>

                    <div className="w-full bg-[#0B0F17] h-1.5 rounded-full overflow-hidden border border-[#1F293D]">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-1 border-t border-[#1F293D]/60 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-mono">{progressPercent}% Paid</span>
                  <button
                    onClick={() => navigate(`/chits/${scheme.id}`)}
                    className="px-3 py-1.5 rounded-lg bg-[#1A2234] hover:bg-blue-600 text-slate-200 hover:text-white border border-[#26344E] hover:border-blue-500 font-semibold text-xs transition-all duration-200 flex items-center gap-1 group-hover:shadow-md group-hover:shadow-blue-600/20"
                  >
                    View Chit <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[#121827] border border-[#1F293D] rounded-2xl p-12 text-center space-y-3">
          <p className="text-slate-400 text-sm">No chit schemes match your search or filter criteria.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('All');
            }}
            className="px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500 text-blue-300 text-xs font-semibold hover:bg-blue-600 hover:text-white transition-colors"
          >
            Reset Filters
          </button>
        </div>
      )}


      {/* Create Chit Modal */}
      {/* Create Chit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Chit"
        subtitle="Configure chit details and monthly installment schedule"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {/* Row 1: Chit Name & Total Chit Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Chit Name *</label>
              <input
                type="text"
                name="name"
                required
                placeholder="e.g. ₹5 Lakh Chit"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3.5 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Total Chit Amount (₹) *</label>
              <input
                type="number"
                name="chitAmount"
                required
                min="1"
                placeholder="500000"
                value={formData.chitAmount}
                onChange={handleInputChange}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3.5 py-2.5 text-slate-200 font-mono text-sm focus:outline-none focus:border-blue-500"
              />
              <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                Formatted: ₹{numTotalAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Row 2: Number of Members & Duration (Months) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Number of Members *</label>
              <input
                type="number"
                name="memberCount"
                required
                min="1"
                max="1000"
                placeholder="20"
                value={formData.memberCount}
                onChange={handleInputChange}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3.5 py-2.5 text-slate-200 font-mono text-sm focus:outline-none focus:border-blue-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Total members participating in scheme</span>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Duration (Months) *</label>
              <input
                type="number"
                name="durationMonths"
                required
                min="1"
                max="120"
                placeholder="20"
                value={formData.durationMonths}
                onChange={handleInputChange}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3.5 py-2.5 text-slate-200 font-mono text-sm focus:outline-none focus:border-blue-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Number of months for scheme</span>
            </div>
          </div>

          {/* Row 3: Monthly Base Amount / Monthly Payment (₹) */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Monthly Base Amount / Monthly Payment (₹) *</label>
            <input
              type="number"
              name="monthlyInstallment"
              required
              min="0"
              placeholder="0"
              value={formData.monthlyInstallment}
              onChange={handleInputChange}
              className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3.5 py-2.5 text-slate-200 font-mono text-sm focus:outline-none focus:border-blue-500"
            />
            <span className="text-[10px] text-slate-400 font-mono mt-1 block">
              Default is ₹0. User enters manually. (If left 0, calculated as Total / Members)
            </span>
          </div>

          {/* Row 4: Description (Optional) */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Description (Optional)</label>
            <textarea
              name="description"
              rows={3}
              placeholder="Scheme notes or terms..."
              value={formData.description}
              onChange={handleInputChange}
              className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500 text-sm resize-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#1F293D]">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-5 py-2.5 rounded-xl bg-[#1F293D] text-slate-300 hover:bg-[#2B3952] text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isFormValid}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition-all"
            >
              Create Chit
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmChit}
        onClose={() => setDeleteConfirmChit(null)}
        title="Delete Chit Scheme"
        subtitle="This action is destructive and cannot be undone."
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-300">
            Are you sure you want to delete the scheme{' '}
            <strong className="text-rose-400 font-bold">{deleteConfirmChit?.name}</strong>?
          </p>
          <div className="p-3 bg-[#0B0F17] border border-rose-500/30 rounded-xl space-y-1">
            <span className="text-[11px] text-rose-400 font-semibold block">Destructive Deletion Summary:</span>
            <p className="text-slate-400">
              Scheme Value: <strong className="text-slate-200">₹{deleteConfirmChit?.chitAmount.toLocaleString('en-IN')}</strong>
            </p>
            <p className="text-slate-400">
              Duration: <strong className="text-slate-200">{deleteConfirmChit?.durationMonths} Months</strong>
            </p>
            <p className="text-slate-400 text-[11px]">
              All generated monthly periods for this chit scheme will be deleted.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-[#1F293D]">
            <button
              type="button"
              onClick={() => setDeleteConfirmChit(null)}
              className="px-4 py-2 rounded-xl bg-[#1F293D] text-slate-300 hover:bg-[#2B3952] text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canDeleteChit) return;
                if (deleteConfirmChit) {
                  deleteChit(deleteConfirmChit.id);
                  setDeleteConfirmChit(null);
                }
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
