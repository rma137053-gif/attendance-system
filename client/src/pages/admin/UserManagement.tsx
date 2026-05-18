import { useState, useEffect } from 'react';
import api from '../../api/client';
import { useToast } from '../../hooks/useToast';
import ConfirmDialog from '../../components/ConfirmDialog';

interface Store {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  pin?: string | null;
  createdAt: string;
  storeId?: string | null;
  store?: { id: string; name: string } | null;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', storeId: '', pin: '' });
  const [error, setError] = useState('');
  const { success } = useToast();

  // Confirm dialog state
  const [confirm, setConfirm] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  // Password reset state
  const [resetPwdUser, setResetPwdUser] = useState<User | null>(null);
  const [resetPwd, setResetPwd] = useState('');

  const fetchData = async () => {
    try {
      const [usersRes, storesRes] = await Promise.all([
        api.get('/users'),
        api.get('/users/stores'),
      ]);
      setUsers(usersRes.data);
      setStores(storesRes.data);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editUser) {
        await api.put(`/users/${editUser.id}`, { name: form.name, email: form.email, pin: form.pin });
        success('员工信息已更新');
      } else {
        await api.post('/users', form);
        success('员工已添加');
      }
      setShowForm(false);
      setEditUser(null);
      setForm({ name: '', email: '', password: '', storeId: '', pin: '' });
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || '操作失败');
    }
  };

  const handleToggleStatus = (user: User) => {
    const newStatus = user.status === 'ACTIVE' ? '停用' : '启用';
    const isDeleting = user.status === 'ACTIVE';
    setConfirm({
      open: true,
      title: `${newStatus}员工`,
      message: isDeleting
        ? `确定要停用员工「${user.name}」吗？将删除该员工的所有数据（排班、打卡记录等），不可撤销。`
        : `确定要启用员工「${user.name}」吗？`,
      onConfirm: async () => {
        try {
          await api.patch(`/users/${user.id}/status`);
          success(`员工已${newStatus}`);
          fetchData();
        } catch (err: any) {
          setError(err.response?.data?.error || '操作失败');
        }
        setConfirm((c) => ({ ...c, open: false }));
      },
    });
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPwdUser) return;
    try {
      await api.put(`/users/${resetPwdUser.id}/password`, { password: resetPwd });
      success('密码已重置');
      setResetPwdUser(null);
      setResetPwd('');
    } catch (err: any) {
      setError(err.response?.data?.error || '操作失败');
    }
  };

  const startEdit = (user: User) => {
    setEditUser(user);
    setForm({ name: user.name, email: user.email, password: '', storeId: user.storeId || '', pin: user.pin || '' });
    setShowForm(true);
  };

  if (loading) return <div className="text-center text-gray-500 py-10">加载中...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">员工管理</h1>
        <button
          onClick={() => {
            setEditUser(null);
            setForm({ name: '', email: '', password: '', storeId: stores[0]?.id || '', pin: '' });
            setShowForm(true);
          }}
          className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors text-sm"
        >
          + 添加员工
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

      {showForm && (
        <div className="bg-surface-card rounded-2xl border border-gray-200 p-6 mb-6 animate-fade-in">
          <h2 className="font-semibold text-gray-800 mb-4">
            {editUser ? '编辑员工' : '添加员工'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand focus:border-brand outline-none text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand focus:border-brand outline-none text-sm bg-white"
              />
            </div>
            {!editUser && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">归属门店</label>
                <select
                  value={form.storeId}
                  onChange={(e) => setForm({ ...form, storeId: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand focus:border-brand outline-none text-sm bg-white"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
            {!editUser && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand focus:border-brand outline-none text-sm bg-white"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PIN码（4-6位数字）</label>
              <input
                type="text"
                inputMode="numeric"
                value={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
                maxLength={6}
                placeholder={editUser ? '留空则保持不变' : '可选'}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand focus:border-brand outline-none text-sm bg-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors text-sm"
              >
                {editUser ? '保存' : '添加'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditUser(null); }}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors text-sm"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-surface-card rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">姓名</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">邮箱</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">门店</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">PIN</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">角色</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">状态</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3.5 text-gray-800 font-medium">{u.name}</td>
                <td className="px-4 py-3.5 text-gray-500 hidden sm:table-cell">{u.email}</td>
                <td className="px-4 py-3.5 text-gray-500 hidden sm:table-cell">{u.store?.name || '-'}</td>
                <td className="px-4 py-3.5 text-gray-500 hidden sm:table-cell font-mono">{u.pin || '-'}</td>
                <td className="px-4 py-3.5">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                    u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {u.role === 'ADMIN' ? '管理员' : u.role === 'STORE_ADMIN' ? '店长' : '员工'}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                    u.status === 'ACTIVE' ? 'bg-clock-in-light text-clock-in' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {u.status === 'ACTIVE' ? '在职' : '停用'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => startEdit(u)}
                    className="text-brand hover:text-brand-dark text-sm"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => { setResetPwdUser(u); setResetPwd(''); }}
                    className="text-gray-500 hover:text-gray-700 text-sm"
                  >
                    重置密码
                  </button>
                  {u.role !== 'ADMIN' && (
                    <button
                      onClick={() => handleToggleStatus(u)}
                      className={`text-sm ${
                        u.status === 'ACTIVE' ? 'text-red-500 hover:text-red-600' : 'text-green-500 hover:text-green-600'
                      }`}
                    >
                      {u.status === 'ACTIVE' ? '停用' : '启用'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm((c) => ({ ...c, open: false }))}
      />

      {/* Password reset modal */}
      {resetPwdUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setResetPwdUser(null)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              重置密码 — {resetPwdUser.name}
            </h3>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">新密码</label>
                <input
                  type="password"
                  value={resetPwd}
                  onChange={(e) => setResetPwd(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetPwdUser(null)}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark"
                >
                  确认重置
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
