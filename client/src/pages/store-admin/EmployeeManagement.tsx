import { useState, useEffect } from 'react';
import api from '../../api/client';
import { useToast } from '../../hooks/useToast';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
}

export default function EmployeeManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', pin: '' });
  const [error, setError] = useState('');
  const { success } = useToast();

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/users', form);
      success('员工已添加');
      setShowForm(false);
      setForm({ name: '', email: '', password: '', pin: '' });
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || '操作失败');
    }
  };

  if (loading) return <div className="text-center text-gray-500 py-10">加载中...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">员工管理</h1>
        <button
          onClick={() => {
            setForm({ name: '', email: '', password: '', pin: '' });
            setShowForm(true);
          }}
          className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors text-sm"
        >
          + 添加员工
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">添加员工</h2>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PIN码（4-6位数字，用于打卡验证）</label>
              <input
                type="password"
                inputMode="numeric"
                value={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
                maxLength={6}
                placeholder="可选，如不设置则跳过PIN验证"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand outline-none text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors text-sm"
              >
                添加
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors text-sm"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">姓名</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">邮箱</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">状态</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 text-gray-800">{u.name}</td>
                <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {u.status === 'ACTIVE' ? '在职' : '停用'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
