import { useState, useEffect } from 'react';
import api from '../api/client';
import dayjs from 'dayjs';

interface Summary {
  totalStock: number;
  monthIn: number; monthOut: number; monthLoss: number;
  recent: { id: string; type: string; quantity: number; employeeName?: string; note?: string; createdBy: string; createdAt: string }[];
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/transactions/summary').then((res) => setSummary(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-10 text-gray-400">加载中...</div>;
  if (!summary) return <div className="text-center py-10 text-gray-400">加载失败</div>;

  const typeLabel = (t: string) => t === 'IN' ? '入库' : t === 'OUT' ? '使用' : t === 'RETURN' ? '退回' : '报损';
  const typeColor = (t: string) => t === 'IN' ? 'text-green-600' : t === 'OUT' ? 'text-blue-600' : t === 'RETURN' ? 'text-teal-600' : 'text-red-600';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
        <div className="text-sm text-gray-400 mb-1">当前库存总量</div>
        <div className={`text-5xl font-extrabold ${summary.totalStock < 0 ? 'text-red-500' : 'text-brand'}`}>
          {summary.totalStock.toLocaleString()}
        </div>
        <div className="text-xs text-gray-400 mt-1">张吊牌</div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="text-xs text-gray-400">本月入库</div>
          <div className="text-xl font-bold text-green-600">+{summary.monthIn}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="text-xs text-gray-400">本月使用</div>
          <div className="text-xl font-bold text-blue-600">-{summary.monthOut}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="text-xs text-gray-400">本月报损</div>
          <div className="text-xl font-bold text-red-600">-{summary.monthLoss}</div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-600 mb-3">最近交易</h2>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {summary.recent.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">暂无记录</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {summary.recent.map((r) => (
                <div key={r.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <span className={`font-semibold text-sm ${typeColor(r.type)}`}>{typeLabel(r.type)}</span>
                    <span className={`font-bold ml-2 ${r.type === 'IN' || r.type === 'RETURN' ? 'text-green-600' : 'text-gray-800'}`}>{r.type === 'IN' || r.type === 'RETURN' ? '+' : '-'}{r.quantity}张</span>
                    {r.employeeName && <span className="text-gray-400 text-xs ml-2">{r.employeeName}</span>}
                  </div>
                  <div className="text-xs text-gray-400">
                    {dayjs(r.createdAt).format('M/D HH:mm')} · {r.createdBy}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
