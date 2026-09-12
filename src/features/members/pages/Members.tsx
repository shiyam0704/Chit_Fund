import React, { useState } from 'react';
import { useChit } from '@/shared/context/ChitContext';
import { useAuth, PERMISSIONS } from '@/features/auth';
import { StatusBadge, Modal } from '@/shared/components/ui';
import { Member, MemberStatus } from '@/types';
import { useNavigate, NavLink } from 'react-router-dom';
import { Search, Filter, Plus, Eye, Phone, Wallet, ShieldCheck, Edit, Trash2, AlertTriangle } from 'lucide-react';

export const Members: React.FC = () => {
  const { members, chits, addMember, updateMember, deleteMember, transactions, assignMembersToChit, getChitEnrolledMembers } = useChit();
  const { hasPermission, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  const canCreateMember = isSuperAdmin() || hasPermission(PERMISSIONS.MEMBERS_CREATE);
  const canEditMember = isSuperAdmin() || hasPermission(PERMISSIONS.MEMBERS_EDIT);
  const canDeleteMember = isSuperAdmin() || hasPermission(PERMISSIONS.MEMBERS_DELETE);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChitFilter, setSelectedChitFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');

  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Edit Profile Member State
  const [memberToEdit, setMemberToEdit] = useState<Member | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    status: 'Active' as MemberStatus,
  });

  // Delete Member State
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  });

  const [formError, setFormError] = useState<string>('');
  const [editFormError, setEditFormError] = useState<string>('');

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!canCreateMember) {
      setFormError('You do not have permission to create members.');
      return;
    }
    if (!formData.name.trim() || !formData.phone.trim()) return;

    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setFormError('Please enter a valid phone number with at least 10 digits.');
      return;
    }

    const isDuplicate = members.some((m) => m.phone.replace(/\D/g, '') === cleanPhone);
    if (isDuplicate) {
      setFormError('A member with this phone number is already registered in the directory.');
      return;
    }

    addMember({
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      address: formData.address.trim(),
      status: 'Active',
    });

    setIsModalOpen(false);
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
    });
  };

  const handleOpenEditModal = (member: Member) => {
    if (!canEditMember) return;
    setMemberToEdit(member);
    setEditFormError('');
    setEditFormData({
      name: member.name,
      phone: member.phone,
      email: member.email || '',
      address: member.address || '',
      status: member.status || 'Active',
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditFormError('');
    if (!canEditMember) {
      setEditFormError('You do not have permission to edit members.');
      return;
    }
    if (!memberToEdit || !editFormData.name.trim() || !editFormData.phone.trim()) return;

    const cleanPhone = editFormData.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setEditFormError('Please enter a valid phone number with at least 10 digits.');
      return;
    }

    const isDuplicate = members.some(
      (m) => m.id !== memberToEdit.id && m.phone.replace(/\D/g, '') === cleanPhone
    );
    if (isDuplicate) {
      setEditFormError('Another member with this phone number already exists.');
      return;
    }

    updateMember(memberToEdit.id, {
      name: editFormData.name.trim(),
      phone: editFormData.phone.trim(),
      email: editFormData.email.trim(),
      address: editFormData.address.trim(),
      status: editFormData.status,
    });

    setMemberToEdit(null);
  };

  const filteredMembers = members.filter((m) => {
    if (m.isAssigned === false && m.name === 'Not Assigned') return false;
    if (!m.name || m.name.trim() === '') return false;

    const query = searchQuery.toLowerCase();
    const matchesSearch =
      m.name.toLowerCase().includes(query) ||
      m.phone.includes(query) ||
      m.id.toLowerCase().includes(query) ||
      (m.email && m.email.toLowerCase().includes(query)) ||
      (m.address && m.address.toLowerCase().includes(query));

    const enrolledIds = m.enrolledChitIds || (m.chitId ? [m.chitId] : []);
    const matchesChit = selectedChitFilter === 'All' || enrolledIds.includes(selectedChitFilter);
    const matchesStatus = selectedStatusFilter === 'All' || m.status === selectedStatusFilter;

    return matchesSearch && matchesChit && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">Member Directory</h1>
          <p className="text-sm text-slate-400 mt-1">Global member directory across all chit schemes</p>
        </div>

        {canCreateMember && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 transition-all self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add New Member
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="bg-[#121827] border border-[#1F293D] p-4 rounded-2xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative sm:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by name, phone, or ID (CH001)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Chit Filter */}
          <div>
            <select
              value={selectedChitFilter}
              onChange={(e) => setSelectedChitFilter(e.target.value)}
              className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Chit Schemes (Any or None)</option>
              {chits.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (₹{c.chitAmount.toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Member Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Members Directory Table */}
      <div className="bg-[#121827] border border-[#1F293D] rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100">Global Members</h3>
            <p className="text-xs text-slate-400">Showing {filteredMembers.length} registered members</p>
          </div>
          {(searchQuery || selectedChitFilter !== 'All' || selectedStatusFilter !== 'All') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedChitFilter('All');
                setSelectedStatusFilter('All');
              }}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
            >
              Reset All Filters
            </button>
          )}
        </div>

        {filteredMembers.length > 0 ? (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1F293D] text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3">Member ID</th>
                  <th className="py-3 px-3">Name</th>
                  <th className="py-3 px-3">Phone</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">Address</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Assigned Chits</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F293D]/50 text-xs">
                {filteredMembers.map((member) => {
                  const enrolledIds = member.enrolledChitIds || (member.chitId ? [member.chitId] : []);
                  const memberChits = chits.filter((c) => enrolledIds.includes(c.id));

                  return (
                    <tr
                      key={member.id}
                      onClick={() => navigate(`/members/${member.id}`)}
                      className="hover:bg-[#182032] cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-3 font-mono text-blue-400 font-bold">{member.id}</td>
                      <td className="py-3.5 px-3 font-semibold text-slate-100">{member.name}</td>
                      <td className="py-3.5 px-3 font-mono text-slate-400">{member.phone}</td>
                      <td className="py-3.5 px-3 text-slate-300">{member.email || '-'}</td>
                      <td className="py-3.5 px-3 text-slate-400 truncate max-w-[180px]" title={member.address}>
                        {member.address || '-'}
                      </td>
                      <td className="py-3.5 px-3">
                        <StatusBadge status={member.status || 'Active'} size="sm" />
                      </td>
                      <td className="py-3.5 px-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                          {memberChits.length > 0 ? (
                            memberChits.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => navigate(`/chits/${c.id}`)}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/25 hover:bg-blue-500/20 hover:border-blue-400 cursor-pointer transition-colors"
                                title={`Open ${c.name}`}
                              >
                                {c.name}
                              </button>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono px-2 py-0.5 rounded bg-[#0B0F17] border border-[#1F293D]">
                              Unassigned
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* View Action */}
                          <button
                            onClick={() => navigate(`/members/${member.id}`)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                            title="View Member Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {/* Edit Member Profile Action */}
                          {canEditMember && (
                            <button
                              onClick={() => handleOpenEditModal(member)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                              title="Edit Member Profile"
                            >
                              <Edit className="w-4 h-4 text-blue-400" />
                            </button>
                          )}
                          {/* Delete Member Action */}
                          {canDeleteMember && (
                            <button
                              onClick={() => setMemberToDelete(member)}
                              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                              title="Delete Member"
                            >
                              <Trash2 className="w-4 h-4 text-rose-400" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 space-y-3">
            <p className="text-slate-400 text-sm">No members found matching your search or filter criteria.</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedChitFilter('All');
                setSelectedStatusFilter('All');
              }}
              className="px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500 text-blue-300 text-xs font-semibold hover:bg-blue-600 hover:text-white transition-colors"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add New Member"
        subtitle="Register a new member to the Member Directory"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Full Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Kumar"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Phone Number <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="9876543210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Email</label>
            <input
              type="email"
              placeholder="ramesh@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Address</label>
            <input
              type="text"
              placeholder="Full address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#1F293D]">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-[#1F293D] text-slate-300 text-xs font-semibold hover:bg-[#2B3952] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30"
            >
              Add Member
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Member Profile Modal */}
      <Modal
        isOpen={!!memberToEdit}
        onClose={() => setMemberToEdit(null)}
        title="Edit Member"
        subtitle={`Update profile information for ${memberToEdit?.id}`}
      >
        {memberToEdit && (
          <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
            {editFormError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editFormError}</span>
              </div>
            )}
            <div>
              <label className="block text-slate-300 font-medium mb-1">Member ID</label>
              <input
                type="text"
                disabled
                value={memberToEdit.id}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-400 font-mono text-xs cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Member ID is fixed and read-only</span>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Full Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Suresh Kumar"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Phone Number</label>
                <input
                  type="text"
                  required
                  placeholder="9876543210"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="suresh@example.com"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Address</label>
              <input
                type="text"
                placeholder="Full address"
                value={editFormData.address}
                onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Member Status</label>
              <select
                value={editFormData.status}
                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as MemberStatus })}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#1F293D]">
              <button
                type="button"
                onClick={() => setMemberToEdit(null)}
                className="px-4 py-2 rounded-xl bg-[#1F293D] text-slate-300 text-xs font-semibold hover:bg-[#2B3952] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Member Confirmation Modal */}
      <Modal
        isOpen={!!memberToDelete}
        onClose={() => setMemberToDelete(null)}
        title="Delete Member"
        subtitle="Confirm member removal or safe deactivation"
      >
        {memberToDelete && (() => {
          const hasTransactions = transactions.some((t) => t.memberId === memberToDelete.id);
          const hasAssignments = chits.some((c) =>
            Object.values(c.monthMemberAssignments || {}).some((val) =>
              Array.isArray(val) ? val.includes(memberToDelete.id) : val === memberToDelete.id
            )
          );
          const hasHistory = hasTransactions || hasAssignments;

          return (
            <div className="space-y-4 text-xs">
              <p className="text-slate-300">
                Are you sure you want to delete member <strong className="text-slate-100 font-bold">{memberToDelete.name}</strong>?
              </p>

              <div className="p-3 bg-[#0B0F17] border border-[#1F293D] rounded-xl space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between text-slate-400">
                  <span>Member ID:</span>
                  <span className="text-blue-400 font-bold">{memberToDelete.id}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Name:</span>
                  <span className="text-slate-200">{memberToDelete.name}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Phone:</span>
                  <span className="text-slate-200">{memberToDelete.phone}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Chit Scheme:</span>
                  <span className="text-slate-200">{memberToDelete.chitName}</span>
                </div>
              </div>

              {hasHistory ? (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1 text-amber-300 text-[11px]">
                  <div className="flex items-center gap-1.5 font-bold text-amber-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> Historical Financial Records Found
                  </div>
                  <p className="text-slate-300 leading-relaxed mt-1">
                    This member has existing chit/payment history. Deleting will safely <strong>deactivate</strong> the member profile while preserving all payment and collection records for data integrity.
                  </p>
                </div>
              ) : (
                <p className="text-slate-400 text-[11px]">
                  This action will permanently delete the member from the directory.
                </p>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-[#1F293D]">
                <button
                  type="button"
                  onClick={() => setMemberToDelete(null)}
                  className="px-4 py-2 rounded-xl bg-[#1F293D] text-slate-300 text-xs font-semibold hover:bg-[#2B3952] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!canDeleteMember) return;
                    deleteMember(memberToDelete.id);
                    setMemberToDelete(null);
                  }}
                  disabled={!canDeleteMember}
                  className={`px-5 py-2 rounded-xl text-white text-xs font-semibold shadow-lg transition-all ${
                    hasHistory
                      ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                      : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                  }`}
                >
                  {hasHistory ? 'Deactivate Member Safely' : 'Delete Member'}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};
