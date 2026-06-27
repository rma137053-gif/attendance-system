import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './hooks/useToast';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import EmployeeDashboard from './pages/employee/Dashboard';
import ClockPage from './pages/employee/ClockPage';
import MyRecords from './pages/employee/MyRecords';
import AdminDashboard from './pages/admin/Dashboard';
import UserManagement from './pages/admin/UserManagement';
import AllRecords from './pages/admin/AllRecords';
import Reports from './pages/admin/Reports';
import AuditLog from './pages/admin/AuditLog';
import LeaveManagement from './pages/admin/LeaveManagement';
import Announcements from './pages/admin/Announcements';
import LeaveRequest from './pages/employee/LeaveRequest';
import RestDaySelector from './pages/employee/RestDaySelector';
import StoreAdminDashboard from './pages/store-admin/Dashboard';
import StoreAdminClock from './pages/store-admin/ClockPage';
import StoreAdminEmployees from './pages/store-admin/EmployeeManagement';
import StoreAdminRecords from './pages/store-admin/Records';


type AllowedRole = 'ADMIN' | 'EMPLOYEE' | 'STORE_ADMIN';

function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: AllowedRole | AllowedRole[];
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!roles.includes(user.role as AllowedRole)) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">403</h1>
            <p className="text-gray-500">无权限访问此页面</p>
          </div>
        </div>
      );
    }
  }

  return <Layout>{children}</Layout>;
}

function getHomePath(role: string) {
  if (role === 'ADMIN') return '/admin';
  if (role === 'STORE_ADMIN') return '/store-admin';
  return '/dashboard';
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={getHomePath(user.role)} replace /> : <LoginPage />}
      />
      {/* Employee routes (kept for backward compat, employees no longer log in) */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute requiredRole="EMPLOYEE">
            <EmployeeDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/clock"
        element={
          <ProtectedRoute requiredRole="EMPLOYEE">
            <ClockPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/records"
        element={
          <ProtectedRoute requiredRole="EMPLOYEE">
            <MyRecords />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/leaves"
        element={
          <ProtectedRoute requiredRole="EMPLOYEE">
            <LeaveRequest />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/rest"
        element={
          <ProtectedRoute requiredRole="EMPLOYEE">
            <RestDaySelector />
          </ProtectedRoute>
        }
      />
      {/* ADMIN routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <UserManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/records"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AllRecords />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <Reports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/audit-logs"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AuditLog />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/leaves"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <LeaveManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/announcements"
        element={
          <ProtectedRoute requiredRole={['ADMIN', 'STORE_ADMIN']}>
            <Announcements />
          </ProtectedRoute>
        }
      />
      {/* STORE_ADMIN routes */}
      <Route
        path="/store-admin"
        element={
          <ProtectedRoute requiredRole="STORE_ADMIN">
            <StoreAdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/store-admin/clock"
        element={
          <ProtectedRoute requiredRole="STORE_ADMIN">
            <StoreAdminClock />
          </ProtectedRoute>
        }
      />
      <Route
        path="/store-admin/employees"
        element={
          <ProtectedRoute requiredRole="STORE_ADMIN">
            <StoreAdminEmployees />
          </ProtectedRoute>
        }
      />
      <Route
        path="/store-admin/records"
        element={
          <ProtectedRoute requiredRole="STORE_ADMIN">
            <StoreAdminRecords />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={user ? getHomePath(user.role) : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
