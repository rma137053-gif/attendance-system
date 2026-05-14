import { useState } from 'react';
import api from '../../api/client';
import { useToast } from '../../hooks/useToast';

interface ReportRow {
  userId: string;
  userName: string;
  userEmail: string;
  storeName: string;
  clockInCount: number;
  clockOutCount: number;
  daysWithRecords: number;
  totalHours: number;
  lateCount: number;
  earlyCount: number;
  missingClockOut: boolean;
  weekStart?: string;
  weekEnd?: string;
  month?: string;
  year?: string;
}

interface ReportSummary {
  userName: string;
  userEmail: string;
  storeName: string;
  clockInCount: number;
  clockOutCount: number;
  daysWithRecords: number;
  totalHours: number;
  lateCount: number;
  earlyCount: number;
  missingClockOut: boolean;
}

export default function Reports() {
  const [type, setType] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const [date, setDate] = useState('');
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const { error: showError } = useToast();

  const fetchReport = async () => {
    setLoading(true);
    try {
      const endpoint = `/reports/${type}`;
      const paramKey = type === 'weekly' ? 'date' : type === 'monthly' ? 'month' : 'year';
      const params = date ? { [paramKey]: date } : {};
      const res = await api.get(endpoint, { params });
      setRows(res.data.rows);
      setSummary(res.data.summary);
    } catch (err: any) {
      showError(err.response?.data?.error || '获取报表失败');
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = async () => {
    const params: any = { type };
    const paramKey = type === 'weekly' ? 'date' : type === 'monthly' ? 'month' : 'year';
    if (date) params[paramKey] = date;
    try {
      const res = await api.get('/reports/export', { params, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${type}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      showError('导出失败');
    }
  };

  const dateInputType = type === 'yearly' ? 'number' : type === 'weekly' ? 'date' : 'month';
  const datePlaceholder = type === 'yearly' ? '如 2026' : type === 'weekly' ? '起始日期（周一）' : '月份';

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-6">报表</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">报表类型</label>
            <select
              value={type}
              onChange={(e) => { setType(e.target.value as any); setRows([]); setSummary(null); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="weekly">周报</option>
              <option value="monthly">月报</option>
              <option value="yearly">年报</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{datePlaceholder}</label>
            <input
              type={dateInputType}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder={datePlaceholder}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <button
            onClick={fetchReport}
            disabled={loading}
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-dark transition-colors text-sm disabled:opacity-50"
          >
            {loading ? '查询中...' : '查询'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          工作时间：09:00–18:00。超过 09:00 打卡记为迟到，早于 18:00 签退记为早退。工时按每天首次上班 → 末次下班计算。
        </p>
      </div>

      {rows.length > 0 && summary && (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={exportCsv}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              导出 CSV
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">姓名</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">邮箱</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600">上班</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600">下班</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600">出勤</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-800 bg-blue-50">总工时</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600">迟到</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600">早退</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600">异常</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.userId}>
                    <td className="px-4 py-3 text-gray-800">{row.userName}</td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{row.userEmail}</td>
                    <td className="px-3 py-3 text-center text-green-600 font-medium">{row.clockInCount}</td>
                    <td className="px-3 py-3 text-center text-orange-600 font-medium">{row.clockOutCount}</td>
                    <td className="px-3 py-3 text-center">{row.daysWithRecords}</td>
                    <td className="px-3 py-3 text-center bg-blue-50 font-bold text-blue-700">
                      {row.totalHours > 0 ? `${row.totalHours}h` : '-'}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {row.lateCount > 0 ? <span className="text-red-600 font-medium">{row.lateCount}</span> : <span className="text-gray-300">0</span>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {row.earlyCount > 0 ? <span className="text-orange-600 font-medium">{row.earlyCount}</span> : <span className="text-gray-300">0</span>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {row.missingClockOut ? <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">缺下班卡</span> : <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">正常</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                  <td className="px-4 py-3 text-gray-800">合计</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{summary.userEmail}</td>
                  <td className="px-3 py-3 text-center text-green-700">{summary.clockInCount}</td>
                  <td className="px-3 py-3 text-center text-orange-700">{summary.clockOutCount}</td>
                  <td className="px-3 py-3 text-center">{summary.daysWithRecords}</td>
                  <td className="px-3 py-3 text-center bg-blue-50 font-bold text-blue-700">
                    {summary.totalHours > 0 ? `${summary.totalHours}h` : '-'}
                  </td>
                  <td className="px-3 py-3 text-center text-red-700">{summary.lateCount}</td>
                  <td className="px-3 py-3 text-center text-orange-700">{summary.earlyCount}</td>
                  <td className="px-3 py-3 text-center">
                    {summary.missingClockOut ? <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">有异常</span> : <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">正常</span>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
