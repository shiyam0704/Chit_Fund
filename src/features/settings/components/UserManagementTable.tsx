import React, { useState, useMemo } from 'react';
import { useAuth } from '@/features/auth';
import {
  UserAccount,
  UserRole,
  UserStatus,
  Permission,
  PERMISSIONS,
  ALL_PERMISSIONS,
  ROOT_SUPERADMIN_ID,
} from '@/features/auth/permissions';
import { Modal } from '@/shared/components/ui';
import {
  UserPlus,
  Shield,
  KeyRound,
  Trash2,
  Edit2,
  Check,
  Search,
  AlertTriangle,
  Lock,
  Mail,
  User,
  Power,
  Layers,
  CheckCircle2,
} from 'lucide-react';

export interface PermissionOption {
  id: Permission;
  label: string;
}

export interface ModuleGroupConfig {
  id: string;
  name: string;
  description: string;
  permissions: PermissionOption[];
}

export const PERMISSION_MODULE_GROUPS: ModuleGroupConfig[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Analytics, overview KPI statistics, and active metrics',
    permissions: [
      { id: PERMISSIONS.DASHBOARD_VIEW, label: 'Dashboard View' },
    ],
  },
  {
    id: 'chits',
    name: 'Chits',
    description: 'Chit schemes, duration, monthly auction and allocation details',
    permissions: [
      { id: PERMISSIONS.CHITS_VIEW, label: 'View' },
      { id: PERMISSIONS.CHITS_CREATE, label: 'Add' },
      { id: PERMISSIONS.CHITS_EDIT, label: 'Edit' },
      { id: PERMISSIONS.CHITS_DELETE, label: 'Delete' },
    ],
  },
  {
    id: 'members',
    name: 'Members',
    description: 'Member directory, profile details, and scheme enrollments',
    permissions: [
      { id: PERMISSIONS.MEMBERS_VIEW, label: 'View' },
      { id: PERMISSIONS.MEMBERS_CREATE, label: 'Add' },
      { id: PERMISSIONS.MEMBERS_EDIT, label: 'Edit' },
      { id: PERMISSIONS.MEMBERS_DELETE, label: 'Delete' },
    ],
  },
  {
    id: 'payments',
    name: 'Payments',
    description: 'Installment collection entries, payment status, receipts',
    permissions: [
      { id: PERMISSIONS.PAYMENTS_VIEW, label: 'View' },
      { id: PERMISSIONS.PAYMENTS_CREATE, label: 'Add Payment' },
      { id: PERMISSIONS.PAYMENTS_EDIT, label: 'Edit Payment' },
      { id: PERMISSIONS.PAYMENTS_DELETE, label: 'Delete Payment' },
    ],
  },
  {
    id: 'reports',
    name: 'Reports',
    description: 'Collection reports, overdue reports, ledger analysis, PDF/CSV export',
    permissions: [
      { id: PERMISSIONS.REPORTS_VIEW, label: 'View' },
      { id: PERMISSIONS.REPORTS_EXPORT, label: 'Export' },
    ],
  },
  {
    id: 'settings',
    name: 'Settings',
    description: 'Company profiles, business rules, receipt styling',
    permissions: [
      { id: PERMISSIONS.SETTINGS_VIEW, label: 'View' },
      { id: PERMISSIONS.SETTINGS_EDIT, label: 'Edit' },
    ],
  },
  {
    id: 'users',
    name: 'User Management',
    description: 'Staff accounts, roles, access permissions, password resets',
    permissions: [
      { id: PERMISSIONS.USERS_VIEW, label: 'View Users' },
      { id: PERMISSIONS.USERS_CREATE, label: 'Add User' },
      { id: PERMISSIONS.USERS_EDIT, label: 'Edit User' },
      { id: PERMISSIONS.USERS_DELETE, label: 'Delete User' },
      { id: PERMISSIONS.USERS_MANAGE_PERMISSIONS, label: 'Manage Permissions' },
      { id: PERMISSIONS.USERS_RESET_PASSWORD, label: 'Reset Password' },
    ],
  },
  {
    id: 'role_permissions',
    name: 'Role Permissions',
    description: 'Configure and enforce default role matrix policies',
    permissions: [
      { id: PERMISSIONS.USERS_ROLE_PERMISSIONS, label: 'Role Permissions' },
    ],
  },
];

