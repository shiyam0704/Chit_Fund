import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChit } from '@/shared/context/ChitContext';
import { useAuth } from '@/features/auth';
import { Shield, Moon, Sun, LogOut, Menu, Building2 } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface HeaderProps {
  onToggleMobileSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileSidebar }) => {
  const { theme, toggleTheme, addToast } = useChit();
  const { logout, email, currentUser, companyName, companyId } = useAuth();
  const navigate = useNavigate();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const displayName = currentUser?.name || email || 'User';
  const displayRole =
    currentUser?.role === 'Custom Role' && currentUser?.customRoleName
      ? currentUser.customRoleName
      : currentUser?.role || 'Staff';

  const initials =
    displayName
      .split(' ')
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';

  const handleConfirmLogout = () => {
    setIsLogoutModalOpen(false);
    logout();
    addToast('Logged Out', 'You have been signed out successfully', 'info');
    navigate('/login', { replace: true });
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-[#0D121F]/95 backdrop-blur-md border-b border-[#1F293D] transition-all">
        <div className="w-full pl-4 sm:pl-6 lg:pl-[288px] pr-4 sm:pr-6 lg:pr-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={onToggleMobileSidebar}
                className="lg:hidden p-2 rounded-xl bg-[#161D2F] border border-[#243048] text-slate-300 hover:text-white cursor-pointer"
                title="Toggle Menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Company Context Badge on Desktop */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161D2F] border border-[#243048] text-xs font-semibold text-slate-200 shadow-sm" title={`Company ID: ${companyId}`}>
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span className="truncate max-w-[150px]">{companyName}</span>
                <span className="font-mono text-[10px] text-blue-400/90 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">{companyId}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161D2F] border border-[#243048] text-xs font-semibold text-blue-300 shadow-sm select-none">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                <span>{displayRole}</span>
              </div>

              <div className="flex items-center gap-2.5 pl-2 border-l border-[#1F293D]">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shadow-md select-none">
                  {initials}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-200">{displayName}</span>
                  <span className="text-[10px] text-slate-400 font-medium">{displayRole}</span>
                </div>
              </div>

              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-[#182032] transition-colors cursor-pointer"
                title={theme === 'dark' ? 'Dark Theme Active (Click for Light Mode)' : 'Light Theme Active (Click for Dark Mode)'}
              >
                {theme === 'dark' ? (
                  <Moon className="w-4 h-4 text-blue-400" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-500" />
                )}
              </button>

              <button
                onClick={() => setIsLogoutModalOpen(true)}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <Modal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        title="Confirm Sign Out"
        subtitle="Are you sure you want to exit Chit Fund?"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            You will be signed out of your session as{' '}
            <span className="font-semibold text-blue-300">{displayRole}</span>.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setIsLogoutModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-[#1F293D] text-slate-300 hover:bg-[#2B3952] text-sm font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmLogout}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium shadow-lg shadow-rose-600/30 cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
