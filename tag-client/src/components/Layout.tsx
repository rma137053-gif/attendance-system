import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN';

  const handleLogout = () => { logout(); navigate('/login'); };

  const links = [
    { to: '/', label: '仪表盘' },
    ...(isAdmin ? [{ to: '/inbound' as const, label: '入库' }] : []),
    { to: '/outbound' as const, label: '每日使用' },
    { to: '/loss' as const, label: '报损' },
    { to: '/return' as const, label: '退回' },
    { to: '/transactions' as const, label: '记录' },
  ];

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-brand text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold">🏷️ 吊牌管理</h1>
          <nav className="flex gap-1">
            {links.map(({ to, label }) => (
              <NavLink key={to} to={to} className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}`
              }>{label}</NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/80">{user?.username} ({isAdmin ? '管理' : '会计'})</span>
          <button onClick={handleLogout} className="text-xs bg-white/15 px-3 py-1 rounded-lg hover:bg-white/25">退出</button>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