/**
 * Reusable permission selector grid displaying all modules and action-level checkboxes
 */
const PermissionModuleGrid: React.FC<{
  selectedPermissions: Set<Permission>;
  onToggle: (p: Permission) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onResetDefaults?: () => void;
  isSuperAdminRole?: boolean;
}> = ({ selectedPermissions, onToggle, onSelectAll, onClearAll, onResetDefaults, isSuperAdminRole }) => {
  return (
    <div className="space-y-3 pt-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-[#0B0F17] border border-[#1F293D] rounded-xl">
        <div className="flex items-center gap-2">
          <span className="text-slate-300 font-semibold text-xs">
            Access Permissions:
          </span>
          {isSuperAdminRole ? (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-100 dark:bg-purple-500/15 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30">
              Full Access (Immutable)
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30">
              {selectedPermissions.size} Permissions Selected
            </span>
          )}
        </div>

        {!isSuperAdminRole && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={onSelectAll}
              className="px-2.5 py-1 rounded-lg bg-[#161D2F] hover:bg-[#20293F] text-blue-300 border border-blue-500/30 font-semibold text-[11px] cursor-pointer transition-colors"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={onClearAll}
              className="px-2.5 py-1 rounded-lg bg-[#161D2F] hover:bg-[#20293F] text-slate-400 hover:text-slate-200 border border-[#26344E] font-semibold text-[11px] cursor-pointer transition-colors"
            >
              Clear All
            </button>
            {onResetDefaults && (
              <button
                type="button"
                onClick={onResetDefaults}
                className="px-2.5 py-1 rounded-lg bg-[#161D2F] hover:bg-[#20293F] text-emerald-400 border border-emerald-500/30 font-semibold text-[11px] cursor-pointer transition-colors"
              >
                Reset to Defaults
              </button>
            )}
          </div>
        )}
      </div>

      {isSuperAdminRole && (
        <div className="p-3 rounded-xl bg-purple-100/70 dark:bg-purple-500/10 border border-purple-300 dark:border-purple-500/30 text-purple-900 dark:text-purple-200 text-xs">
          <strong className="text-purple-950 dark:text-purple-100">Super Admin Account:</strong> Full Access is granted across all system modules and actions by default.
        </div>
      )}

      <div className="space-y-2.5 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
        {PERMISSION_MODULE_GROUPS.map((group) => {
          const groupPermIds = group.permissions.map((p) => p.id);
          const allChecked = groupPermIds.every((id) => selectedPermissions.has(id));

          const toggleAllGroup = () => {
            if (isSuperAdminRole) return;
            if (allChecked) {
              groupPermIds.forEach((id) => {
                if (selectedPermissions.has(id)) onToggle(id);
              });
            } else {
              groupPermIds.forEach((id) => {
                if (!selectedPermissions.has(id)) onToggle(id);
              });
            }
          };

          return (
            <div
              key={group.id}
              className="bg-[#0B0F17] border border-[#1F293D] rounded-xl p-3 space-y-2 transition-colors hover:border-slate-700"
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-[#1F293D]/60">
                <div>
                  <span className="font-bold text-slate-100 text-xs uppercase tracking-wide">
                    {group.name}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-2 hidden sm:inline">
                    {group.description}
                  </span>
                </div>
                {!isSuperAdminRole && group.permissions.length > 1 && (
                  <button
                    type="button"
                    onClick={toggleAllGroup}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 transition-colors cursor-pointer"
                  >
                    {allChecked ? 'Uncheck All' : 'Select All'}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
                {group.permissions.map((perm) => {
                  const checked = isSuperAdminRole || selectedPermissions.has(perm.id);
                  return (
                    <label
                      key={perm.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs select-none transition-all cursor-pointer perm-label-item ${
                        checked
                          ? 'bg-blue-50 dark:bg-blue-600/15 border-blue-300 dark:border-blue-500/40 text-blue-950 dark:text-blue-200 font-bold shadow-sm perm-label-checked'
                          : 'bg-white dark:bg-[#121827] border-slate-200 dark:border-[#1F293D] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#182032] hover:text-slate-900 dark:hover:text-white'
                      } ${isSuperAdminRole ? 'cursor-default' : ''}`}
                    >
                      <input
                        type="checkbox"
                        disabled={isSuperAdminRole}
                        checked={checked}
                        onChange={() => onToggle(perm.id)}
                        className="w-4 h-4 rounded border-slate-400 dark:border-[#243048] text-blue-600 focus:ring-0 focus:ring-offset-0 bg-white dark:bg-[#0B0F17] cursor-pointer accent-blue-600 shrink-0"
                      />
                      <span className={`text-[11px] leading-tight truncate font-bold ${checked ? 'text-blue-950 dark:text-blue-100' : 'text-slate-700 dark:text-slate-300'}`} title={perm.label}>
                        {perm.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const UserManagementTable: React.FC = () => {
  const {
    users,
    createUser,
    updateUser,
    updateUserPermissions,
    resetUserPassword,
    toggleUserStatus,
    deleteUser,
    getRoleDefaults,
  } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Modal States
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [permissionsUser, setPermissionsUser] = useState<UserAccount | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserAccount | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserAccount | null>(null);

  // Form States
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'Staff' as UserRole,
    customRoleName: '',
    status: 'Active' as UserStatus,
  });
  const [addPermissions, setAddPermissions] = useState<Set<Permission>>(new Set());
  const [addFormError, setAddFormError] = useState('');

  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: 'Staff' as UserRole,
    customRoleName: '',
    status: 'Active' as UserStatus,
  });
  const [editPermissions, setEditPermissions] = useState<Set<Permission>>(new Set());
  const [editFormError, setEditFormError] = useState('');

  const [modalPermissions, setModalPermissions] = useState<Set<Permission>>(new Set());

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState('');

  const [actionSuccessMessage, setActionSuccessMessage] = useState<string>('');

  const showNotification = (msg: string) => {
    setActionSuccessMessage(msg);
    setTimeout(() => setActionSuccessMessage(''), 4000);
  };

  // Filtered User List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q);

      const matchesRole = roleFilter === 'All' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'All' || u.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // ---------------------------------------------------------------------------
  // HANDLERS: ADD USER
  // ---------------------------------------------------------------------------
  const handleOpenAddUser = () => {
    setAddForm({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'Staff',
      customRoleName: '',
      status: 'Active',
    });
    setAddPermissions(new Set(getRoleDefaults('Staff')));
    setAddFormError('');
    setIsAddUserModalOpen(true);
  };

  const handleAddRoleChange = (newRole: UserRole) => {
    setAddForm((prev) => ({ ...prev, role: newRole }));
    if (newRole === 'Super Admin') {
      setAddPermissions(new Set(ALL_PERMISSIONS));
    } else {
      setAddPermissions(new Set(getRoleDefaults(newRole)));
    }
  };

  const handleToggleAddPermission = (p: Permission) => {
    setAddPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddFormError('');

    if (!addForm.name.trim() || !addForm.email.trim()) {
      setAddFormError('Full Name and Login Email / Username are required.');
      return;
    }

    if (!addForm.password || addForm.password.length < 4) {
      setAddFormError('Password must be at least 4 characters.');
      return;
    }

    if (addForm.password !== addForm.confirmPassword) {
      setAddFormError('Passwords do not match.');
      return;
    }

    const assignedPermissions =
      addForm.role === 'Super Admin'
        ? [...ALL_PERMISSIONS]
        : Array.from(addPermissions);

    const result = createUser({
      name: addForm.name.trim(),
      email: addForm.email.trim(),
      password: addForm.password,
      role: addForm.role,
      customRoleName: addForm.customRoleName.trim() || undefined,
      status: addForm.status,
      permissions: assignedPermissions,
    });

    if (result.success) {
      setIsAddUserModalOpen(false);
      showNotification(`User account "${addForm.name.trim()}" created successfully.`);
    } else {
      setAddFormError(result.message || 'Failed to create user.');
    }
  };

  // ---------------------------------------------------------------------------
  // HANDLERS: EDIT USER
  // ---------------------------------------------------------------------------
  const handleOpenEditUser = (u: UserAccount) => {
    setEditingUser(u);
    setEditForm({
      name: u.name,
      email: u.email,
      role: u.role,
      customRoleName: u.customRoleName || '',
      status: u.status,
    });
    setEditPermissions(new Set(u.role === 'Super Admin' ? ALL_PERMISSIONS : u.permissions));
    setEditFormError('');
  };

  const handleEditRoleChange = (newRole: UserRole) => {
    setEditForm((prev) => ({ ...prev, role: newRole }));
    if (newRole === 'Super Admin') {
      setEditPermissions(new Set(ALL_PERMISSIONS));
    } else {
      setEditPermissions(new Set(getRoleDefaults(newRole)));
    }
  };

  const handleToggleEditPermission = (p: Permission) => {
    setEditPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditFormError('');

    if (!editForm.name.trim() || !editForm.email.trim()) {
      setEditFormError('Full Name and Email / Username are required.');
      return;
    }

    const assignedPermissions =
      editForm.role === 'Super Admin' || editingUser.id === ROOT_SUPERADMIN_ID
        ? [...ALL_PERMISSIONS]
        : Array.from(editPermissions);

    const result = updateUser(editingUser.id, {
      name: editForm.name.trim(),
      email: editForm.email.trim(),
      role: editForm.role,
      customRoleName: editForm.customRoleName.trim() || undefined,
      status: editForm.status,
      permissions: assignedPermissions,
    });

    if (result.success) {
      setEditingUser(null);
      showNotification(`User "${editForm.name.trim()}" updated successfully.`);
    } else {
      setEditFormError(result.message || 'Failed to update user.');
    }
  };

  // ---------------------------------------------------------------------------
  // HANDLERS: PERMISSIONS MATRIX (STANDALONE)
  // ---------------------------------------------------------------------------
  const handleOpenPermissions = (u: UserAccount) => {
    setPermissionsUser(u);
    setModalPermissions(new Set(u.role === 'Super Admin' ? ALL_PERMISSIONS : u.permissions));
  };

  const handleToggleModalPermission = (p: Permission) => {
    setModalPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const handleSaveModalPermissions = () => {
    if (!permissionsUser) return;
    const permsArray = Array.from(modalPermissions);
    const result = updateUserPermissions(permissionsUser.id, permsArray);
    if (result.success) {
      setPermissionsUser(null);
      showNotification(`Permissions updated for "${permissionsUser.name}".`);
    }
  };

  // ---------------------------------------------------------------------------
  // HANDLERS: RESET PASSWORD
  // ---------------------------------------------------------------------------
  const handleOpenResetPassword = (u: UserAccount) => {
    setResetPasswordUser(u);
    setNewPassword('');
    setConfirmPassword('');
    setResetPasswordError('');
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser) return;
    setResetPasswordError('');

    if (!newPassword || newPassword.length < 4) {
      setResetPasswordError('Password must be at least 4 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetPasswordError('Passwords do not match.');
      return;
    }

    const result = resetUserPassword(resetPasswordUser.id, newPassword);
    if (result.success) {
      setResetPasswordUser(null);
      showNotification(`Password for "${resetPasswordUser.name}" has been reset successfully.`);
    } else {
      setResetPasswordError(result.message || 'Failed to reset password.');
    }
  };

  // ---------------------------------------------------------------------------
  // HANDLERS: TOGGLE STATUS
  // ---------------------------------------------------------------------------
  const handleToggleStatus = (u: UserAccount) => {
    if (u.id === ROOT_SUPERADMIN_ID || u.role === 'Super Admin') {
      showNotification('The Super Admin account cannot be disabled.');
      return;
    }
    const result = toggleUserStatus(u.id);
    if (result.success) {
      const nextStatus = u.status === 'Active' ? 'disabled' : 'enabled';
      showNotification(`User "${u.name}" is now ${nextStatus}.`);
    } else {
      showNotification(result.message || 'Action failed.');
    }
  };

  // ---------------------------------------------------------------------------
  // HANDLERS: DELETE USER
  // ---------------------------------------------------------------------------
  const handleConfirmDelete = () => {
    if (!deletingUser) return;
    const userName = deletingUser.name;
    const result = deleteUser(deletingUser.id);
    if (result.success) {
      setDeletingUser(null);
      showNotification(`User "${userName}" was deleted successfully.`);
    } else {
      showNotification(result.message || 'Failed to delete user.');
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Success Notification Banner */}
      {actionSuccessMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-2.5 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold">{actionSuccessMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1F293D]">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <span>User Management ({users.length} Account{users.length === 1 ? '' : 's'})</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Super Admin-controlled administrative staff accounts, roles, and granular access permissions
          </p>
        </div>

        <button
          onClick={handleOpenAddUser}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition-all cursor-pointer self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" /> + Add User
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#0B0F17] border border-[#1F293D] rounded-xl text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 font-medium"
        >
          <option value="All">All Roles</option>
          <option value="Super Admin">Super Admin</option>
          <option value="Admin / Manager">Admin / Manager</option>
          <option value="Staff">Staff</option>
          <option value="Custom Role">Custom Role</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 font-medium"
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Disabled">Disabled</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto custom-scrollbar rounded-xl border border-[#1F293D]/70 bg-[#0B0F17]">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#0B0F17] border-b border-[#1F293D] text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-3.5">Name</th>
              <th className="py-3 px-3">Email / Login ID</th>
              <th className="py-3 px-3">Role</th>
              <th className="py-3 px-3 text-center">Access</th>
              <th className="py-3 px-3 text-center">Status</th>
              <th className="py-3 px-3">Created Date</th>
              <th className="py-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1F293D]/50">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  <Layers className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
                  <p className="font-semibold text-slate-400">No users found</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Try adjusting your search or filter.</p>
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                const isRootSuperAdmin = u.id === ROOT_SUPERADMIN_ID || u.role === 'Super Admin';
                const accessCount = u.permissions.length;

                return (
                  <tr key={u.id} className="hover:bg-[#182032] transition-colors group">
                    {/* Name */}
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-slate-900 dark:text-white text-xs leading-tight flex items-center gap-1.5 user-table-name">
                        {isRootSuperAdmin && <Shield className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />}
                        <span className="text-slate-900 dark:text-white font-bold">{u.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 block mt-0.5">{u.id}</span>
                    </td>

                    {/* Email / Username */}
                    <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300">
                      {u.email}
                    </td>

                    {/* Role */}
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border inline-block ${
                          u.role === 'Super Admin'
                            ? 'bg-purple-100 dark:bg-purple-500/15 border-purple-300 dark:border-purple-500/30 text-purple-800 dark:text-purple-300 font-bold'
                            : u.role === 'Admin / Manager'
                            ? 'bg-blue-100 dark:bg-blue-500/15 border-blue-300 dark:border-blue-500/30 text-blue-800 dark:text-blue-300 font-bold'
                            : 'bg-slate-100 dark:bg-slate-700/30 border-slate-300 dark:border-slate-600/40 text-slate-800 dark:text-slate-300 font-medium'
                        }`}
                      >
                        {u.role === 'Custom Role' && u.customRoleName ? u.customRoleName : u.role}
                      </span>
                    </td>

                    {/* Access / Permissions Badge */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                          isRootSuperAdmin
                            ? 'bg-purple-100 dark:bg-purple-500/15 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30 font-bold'
                            : accessCount > 0
                            ? 'bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30 font-semibold'
                            : 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30 font-semibold'
                        }`}
                      >
                        {isRootSuperAdmin ? 'Full Access' : `${accessCount} Permissions`}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          u.status === 'Active'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>

                    {/* Created Date */}
                    <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                      {u.createdAt.split('T')[0]}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Edit User Info & Role */}
                        <button
                          onClick={() => handleOpenEditUser(u)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/15 transition-colors cursor-pointer"
                          title="Edit User Info & Role"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Configure Granular Permissions */}
                        <button
                          onClick={() => handleOpenPermissions(u)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-purple-400 hover:bg-purple-500/15 transition-colors cursor-pointer"
                          title="Configure Granular Permissions Matrix"
                        >
                          <Shield className="w-3.5 h-3.5" />
                        </button>

                        {/* Reset Password */}
                        <button
                          onClick={() => handleOpenResetPassword(u)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/15 transition-colors cursor-pointer"
                          title="Reset Password"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>

                        {/* Enable / Disable */}
                        {!isRootSuperAdmin && (
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              u.status === 'Active'
                                ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/15'
                                : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/15'
                            }`}
                            title={u.status === 'Active' ? 'Disable Account' : 'Enable Account'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete Account */}
                        {!isRootSuperAdmin && (
                          <button
                            onClick={() => setDeletingUser(u)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
                            title="Delete User Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ======================================================================= */}
      {/* MODAL 1: ADD USER */}
      {/* ======================================================================= */}
      <Modal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        title="Add New User Account"
        subtitle="Create a staff account and configure granular access permissions"
        maxWidth="2xl"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
          {addFormError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{addFormError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Full Name <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Martin or Shiyam"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 bg-[#0B0F17] border border-[#1F293D] rounded-xl text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Email / Login ID <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  placeholder="e.g. shiyam@chitfund.com or shiyam_staff"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 bg-[#0B0F17] border border-[#1F293D] rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Password <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  placeholder="Min 4 characters"
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 bg-[#0B0F17] border border-[#1F293D] rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Confirm Password <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  placeholder="Re-enter password"
                  value={addForm.confirmPassword}
                  onChange={(e) => setAddForm({ ...addForm, confirmPassword: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 bg-[#0B0F17] border border-[#1F293D] rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Role</label>
              <select
                value={addForm.role}
                onChange={(e) => handleAddRoleChange(e.target.value as UserRole)}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="Staff">Staff</option>
                <option value="Admin / Manager">Admin / Manager</option>
                <option value="Super Admin">Super Admin</option>
                <option value="Custom Role">Custom Role</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Status</label>
              <select
                value={addForm.status}
                onChange={(e) => setAddForm({ ...addForm, status: e.target.value as UserStatus })}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="Active">Active</option>
                <option value="Disabled">Disabled</option>
              </select>
            </div>
          </div>

          {addForm.role === 'Custom Role' && (
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Custom Role Title</label>
              <input
                type="text"
                placeholder="e.g. Field Officer or Auditor"
                value={addForm.customRoleName}
                onChange={(e) => setAddForm({ ...addForm, customRoleName: e.target.value })}
                className="w-full px-3 py-2 bg-[#0B0F17] border border-[#1F293D] rounded-xl text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Granular Permission Selector */}
          <PermissionModuleGrid
            selectedPermissions={addPermissions}
            onToggle={handleToggleAddPermission}
            onSelectAll={() => setAddPermissions(new Set(ALL_PERMISSIONS))}
            onClearAll={() => setAddPermissions(new Set())}
            onResetDefaults={() => setAddPermissions(new Set(getRoleDefaults(addForm.role)))}
            isSuperAdminRole={addForm.role === 'Super Admin'}
          />

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#1F293D]">
            <button
              type="button"
              onClick={() => setIsAddUserModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-[#161D2F] border border-[#243048] text-slate-300 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/30 cursor-pointer"
            >
              Create Account
            </button>
          </div>
        </form>
      </Modal>

      {/* ======================================================================= */}
      {/* MODAL 2: EDIT USER */}
      {/* ======================================================================= */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="Edit User Account"
        subtitle={`Update account profile and granular permissions for ${editingUser?.name}`}
        maxWidth="2xl"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          {editFormError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{editFormError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
              <input
                type="text"
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-[#0B0F17] border border-[#1F293D] rounded-xl text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Email / Login ID</label>
              <input
                type="text"
                required
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full px-3 py-2 bg-[#0B0F17] border border-[#1F293D] rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Role</label>
              <select
                value={editForm.role}
                disabled={editingUser?.id === ROOT_SUPERADMIN_ID || editingUser?.role === 'Super Admin'}
                onChange={(e) => handleEditRoleChange(e.target.value as UserRole)}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50"
              >
                <option value="Staff">Staff</option>
                <option value="Admin / Manager">Admin / Manager</option>
                <option value="Super Admin">Super Admin</option>
                <option value="Custom Role">Custom Role</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Status</label>
              <select
                value={editForm.status}
                disabled={editingUser?.id === ROOT_SUPERADMIN_ID || editingUser?.role === 'Super Admin'}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value as UserStatus })}
                className="w-full bg-[#0B0F17] border border-[#1F293D] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50"
              >
                <option value="Active">Active</option>
                <option value="Disabled">Disabled</option>
              </select>
            </div>
          </div>

          {editForm.role === 'Custom Role' && (
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Custom Role Title</label>
              <input
                type="text"
                placeholder="e.g. Field Officer"
                value={editForm.customRoleName}
                onChange={(e) => setEditForm({ ...editForm, customRoleName: e.target.value })}
                className="w-full px-3 py-2 bg-[#0B0F17] border border-[#1F293D] rounded-xl text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Granular Permission Selector inside Edit Modal */}
          <PermissionModuleGrid
            selectedPermissions={editPermissions}
            onToggle={handleToggleEditPermission}
            onSelectAll={() => setEditPermissions(new Set(ALL_PERMISSIONS))}
            onClearAll={() => setEditPermissions(new Set())}
            onResetDefaults={() => setEditPermissions(new Set(getRoleDefaults(editForm.role)))}
            isSuperAdminRole={editForm.role === 'Super Admin' || editingUser?.id === ROOT_SUPERADMIN_ID}
          />

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#1F293D]">
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="px-4 py-2 rounded-xl bg-[#161D2F] border border-[#243048] text-slate-300 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/30 cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* ======================================================================= */}
      {/* MODAL 3: PERMISSION MATRIX (STANDALONE SHIELD ACTION) */}
      {/* ======================================================================= */}
      <Modal
        isOpen={!!permissionsUser}
        onClose={() => setPermissionsUser(null)}
        title="Permissions Matrix"
        subtitle={`Configure granular access rights for ${permissionsUser?.name} (${permissionsUser?.role})`}
        maxWidth="2xl"
      >
        <div className="space-y-4 text-xs">
          <PermissionModuleGrid
            selectedPermissions={modalPermissions}
            onToggle={handleToggleModalPermission}
            onSelectAll={() => setModalPermissions(new Set(ALL_PERMISSIONS))}
            onClearAll={() => setModalPermissions(new Set())}
            onResetDefaults={() => setModalPermissions(new Set(getRoleDefaults(permissionsUser?.role || 'Staff')))}
            isSuperAdminRole={permissionsUser?.role === 'Super Admin' || permissionsUser?.id === ROOT_SUPERADMIN_ID}
          />

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#1F293D]">
            <button
              type="button"
              onClick={() => setPermissionsUser(null)}
              className="px-4 py-2 rounded-xl bg-[#161D2F] border border-[#243048] text-slate-300 hover:text-white cursor-pointer"
            >
              Close
            </button>
            {permissionsUser?.role !== 'Super Admin' && permissionsUser?.id !== ROOT_SUPERADMIN_ID && (
              <button
                type="button"
                onClick={handleSaveModalPermissions}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/30 cursor-pointer"
              >
                Save Permissions
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* ======================================================================= */}
      {/* MODAL 4: RESET PASSWORD */}
      {/* ======================================================================= */}
      <Modal
        isOpen={!!resetPasswordUser}
        onClose={() => setResetPasswordUser(null)}
        title="Reset User Password"
        subtitle={`Assign a new login password for ${resetPasswordUser?.name}`}
        maxWidth="sm"
      >
        <form onSubmit={handleResetPasswordSubmit} className="space-y-4 text-xs">
          {resetPasswordError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{resetPasswordError}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-semibold mb-1">New Password</label>
            <input
              type="password"
              required
              placeholder="Min 4 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[#0B0F17] border border-[#1F293D] rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Confirm New Password</label>
            <input
              type="password"
              required
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[#0B0F17] border border-[#1F293D] rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#1F293D]">
            <button
              type="button"
              onClick={() => setResetPasswordUser(null)}
              className="px-4 py-2 rounded-xl bg-[#161D2F] border border-[#243048] text-slate-300 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-lg shadow-amber-600/30 cursor-pointer"
            >
              Update Password
            </button>
          </div>
        </form>
      </Modal>

      {/* ======================================================================= */}
      {/* MODAL 5: DELETE USER CONFIRMATION */}
      {/* ======================================================================= */}
      <Modal
        isOpen={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        title="Delete User Account"
        subtitle="Confirm account deletion"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-300">
            Are you sure you want to permanently delete user{' '}
            <strong className="text-rose-400 font-bold">{deletingUser?.name}</strong> (
            <span className="font-mono text-slate-400">{deletingUser?.email}</span>)?
          </p>

          <div className="p-3 bg-[#0B0F17] border border-rose-500/30 rounded-xl space-y-1">
            <span className="text-[11px] text-rose-400 font-semibold block">Data Safety Confirmation:</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Deleting this login account only removes their access credentials. All underlying chit schemes, member profiles, payment transactions, and historical records remain 100% untouched and preserved.
            </p>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#1F293D]">
            <button
              type="button"
              onClick={() => setDeletingUser(null)}
              className="px-4 py-2 rounded-xl bg-[#161D2F] border border-[#243048] text-slate-300 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
            >
              Confirm & Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
