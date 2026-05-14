import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../api/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { success, error: showError } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [time, setTime] = useState(dayjs().tz('Asia/Shanghai'));
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: '', newPwd: '', confirm: '' });
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(dayjs().tz('Asia/Shanghai')), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdForm.newPwd !== pwdForm.confirm) {
      showError('两次输入的新密码不一致');
      return;
    }
    setPwdSubmitting(true);
    try {
      await api.put('/auth/password', {
        currentPassword: pwdForm.current,
        newPassword: pwdForm.newPwd,
      });
      success('密码修改成功');
      setShowPwdModal(false);
      setPwdForm({ current: '', newPwd: '', confirm: '' });
    } catch (err: any) {
      showError(err.response?.data?.error || '修改失败');
    } finally {
      setPwdSubmitting(false);
    }
  };

  const isAdmin = user?.role === 'ADMIN';
  const isStoreAdmin = user?.role === 'STORE_ADMIN';
  const homePath = isAdmin ? '/admin' : isStoreAdmin ? '/store-admin' : '/dashboard';

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-brand text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to={homePath} className="flex items-center gap-2 font-bold text-lg">
              <img src="/logo.png" alt="瑞伦" className="h-8 w-8 object-contain" />
              打卡系统
            </Link>
            <div className="hidden sm:flex gap-4 text-sm">
              {isAdmin ? (
                <>
                  <NavLink to="/admin" label="总览" current={location.pathname} />
                  <NavLink to="/admin/users" label="员工管理" current={location.pathname} />
                  <NavLink to="/admin/records" label="打卡记录" current={location.pathname} />
                  <NavLink to="/admin/reports" label="报表" current={location.pathname} />
                  <NavLink to="/admin/audit-logs" label="操作日志" current={location.pathname} />
                </>
              ) : isStoreAdmin ? (
                <>
                  <NavLink to="/store-admin" label="总览" current={location.pathname} />
                  <NavLink to="/store-admin/clock" label="打卡" current={location.pathname} />
                  <NavLink to="/store-admin/employees" label="员工管理" current={location.pathname} />
                  <NavLink to="/store-admin/records" label="打卡记录" current={location.pathname} />
                </>
              ) : (
                <>
                  <NavLink to="/dashboard" label="首页" current={location.pathname} />
                  <NavLink to="/dashboard/clock" label="打卡" current={location.pathname} />
                  <NavLink to="/dashboard/records" label="我的记录" current={location.pathname} />
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-brand-light font-mono tabular-nums">
              {time.format('YYYY-MM-DD HH:mm:ss')} 北京
            </span>
            <button
              onClick={() => setShowPwdModal(true)}
              className="text-brand-light hover:text-white transition-colors text-left"
            >
              <div>{user?.name}</div>
              {user?.role === 'ADMIN' && !user?.storeId ? (
                <div className="text-xs opacity-70">全部门店</div>
              ) : (user as any)?.store?.name ? (
                <div className="text-xs opacity-70">{(user as any).store.name}</div>
              ) : null}
            </button>
            <button
              onClick={handleLogout}
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded transition-colors"
            >
              退出
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>

      {/* Password change modal */}
      {showPwdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowPwdModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">修改密码</h3>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">当前密码</label>
                <input
                  type="password"
                  value={pwdForm.current}
                  onChange={(e) => setPwdForm({ ...pwdForm, current: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">新密码</label>
                <input
                  type="password"
                  value={pwdForm.newPwd}
                  onChange={(e) => setPwdForm({ ...pwdForm, newPwd: e.target.value })}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">确认新密码</label>
                <input
                  type="password"
                  value={pwdForm.confirm}
                  onChange={(e) => setPwdForm({ ...pwdForm, confirm: e.target.value })}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPwdModal(false)}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={pwdSubmitting}
                  className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50"
                >
                  {pwdSubmitting ? '保存中...' : '确认修改'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function NavLink({ to, label, current }: { to: string; label: string; current: string }) {
  const homePaths = ['/admin', '/dashboard', '/store-admin'];
  const isActive = current === to || (!homePaths.includes(to) && current.startsWith(to));
  return (
    <Link
      to={to}
      className={`hover:text-white transition-colors ${
        isActive ? 'text-white font-semibold' : 'text-brand-light'
      }`}
    >
      {label}
    </Link>
  );
}
