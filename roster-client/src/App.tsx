import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './hooks/useToast';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import TodayPage from './pages/TodayPage';
import WeekPage from './pages/WeekPage';
import NotePage from './pages/NotePage';
import ManagePage from './pages/ManagePage';
import HoursPage from './pages/HoursPage';
import RestPage from './pages/RestPage';
import LeavePage from './pages/LeavePage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'ADMIN') {
    return <Navigate to="/today" replace />;
  }

  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/today" element={<ProtectedRoute><TodayPage /></ProtectedRoute>} />
      <Route path="/week" element={<ProtectedRoute><WeekPage /></ProtectedRoute>} />
      <Route path="/handover/:rosterId" element={<ProtectedRoute><NotePage /></ProtectedRoute>} />
      <Route path="/rest" element={<ProtectedRoute><RestPage /></ProtectedRoute>} />
      <Route path="/leaves" element={<ProtectedRoute><LeavePage /></ProtectedRoute>} />
      <Route path="/manage" element={<AdminRoute><ManagePage /></AdminRoute>} />
      <Route path="/hours" element={<AdminRoute><HoursPage /></AdminRoute>} />
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </HashRouter>
  );
}
