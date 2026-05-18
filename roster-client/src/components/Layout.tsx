import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      {/* Header */}
      <header className="bg-brand text-white px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="瑞伦" className="h-8 w-8 object-contain" />
            <h1 className="text-lg font-semibold tracking-tight">排班助手</h1>
          </div>
          <nav className="flex gap-1">
            {[
              { to: '/today', label: '今日排班' },
              { to: '/week', label: '本周排班' },
              { to: '/rest', label: '选休' },
              { to: '/leaves', label: '请假' },
              ...(isAdmin ? [
                { to: '/manage' as const, label: '排班管理' },
                { to: '/hours' as const, label: '工时统计' },
              ] : []),
            ].map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user?.store?.name && (
            <span className="text-xs text-white/60">{user.store.name}</span>
          )}
          <a
            href={import.meta.env.PROD ? '/' : 'http://localhost:5173'}
            className="text-xs bg-white/15 px-2 py-1 rounded-lg hover:bg-white/25 transition-colors"
          >
            打卡系统
          </a>
          <span className="text-sm text-white/80">{user?.name}</span>
          <button onClick={handleLogout} className="text-xs bg-white/15 px-3 py-1 rounded-lg hover:bg-white/25 transition-colors">
            退出
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-6 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
