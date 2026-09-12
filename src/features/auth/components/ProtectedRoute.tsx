import React from 'react';
import { Navigate, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Permission } from '@/types';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface AccessDeniedProps {
  message?: string;
  onBack?: () => void;
}

const AccessDenied: React.FC<AccessDeniedProps> = ({ message, onBack }) => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4 text-rose-400 shadow-xl shadow-rose-500/5">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-slate-100 tracking-tight">Access Denied</h2>
      <p className="text-xs text-slate-400 mt-2 font-medium max-w-xs mx-auto leading-relaxed">
        {message || 'You do not have permission to access this page.'}
      </p>
      <p className="text-[11px] text-slate-500 mt-1">
        Please contact your system Super Admin if you believe this is an error or require access.
      </p>
      <div className="mt-6 pt-5 border-t border-[#1F293D]/70 flex flex-col sm:flex-row items-center justify-center gap-2.5">
        <button
          onClick={() => {
            if (onBack) onBack();
            else navigate('/dashboard', { replace: true });
          }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
      </div>
    </div>
  );
};

export interface ProtectedRouteProps {
  children?: React.ReactNode;
  requiredPermission?: Permission | Permission[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredPermission }) => {
  const { isAuthenticated, hasPermission, hasAllPermissions } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requiredPermission) {
    const hasAccess = Array.isArray(requiredPermission)
      ? hasAllPermissions(requiredPermission)
      : hasPermission(requiredPermission);

    if (!hasAccess) {
      return <AccessDenied message="You do not have permission to access this page." />;
    }
  }

  return children ? <>{children}</> : <Outlet />;
};
