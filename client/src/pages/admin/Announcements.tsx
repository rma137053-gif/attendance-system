import { useState, useEffect } from 'react';
import api from '../../api/client';
import { useToast } from '../../hooks/useToast';

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: string;
  storeId: string | null;
  store: { id: string; name: string } | null;
  user: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

interface Store {
  id: string;
  name: string;
}

const TYPE_LABELS: Record<string, string> = {
  GENERAL: '通用通知',
  ROSTER: '排班变更',
  HOLIDAY: '假期通知',
};

export default function Announcements() {
  const { success, error: showError } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', content: '', type: 'GENERAL', storeId: '' });
  const [submitting, setSubmitting] = useState(false);
  const pageSize = 15;

  useEffect(() => {
    api.get('/users/stores').then((res) => setStores(res.data)).catch(() => {});
  }, []);

  const fetchAnnouncements = async (p: number) => {
    setLoading(true);
    try {
      const params: any = { page: p, pageSize };
      const res = await api.get('/announcements', { params });
      setAnnouncements(res.data.items);
      setTotal(res.data.total);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements(page);
  }, [page]);

  const openCreateModal = () => {
    setEditId(null);
    setForm({ title: '', content: '', type: 'GENERAL', storeId: '' });
    setShowModal(true);
  };

  const openEditModal = (a: Announcement) => {
    setEditId(a.id);
    setForm({
      title: a.title,
      content: a.content,
      type: a.type,
      storeId: a.storeId || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.title || !form.content) return;
    setSubmitting(true);
    try {
      const payload: any = {
        title: form.title,
        content: form.content,
        type: form.type,
      };
      if (form.storeId) payload.storeId = form.storeId;

      if (editId) {
        await api.put(`/announcements/${editId}`, payload);
        success('公告已更新');
      } else {
        await api.post('/announcements', payload);
        success('公告已发布');
      }
      setShowModal(false);
      fetchAnnouncements(page);
    } catch (err: any) {
      showError(err.response?.data?.error || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除这条公告？')) return;
    try {
      await api.delete(`/announcements/${id}`);
      success('公告已删除');
      fetchAnnouncements(page);
    } catch (err: any) {
      showError(err.response?.data?.error || '删除失败');
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">公告管理</h1>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-dark transition-colors"
        >
          + 发布公告
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-10">加载中...</div>
      ) : announcements.length === 0 ? (
        <div className="text-center text-gray-500 py-10">暂无公告</div>
      ) : (
        <>
          <div className="space-y-3">
            {announcements.map((a) => (
              <div key={a.id} className="bg-surface-card rounded-2xl border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        a.type === 'HOLIDAY' ? 'bg-red-100 text-red-600' :
                        a.type === 'ROSTER' ? 'bg-blue-100 text-blue-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {TYPE_LABELS[a.type] || a.type}
                      </span>
                      {a.store ? (
                        <span className="text-xs text-gray-400">{a.store.name}</span>
                      ) : (
                        <span className="text-xs text-brand font-medium">全部门店</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-800">{a.title}</h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{a.content}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>{a.user.name}</span>
                      <span>{a.createdAt}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => openEditModal(a)}
                      className="text-sm text-gray-400 hover:text-brand px-2 py-1"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="text-sm text-gray-400 hover:text-red-500 px-2 py-1"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50">
                上一页
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-500">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50">
                下一页
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {editId ? '编辑公告' : '发布公告'}
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-1.5">标题</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="公告标题"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-1.5">内容</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="公告内容..."
                rows={4}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">类型</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand bg-white"
                >
                  <option value="GENERAL">通用通知</option>
                  <option value="ROSTER">排班变更</option>
                  <option value="HOLIDAY">假期通知</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">门店</label>
                <select
                  value={form.storeId}
                  onChange={(e) => setForm({ ...form, storeId: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand bg-white"
                >
                  <option value="">全部门店</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                取消
              </button>
              <button onClick={handleSubmit} disabled={submitting || !form.title || !form.content}
                className="flex-1 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-dark disabled:opacity-40">
                {submitting ? '提交中...' : editId ? '保存' : '发布'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
