import { useState, useEffect } from 'react';
import api from '../../api/client';
import { useToast } from '../../hooks/useToast';
import ConfirmDialog from '../../components/ConfirmDialog';

interface StoreManager {
  id: string;
  email: string;
  name: string;
}

interface Store {
  id: string;
  name: string;
  manager: StoreManager | null;
}

export default function StoreManagement() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const { success, error: showError } = useToast();

  // Edit modal state
  const [editing, setEditing] = useState<Store | null>(null);
  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  // Confirm reset state
  const [confirm, setConfirm] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const fetchStores = async () => {
    try {
      const res = await api.get('/stores');
      setStores(res.data);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStores(); }, []);

  const openEdit = (store: Store) => {
    setEditing(store);
    setForm({ email: store.manager?.email || '', password: '' });
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!form.email) {
      showError('请输入店长邮箱');
      return;
    }

    const body: Record<string, string> = { email: form.email };
    if (form.password) body.password = form.password;

    setSubmitting(true);
    try {
      await api.put(`/stores/${editing.id}/manager`, body);
      success(`「${editing.name}」店长信息已更新`);
      setEditing(null);
      fetchStores();
    } catch (err: any) {
      showError(err.response?.data?.error || '更新失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = (store: Store) => {
    setConfirm({
      open: true,
      title: `重置「${store.name}」店长密码`,
      message: `确认将 ${store.manager?.email} 的密码重置为 123？`,
      onConfirm: async () => {
        try {
          await api.put(`/stores/${store.id}/manager`, { password: '123' });
          success(`「${store.name}」店长密码已重置为 123`);
          setConfirm({ open: false, title: '', message: '', onConfirm: () => {} });
        } catch (err: any) {
          showError(err.response?.data?.error || '重置失败');
        }
      },
    });
  };

  if (loading) {
    return <div className="text-center text-gray-400 py-12">加载中...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">门店管理</h1>
        <span className="text-sm text-gray-400">{stores.length} 家门店</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stores.map((store) => (
          <div
            key={store.id}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-800">{store.name}</h3>
              <span className="text-xs bg-brand/10 text-brand px-2 py-1 rounded-full font-medium">
                店长
              </span>
            </div>

            {store.manager ? (
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400 w-10">邮箱</span>
                  <span className="text-gray-700 font-mono">{store.manager.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400 w-10">姓名</span>
                  <span className="text-gray-700">{store.manager.name}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-red-400 mb-4">⚠ 未设置店长</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => openEdit(store)}
                className="flex-1 px-3 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors"
              >
                修改邮箱
              </button>
              <button
                onClick={() => handleResetPassword(store)}
                className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
              >
                重置密码
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setEditing(null)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              修改「{editing.name}」店长信息
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">店长邮箱</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand outline-none"
                  placeholder="manager@ruilun.com"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  新密码<span className="text-gray-300">（留空则不修改）</span>
                </label>
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand outline-none"
                  placeholder="留空不修改"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={submitting}
                className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50"
              >
                {submitting ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm({ open: false, title: '', message: '', onConfirm: () => {} })}
      />
    </div>
  );
}
