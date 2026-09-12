import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth, PERMISSIONS } from '@/features/auth';
import {
  LayoutDashboard,
  Layers,
  Users,
  FileBarChart,
  Settings as SettingsIcon,
  X,
  Coins,
} from 'lucide-react';

interface SidebarProps {
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, setIsMobileOpen }) => {
  const { hasPermission, isSuperAdmin } = useAuth();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
    { name: 'Chits', path: '/chits', icon: Layers, permission: PERMISSIONS.CHITS_VIEW },
    { name: 'Members', path: '/members', icon: Users, permission: PERMISSIONS.MEMBERS_VIEW },
    { name: 'Reports', path: '/reports', icon: FileBarChart, permission: PERMISSIONS.REPORTS_VIEW },
    { name: 'Settings', path: '/settings', icon: SettingsIcon, permission: PERMISSIONS.SETTINGS_VIEW },
  ];

  const filteredNavItems = isSuperAdmin()
    ? navItems
    : navItems.filter((item) => hasPermission(item.permission));

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0D121F] border-r border-[#1F293D] select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-[#1F293D]">
        <Link to="/dashboard" className="flex items-center gap-3 group" onClick={() => setIsMobileOpen(false)}>
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30 group-hover:scale-105 transition-transform">
            <Coins className="w-5 h-5" />
          </div>
          <span className="text-xl font-black text-slate-100 tracking-tight">
            Chit<span className="text-blue-400">Fund</span>
          </span>
        </Link>
        <button
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#182032] cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto custom-scrollbar">
        <div className="px-3 pb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          Main Menu
        </div>
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#182032] font-medium'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 z-40">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-fadeIn"
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="relative w-64 max-w-full z-50 h-full shadow-2xl animate-slideRight">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
