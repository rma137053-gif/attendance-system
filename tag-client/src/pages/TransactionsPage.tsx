import { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import dayjs from 'dayjs';

export default function TransactionsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role === 'ADMIN';
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const pageSize = 20;

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (typeFilter) params.type = typeFilter;
      const res = await api.get('/transactions', { params });
      setItems(res.data.items);
      setTotal(res.data.total);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [typeFilter, page]);

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/transactions/${id}`);
      showToast('已删除', 'success');
      setConfirmingId(null);
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || '删除失败', 'error');
    }
  };

  const typeLabel = (t: string) => t === 'IN' ? '入库' : t === 'OUT' ? '使用' : t === 'RETURN' ? '退回' : '报损';
  const typeColor = (t: string) => t === 'IN' ? 'text-green-600 bg-green-50' : t === 'OUT' ? 'text-blue-600 bg-blue-50' : t === 'RETURN' ? 'text-teal-600 bg-teal-50' : 'text-red-600 bg-red-50';

  return (
    <div>
      <h1 className="text-base font-bold text-gray-800 mb-4">📋 交易记录</h1>
      <div className="flex gap-2 mb-4">
        {['', 'IN', 'OUT', 'RETURN', 'LOSS'].map((t) => (
          <button key={t} onClick={() => { setTypeFilter(t); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              typeFilter === t ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>{t === '' ? '全部' : typeLabel(t)}</button>
        ))}
      </div>
      {loading ? <div className="text-center py-10 text-gray-400">加载中...</div> : items.length === 0 ? (
        <div className="text-center py-10 text-gray-400">暂无记录</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 text-gray-500 text-xs">
              <th className="text-left py-3 px-3">时间</th>
              <th className="text-center py-3 px-2">类型</th>
              <th className="text-center py-3 px-2">数量</th>
              <th className="text-left py-3 px-2">员工</th>
              <th className="text-left py-3 px-2">操作人</th>
              <th className="text-left py-3 px-3">备注</th>
              {isAdmin && <th className="text-center py-3 px-2 w-16">操作</th>}
            </tr></thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 last:border-b-0">
                  <td className="py-3 px-3 text-gray-500 text-xs">{dayjs(r.createdAt).format('M/D HH:mm')}</td>
                  <td className="py-3 px-2 text-center"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${typeColor(r.type)}`}>{typeLabel(r.type)}</span></td>
                  <td className={`py-3 px-2 text-center font-semibold ${(r.type === 'IN' || r.type === 'RETURN') ? 'text-green-600' : 'text-gray-800'}`}>{(r.type === 'IN' || r.type === 'RETURN') ? '+' : '-'}{r.quantity}</td>
                  <td className="py-3 px-2 text-gray-600">{r.employeeName || '—'}</td>
                  <td className="py-3 px-2 text-gray-500 text-xs">{r.createdBy}</td>
                  <td className="py-3 px-3 text-gray-400 text-xs max-w-[120px] truncate">{r.note || '—'}</td>
                  {isAdmin && (
                    <td className="py-3 px-2 text-center">
                      {confirmingId === r.id ? (
                        <span className="text-xs">
                          <button onClick={() => handleDelete(r.id)} className="text-red-500 mr-1">确认</button>
                          <button onClick={() => setConfirmingId(null)} className="text-gray-400">取消</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmingId(r.id)} className="text-xs text-red-400 hover:text-red-500">删除</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > pageSize && (
        <div className="flex justify-center gap-3 mt-4 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}
            className="px-4 py-1.5 border border-gray-200 rounded-lg disabled:opacity-30">上一页</button>
          <span className="py-1.5 text-gray-500">{page} / {Math.ceil(total / pageSize)}</span>
          <button disabled={page * pageSize >= total} onClick={() => setPage(page + 1)}
            className="px-4 py-1.5 border border-gray-200 rounded-lg disabled:opacity-30">下一页</button>
        </div>
      )}
    </div>
  );
}
