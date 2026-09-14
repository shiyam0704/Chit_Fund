import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ChitProvider } from '@/shared/context';
import { AuthProvider, ProtectedRoute, Login, PERMISSIONS, useAuth } from '@/features/auth';
import { ErrorBoundary, ToastContainer, ReceiptModal } from '@/shared/components/ui';
import { Sidebar, Header } from '@/shared/components/layout';
import { Dashboard } from '@/features/dashboard';
import { Chits, ChitDetail } from '@/features/chits';
import { Members, MemberDetail } from '@/features/members';
import { Reports } from '@/features/reports';
import { AuditTrail } from '@/features/audit';
import { Settings } from '@/features/settings';

/**
 * Resolves the initial home landing page based on granular role permissions.
 * Super Admin or users with dashboard.view will land on /dashboard.
 * Users without dashboard.view will be smoothly redirected to their first accessible module.
 */
const RootRedirect: React.FC = () => {
  const { hasPermission, isSuperAdmin } = useAuth();
  if (isSuperAdmin() || hasPermission(PERMISSIONS.DASHBOARD_VIEW)) {
    return <Navigate to="/dashboard" replace />;
  }
  if (hasPermission(PERMISSIONS.CHITS_VIEW)) {
    return <Navigate to="/chits" replace />;
  }
  if (hasPermission(PERMISSIONS.MEMBERS_VIEW)) {
    return <Navigate to="/members" replace />;
  }
  if (hasPermission(PERMISSIONS.PAYMENTS_VIEW)) {
    return <Navigate to="/payments" replace />;
  }
  if (hasPermission(PERMISSIONS.REPORTS_VIEW)) {
    return <Navigate to="/reports" replace />;
  }
  if (hasPermission(PERMISSIONS.AUDIT_TRAIL_VIEW)) {
    return <Navigate to="/audit-trail" replace />;
  }
  if (hasPermission(PERMISSIONS.SETTINGS_VIEW)) {
    return <Navigate to="/settings" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

/**
 * Payments & Collections redirection helper.
 * Enforces payments.view permission and routes to active scheme/member payments view.
 */
const PaymentsRedirect: React.FC = () => {
  const { hasPermission, isSuperAdmin } = useAuth();
  if (isSuperAdmin() || hasPermission(PERMISSIONS.CHITS_VIEW)) {
    return <Navigate to="/chits" replace />;
  }
  if (hasPermission(PERMISSIONS.MEMBERS_VIEW)) {
    return <Navigate to="/members" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

/**
 * Authenticated Layout
 * Renders the top navigation header and fixed left sidebar only for logged-in sessions.
 */
const AuthenticatedLayout: React.FC = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      <Sidebar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} />
      <Header onToggleMobileSidebar={() => setIsMobileOpen((prev) => !prev)} />
      <main className="flex-1 w-full pl-4 sm:pl-6 lg:pl-[288px] pr-4 sm:pr-6 lg:pr-8 pt-6 pb-10">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <ReceiptModal />
      <ToastContainer />
    </div>
  );
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <AuthenticatedLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<RootRedirect />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.DASHBOARD_VIEW}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chits"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.CHITS_VIEW}>
              <Chits />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chits/:id"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.CHITS_VIEW}>
              <ChitDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/members"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.MEMBERS_VIEW}>
              <Members />
            </ProtectedRoute>
          }
        />
        <Route
          path="/members/:id"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.MEMBERS_VIEW}>
              <MemberDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/collections"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.PAYMENTS_VIEW}>
              <PaymentsRedirect />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payments"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.PAYMENTS_VIEW}>
              <PaymentsRedirect />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.REPORTS_VIEW}>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit-trail"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.AUDIT_TRAIL_VIEW}>
              <AuditTrail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute requiredPermission={PERMISSIONS.SETTINGS_VIEW}>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route path="/auctions" element={<RootRedirect />} />
        <Route path="*" element={<RootRedirect />} />
      </Route>
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <ChitProvider>
        <Router>
          <AppRoutes />
        </Router>
      </ChitProvider>
    </AuthProvider>
  );
};

export default App;
