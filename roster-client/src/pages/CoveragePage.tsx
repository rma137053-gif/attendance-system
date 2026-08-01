import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import Spinner from '../components/Spinner';
import dayjs from 'dayjs';

interface Employee {
  id: string;
  name: string;
}

interface Store {
  id: string;
  name: string;
}

interface CoverageItem {
  id: string;
  userId: string;
  storeId: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  reason?: string;
  coveredUserId?: string;
  user: { id: string; name: string };
  store: { id: string; name: string };
  coveredUser?: { id: string; name: string } | null;
}

export default function CoveragePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const success = (msg: string) => showToast(msg, 'success');
  const showError = (msg: string) => showToast(msg, 'error');
  const isAdmin = user?.role === 'ADMIN';

  const [items, setItems] = useState<CoverageItem[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [startDate, setStartDate] = useState(() => dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(() => dayjs().startOf('week').add(1, 'day').add(6, 'day').format('YYYY-MM-DD'));
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<CoverageItem | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [form, setForm] = useState({ userId: '', coveredUserId: '', date: '', startTime: '12:30', endTime: '17:00', reason: '' });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { startDate, endDate, type: 'COVERAGE' };
      if (isAdmin && selectedStoreId) params.storeId = selectedStoreId;
      const res = await api.get('/overtime', { params });
      setItems(res.data.items);
      setTotalHours(res.data.totalHours);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedStoreId, isAdmin]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    if (isAdmin) {
      api.get('/users/stores').then((res) => setStores(res.data)).catch(() => {});
    }
  }, [isAdmin]);

  useEffect(() => {
    const storeId = isAdmin ? selectedStoreId : (user?.storeId || '');
    if (storeId) {
      api.get('/users', { params: { storeId } }).then((res) => {
        setEmployees(res.data.map((u: any) => ({ id: u.id, name: u.name })));
      }).catch((err) => {
        showError(err.response?.data?.error || '加载员工列表失败');
      });
    }
  }, [selectedStoreId, user?.storeId, isAdmin]);

  const openForm = (item?: CoverageItem) => {
    if (item) {
      setEditItem(item);
      setForm({
        userId: item.userId, coveredUserId: item.coveredUserId || '',
        date: item.date, startTime: item.startTime, endTime: item.endTime, reason: item.reason || '',
      });
    } else {
      setEditItem(null);
      setForm({ userId: '', coveredUserId: '', date: dayjs().format('YYYY-MM-DD'), startTime: '12:30', endTime: '17:00', reason: '' });
    }
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.userId) { showError('请选择顶班员工'); return; }

    const effectiveStoreId = isAdmin ? selectedStoreId : (user?.storeId || '');
    if (!effectiveStoreId) { showError('请选择门店'); return; }

    setSubmitting(true);
    try {
      const payload: any = { ...form, storeId: effectiveStoreId, type: 'COVERAGE' };
      if (!payload.coveredUserId) delete payload.coveredUserId;
      if (editItem) {
        await api.put(`/overtime/${editItem.id}`, payload);
        success('已更新');
      } else {
        await api.post('/overtime', payload);
        success('已添加');
      }
      setShowForm(false);
      fetchItems();
    } catch (err: any) {
      showError(err.response?.data?.error || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/overtime/${id}`);
      success('已删除');
      setConfirmingDelete(null);
      fetchItems();
    } catch (err: any) {
      showError(err.response?.data?.error || '删除失败');
    }
  };

  if (!isAdmin) {
    return <div className="text-center py-16 text-gray-400 text-sm">仅管理员可访问</div>;
  }

  if (loading) return <Spinner />;

  return (
    <div className="animate-fade-in space-y-3">
      <h1 className="text-base font-bold text-gray-800">被动加班（顶班）</h1>

      <div className="flex gap-2 flex-wrap">
        <select value={selectedStoreId} onChange={(e) => setSelectedStoreId(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand bg-white">
          <option value="">请选择门店</option>
          {stores.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </select>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white" />
        <span className="self-center text-gray-400 text-sm">—</span>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white" />
      </div>

      {!selectedStoreId ? (
        <div className="text-center py-16 text-gray-400 text-sm">请先选择门店</div>
      ) : (
        <>
          <div className="flex justify-end">
            <button onClick={() => openForm()}
              className="px-4 py-2 rounded-xl bg-purple-500 text-white text-sm font-medium hover:bg-purple-600">
              + 新增顶班
            </button>
          </div>

          <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
            <div className="text-xl font-bold text-purple-600">{totalHours}h</div>
            <div className="text-xs text-gray-400 mt-0.5">顶班总时长</div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 text-xs">
                  <th className="text-left py-3 px-3">顶班员工</th>
                  <th className="text-left py-3 px-3">被顶替</th>
                  <th className="text-left py-3 px-3">日期</th>
                  <th className="text-left py-3 px-3">时间</th>
                  <th className="text-left py-3 px-3">时长</th>
                  <th className="text-left py-3 px-3">原因</th>
                  <th className="text-right py-3 px-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">暂无顶班记录</td></tr>
                ) : items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50 last:border-b-0">
                    <td className="py-3 px-3 font-medium text-gray-800">{item.user.name}</td>
                    <td className="py-3 px-3 text-purple-600 font-medium">{item.coveredUser?.name || '-'}</td>
                    <td className="py-3 px-3 text-gray-600">{item.date}</td>
                    <td className="py-3 px-3 text-gray-600">{item.startTime}-{item.endTime}</td>
                    <td className="py-3 px-3 font-semibold text-purple-600">{item.hours}h</td>
                    <td className="py-3 px-3 text-gray-400 max-w-[120px] truncate">{item.reason || '-'}</td>
                    <td className="py-3 px-3 text-right">
                      <button onClick={() => openForm(item)} className="text-purple-600 text-xs mr-2">编辑</button>
                      {confirmingDelete === item.id ? (
                        <span className="text-xs">
                          <button onClick={() => handleDelete(item.id)} className="text-red-500 mr-1">确认</button>
                          <button onClick={() => setConfirmingDelete(null)} className="text-gray-400">取消</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmingDelete(item.id)} className="text-red-400 text-xs">删除</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-t-2xl p-5 w-full max-w-lg animate-slide-up">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">{editItem ? '编辑顶班' : '新增顶班'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">顶班员工（谁来顶）</label>
                <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-base bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none">
                  <option value="">请选择</option>
                  {employees.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">被顶替员工（谁请假了）</label>
                <select value={form.coveredUserId} onChange={(e) => setForm({ ...form, coveredUserId: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-base bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none">
                  <option value="">（选填）</option>
                  {employees.filter((e) => e.id !== form.userId).map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">加班日期</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-base focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">开始</label>
                  <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-base focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
                </div>
                <span className="text-gray-300 mt-5">—</span>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">结束</label>
                  <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-base focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">原因（选填）</label>
                <input type="text" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="如：顶替王海云下午班"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-base focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-6 py-3 rounded-lg text-base bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium">取消</button>
                <button type="submit" disabled={submitting}
                  className="px-6 py-3 rounded-lg text-base bg-purple-500 text-white hover:bg-purple-600 font-medium disabled:opacity-50">
                  {submitting ? '提交中...' : editItem ? '保存' : '添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
