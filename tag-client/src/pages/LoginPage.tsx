import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) { navigate('/'); return null; }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">🏷️ 吊牌管理系统</h1>
        <p className="text-center text-gray-400 text-sm mb-6">请登录</p>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
            placeholder="用户名" required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base outline-none focus:ring-2 focus:ring-brand/20" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="密码" required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base outline-none focus:ring-2 focus:ring-brand/20" />
          <button type="submit" disabled={loading}
            className="w-full py-3 bg-brand text-white rounded-xl font-semibold hover:bg-brand-dark disabled:opacity-50 transition-colors">
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}
