import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import Spinner from '../components/Spinner';
import dayjs from 'dayjs';

interface Store { id: string; name: string; }

interface OvertimeItem {
  id: string; userId: string; storeId: string; date: string;
  startTime: string; endTime: string; hours: number; reason?: string;
  user: { id: string; name: string }; store: { id: string; name: string };
}

export default function OvertimePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [items, setItems] = useState<OvertimeItem[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [startDate, setStartDate] = useState(() => dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(() => dayjs().startOf('week').add(1, 'day').add(6, 'day').format('YYYY-MM-DD'));

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { startDate, endDate, type: 'VOLUNTARY' };
      if (isAdmin && selectedStoreId) params.storeId = selectedStoreId;
      const res = await api.get('/overtime', { params });
      setItems(res.data.items); setTotalHours(res.data.totalHours);
    } catch {} finally { setLoading(false); }
  }, [startDate, endDate, selectedStoreId, isAdmin]);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { if (isAdmin) api.get('/users/stores').then(r => setStores(r.data)).catch(() => {}); }, [isAdmin]);

  if (!isAdmin) return <div className="text-center py-16 text-gray-400 text-sm">仅管理员可访问</div>;
  if (loading) return <Spinner />;

  return (
    <div className="animate-fade-in space-y-3">
      <h1 className="text-base font-bold text-gray-800">主动加班（自动记录）</h1>
      <div className="flex gap-2 flex-wrap">
        <select value={selectedStoreId} onChange={e => setSelectedStoreId(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white">
          <option value="">请选择门店</option>
          {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white" />
        <span className="self-center text-gray-400 text-sm">—</span>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white" />
      </div>
      {!selectedStoreId ? <div className="text-center py-16 text-gray-400 text-sm">请先选择门店</div> : <>
        <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
          <div className="text-xl font-bold text-brand">{totalHours}h</div>
          <div className="text-xs text-gray-400 mt-0.5">主动加班总时长</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 text-gray-500 text-xs">
              <th className="text-left py-3 px-3">员工</th><th className="text-left py-3 px-3">日期</th>
              <th className="text-left py-3 px-3">时间</th><th className="text-left py-3 px-3">时长</th>
            </tr></thead>
            <tbody>
              {items.length === 0 ? <tr><td colSpan={4} className="text-center py-12 text-gray-400">暂无主动加班记录</td></tr>
              : items.map(item => (
                <tr key={item.id} className="border-b border-gray-50">
                  <td className="py-3 px-3 font-medium text-gray-800">{item.user.name}</td>
                  <td className="py-3 px-3 text-gray-600">{item.date}</td>
                  <td className="py-3 px-3 text-gray-600">{item.startTime}-{item.endTime}</td>
                  <td className="py-3 px-3 font-semibold text-brand">{item.hours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>}
    </div>
  );
}
