import React, { useState, useEffect } from 'react';
import { useChit } from '@/shared/context/ChitContext';
import { useAuth, PERMISSIONS, ALL_PERMISSIONS, Permission, DEFAULT_ROLE_PERMISSIONS } from '@/features/auth';
import {
  Building2,
  Sliders,
  Receipt,
  Shield,
  Save,
  Check,
  Users,
  Lock,
  CheckSquare,
  Square,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { UserManagementTable, PERMISSION_MODULE_GROUPS } from '../components/UserManagementTable';

export const Settings: React.FC = () => {
  const { companySettings, updateCompanySettings, addToast } = useChit();
  const { hasPermission, isSuperAdmin, getRoleDefaults, updateRoleDefaults } = useAuth();

  // Super Admin is the ONLY role permitted to view or manage Users and Role Permissions Matrix
  const canManageUsers = isSuperAdmin();
  const canEditSettings = isSuperAdmin() || hasPermission(PERMISSIONS.SETTINGS_EDIT);

  const [activeSection, setActiveSection] = useState<
    'Company' | 'Chit Rules' | 'Receipt' | 'User Management' | 'User Permissions'
  >('Company');

  // Interactive Staff Role Defaults state for Role Permissions Matrix
  const [staffDefaults, setStaffDefaults] = useState<Permission[]>(() => getRoleDefaults('Staff'));
  const [isSavedFeedback, setIsSavedFeedback] = useState(false);

  // Sync latest defaults whenever tab is opened
  useEffect(() => {
    if (activeSection === 'User Permissions') {
      setStaffDefaults(getRoleDefaults('Staff'));
    }
  }, [activeSection, getRoleDefaults]);

  // If a non-Super Admin somehow tries to access User sections, guard and fallback to Company
  useEffect(() => {
    if (!canManageUsers && (activeSection === 'User Management' || activeSection === 'User Permissions')) {
      setActiveSection('Company');
    }
  }, [canManageUsers, activeSection]);

  const [formData, setFormData] = useState({ ...companySettings });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'number') {
      setFormData((prev) => ({ ...prev, [name]: Number(value) }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditSettings) return;
    updateCompanySettings(formData);
    addToast('Success', 'Company settings updated successfully', 'success');
  };

  type SettingSection = 'Company' | 'Chit Rules' | 'Receipt' | 'User Management' | 'User Permissions';

  // Only Super Admin can see User Management and Role Permissions Matrix tabs
  const allSections: { id: SettingSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'Company', label: 'Company Settings', icon: Building2 },
    { id: 'Chit Rules', label: 'Chit Rules & Penalties', icon: Sliders },
    { id: 'Receipt', label: 'Receipt Customization', icon: Receipt },
    ...(canManageUsers
      ? [
          { id: 'User Management' as const, label: 'User Management', icon: Users },
          { id: 'User Permissions' as const, label: 'Role Permissions Matrix', icon: Shield },
        ]
      : []),
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-10 w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-100 tracking-tight">Admin Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Configure company profiles, chit rules, receipt headers, and RBAC</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Nav (4 cols) */}
        <div className="md:col-span-4 space-y-2">
          <div className="bg-[#121827] border border-[#1F293D] p-2 rounded-2xl space-y-1">
            {allSections.map((sec) => {
              const Icon = sec.icon;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    activeSection === sec.id
                      ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#182032]'
                  }`}
                >
                  <Icon className="w-4 h-4 text-blue-400" />
                  {sec.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Form (8 cols) */}
        <div className="md:col-span-8">
          <div className="bg-[#121827] border border-[#1F293D] p-6 rounded-2xl shadow-xl">
            {/* Section 1: Company Settings */}
            {activeSection === 'Company' && (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <h3 className="text-sm font-bold text-slate-100 pb-3 border-b border-[#1F293D]">
                  Company Profile & Branding
                </h3>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Company Name</label>
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Phone Number</label>
                    <input
                      type="text"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">GST Number</label>
                  <input
                    type="text"
                    name="gstNumber"
                    value={formData.gstNumber}
                    onChange={handleChange}
                    className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Office Address</label>
                  <textarea
                    name="address"
                    rows={3}
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl p-3 text-slate-200"
                  />
                </div>

                <div className="pt-4 border-t border-[#1F293D] flex justify-end">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30"

                  >
                    <Save className="w-4 h-4" /> Save Company Settings
                  </button>
                </div>
              </form>
            )}

            {/* Section 2: Chit Rules */}
            {activeSection === 'Chit Rules' && (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <h3 className="text-sm font-bold text-slate-100 pb-3 border-b border-[#1F293D]">
                  Chit Commission & Penalty Rules
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Default Commission %</label>
                    <input
                      type="number"
                      name="defaultCommission"
                      value={formData.defaultCommission}
                      onChange={handleChange}
                      className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Grace Period (Days)</label>
                    <input
                      type="number"
                      name="gracePeriod"
                      value={formData.gracePeriod}
                      onChange={handleChange}
                      className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Receipt Number Prefix</label>
                  <input
                    type="text"
                    name="receiptPrefix"
                    value={formData.receiptPrefix}
                    onChange={handleChange}
                    className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 font-mono"
                  />
                </div>

                <div className="pt-4 border-t border-[#1F293D] flex justify-end">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30"

                  >
                    <Save className="w-4 h-4" /> Save Rules
                  </button>
                </div>
              </form>
            )}

            {/* Section 3: Receipt Settings */}
            {activeSection === 'Receipt' && (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <h3 className="text-sm font-bold text-slate-100 pb-3 border-b border-[#1F293D]">
                  Receipt Design & Footer Customization
                </h3>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Receipt Header Text</label>
                  <input
                    type="text"
                    name="receiptHeader"
                    value={formData.receiptHeader}
                    onChange={handleChange}
                    className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Receipt Footer Disclaimer</label>
                  <textarea
                    name="receiptFooter"
                    rows={2}
                    value={formData.receiptFooter}
                    onChange={handleChange}
                    className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl p-3 text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Signature Line Text</label>
                  <input
                    type="text"
                    name="signatureText"
                    value={formData.signatureText}
                    onChange={handleChange}
                    className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200"
                  />
                </div>

                <div className="pt-4 border-t border-[#1F293D] flex justify-end">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30"

                  >
                    <Save className="w-4 h-4" /> Save Receipt Settings
                  </button>
                </div>
              </form>
            )}

            {/* Section 4: User Management */}
            {activeSection === 'User Management' && canManageUsers && (
              <UserManagementTable />
            )}

            {/* Section 5: Role Permissions Matrix */}
            {activeSection === 'User Permissions' && canManageUsers && (
              <div className="space-y-5 text-xs">
                {/* Header & Controls Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1F293D]">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-400" />
                      <span>Role Permissions Matrix</span>
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        Super Admin Config
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Configure baseline default permissions for the <strong>Staff</strong> role. When adding a new Staff user, these defaults will be pre-assigned automatically.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const allPerms = PERMISSION_MODULE_GROUPS.flatMap((g) => g.permissions.map((p) => p.id));
                        setStaffDefaults(allPerms);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-[#0B0F17] hover:bg-[#182032] border border-[#1F293D] text-slate-300 hover:text-white text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setStaffDefaults([])}
                      className="px-2.5 py-1.5 rounded-lg bg-[#0B0F17] hover:bg-[#182032] border border-[#1F293D] text-slate-300 hover:text-white text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      Clear All
                    </button>
                    <button
                      type="button"
                      onClick={() => setStaffDefaults(DEFAULT_ROLE_PERMISSIONS['Staff'])}
                      className="px-2.5 py-1.5 rounded-lg bg-[#0B0F17] hover:bg-[#182032] border border-[#1F293D] text-slate-300 hover:text-white text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer"
                      title="Reset to Factory Defaults"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateRoleDefaults('Staff', staffDefaults);
                        setIsSavedFeedback(true);
                        addToast('Saved', 'Staff role baseline permissions updated successfully', 'success');
                        setTimeout(() => setIsSavedFeedback(false), 4000);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Staff Defaults</span>
                    </button>
                  </div>
                </div>

                {/* Success Feedback Alert */}
                {isSavedFeedback && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-emerald-300 text-xs animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Staff role default permissions saved to LocalStorage. New Staff users will start with these permissions.</span>
                  </div>
                )}

                {/* Status Badges Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#0B0F17] border border-[#1F293D] rounded-xl text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-medium">Super Admin Role:</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 font-semibold text-[11px] flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Full Access (Immutable)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-medium">Staff Default Access:</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 font-semibold text-[11px] font-mono">
                      {staffDefaults.length} Permissions Active
                    </span>
                  </div>
                </div>

                {/* Interactive Matrix Table */}
                <div className="overflow-x-auto custom-scrollbar rounded-xl border border-[#1F293D]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#0B0F17] border-b border-[#1F293D] text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4 w-1/3">Module & Description</th>
                        <th className="py-3 px-4 w-1/6 text-center">Super Admin</th>
                        <th className="py-3 px-4 w-1/2">Staff Default Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1F293D]/50 text-[11px]">
                      {PERMISSION_MODULE_GROUPS.map((group) => {
                        const groupPermIds = group.permissions.map((p) => p.id);
                        const assignedInGroup = groupPermIds.filter((p) => staffDefaults.includes(p));
                        const isAllGroupSelected = groupPermIds.length > 0 && assignedInGroup.length === groupPermIds.length;

                        const toggleEntireGroup = () => {
                          if (isAllGroupSelected) {
                            setStaffDefaults((prev) => prev.filter((p) => !groupPermIds.includes(p)));
                          } else {
                            setStaffDefaults((prev) => Array.from(new Set([...prev, ...groupPermIds])));
                          }
                        };

                        const toggleSinglePermission = (pId: Permission) => {
                          setStaffDefaults((prev) =>
                            prev.includes(pId) ? prev.filter((p) => p !== pId) : [...prev, pId]
                          );
                        };

                        return (
                          <tr key={group.id} className="hover:bg-[#161D2C]/60 transition-colors">
                            {/* Module Info */}
                            <td className="py-3 px-4 align-top">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-100 text-xs">{group.name}</span>
                                <button
                                  type="button"
                                  onClick={toggleEntireGroup}
                                  className="text-[10px] text-blue-400 hover:text-blue-300 font-mono transition-colors cursor-pointer"
                                >
                                  {isAllGroupSelected ? 'deselect all' : 'select all'}
                                </button>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                                {group.description}
                              </p>
                              <div className="mt-1.5">
                                <span
                                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                    assignedInGroup.length === 0
                                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                                      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                  }`}
                                >
                                  {assignedInGroup.length} of {groupPermIds.length} enabled
                                </span>
                              </div>
                            </td>

                            {/* Super Admin Status */}
                            <td className="py-3 px-4 align-middle text-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-500/15 text-blue-300 font-mono text-[11px] font-semibold border border-blue-500/30">
                                <Lock className="w-3 h-3 text-blue-400" /> Full Access
                              </span>
                            </td>

                            {/* Staff Default Permissions (Checkboxes) */}
                            <td className="py-3 px-4 align-middle">
                              <div className="flex flex-wrap gap-2">
                                {group.permissions.map((p) => {
                                  const isChecked = staffDefaults.includes(p.id);
                                  return (
                                    <label
                                      key={p.id}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        toggleSinglePermission(p.id);
                                      }}
                                      className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all select-none perm-label-item ${
                                        isChecked
                                          ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-950 dark:text-blue-200 border-blue-300 dark:border-blue-500/40 shadow-sm perm-label-checked'
                                          : 'bg-white dark:bg-[#0B0F17] text-slate-700 dark:text-slate-400 border-slate-200 dark:border-[#1F293D] hover:border-slate-400 hover:text-slate-900 dark:hover:text-slate-300'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}}
                                        className="sr-only"
                                      />
                                      {isChecked ? (
                                        <CheckSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                                      ) : (
                                        <Square className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                                      )}
                                      <span className={`text-[11px] font-bold ${isChecked ? 'text-blue-950 dark:text-blue-100' : 'text-slate-700 dark:text-slate-400'}`}>{p.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer Notes */}
                <div className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-xl text-slate-300 text-xs leading-relaxed space-y-1.5">
                  <div className="font-bold text-blue-300 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Role Enforcement Architecture Note</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    This matrix controls the default baseline assigned when creating new Staff members. Super Admin can also fine-tune permissions individually for any specific user in the <strong>User Management</strong> table.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
