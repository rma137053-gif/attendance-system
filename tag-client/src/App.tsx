import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './hooks/useToast';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import InboundPage from './pages/InboundPage';
import OutboundPage from './pages/OutboundPage';
import LossPage from './pages/LossPage';
import ReturnPage from './pages/ReturnPage';
import TransactionsPage from './pages/TransactionsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-2 border-brand border-t-transparent" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/inbound" element={<ProtectedRoute><InboundPage /></ProtectedRoute>} />
            <Route path="/outbound" element={<ProtectedRoute><OutboundPage /></ProtectedRoute>} />
            <Route path="/loss" element={<ProtectedRoute><LossPage /></ProtectedRoute>} />
            <Route path="/return" element={<ProtectedRoute><ReturnPage /></ProtectedRoute>} />
            <Route path="/transactions" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </HashRouter>
  );
}
