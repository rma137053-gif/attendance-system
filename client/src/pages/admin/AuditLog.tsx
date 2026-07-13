import { useState, useEffect } from 'react';
import api from '../../api/client';

interface LogEntry {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  details: string | null;
  createdAt: string;
}

export default function AuditLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 30;

  const fetchLogs = async (p: number) => {
    setLoading(true);
    try {
      const res = await api.get('/audit-logs', { params: { page: p, pageSize } });
      setLogs(res.data.logs);
      setTotal(res.data.total);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(page);
  }, [page]);

  const totalPages = Math.ceil(total / pageSize);

  const actionLabel = (action: string) => {
    const map: Record<string, string> = {
      USER_CREATED: '添加员工',
      USER_UPDATED: '编辑员工',
      USER_STATUS_CHANGED: '启停员工',
      CLOCK_IN: '上班打卡',
      CLOCK_OUT: '下班打卡',
      REPORT_VIEWED: '查看报表',
    };
    return map[action] || action;
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-6">操作日志</h1>

      {loading ? (
        <div className="text-center text-gray-500 py-10">加载中...</div>
      ) : logs.length === 0 ? (
        <div className="text-center text-gray-500 py-10">暂无操作记录</div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-32">时间</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">操作</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">详情</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((l) => {
                  let detail = '';
                  try {
                    const d = JSON.parse(l.details || '{}');
                    detail = `${d.method || ''} ${d.path || ''}`;
                  } catch {
                    detail = l.details || '';
                  }
                  return (
                    <tr key={l.id}>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{l.createdAt}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                          {actionLabel(l.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{detail}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                上一页
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-500">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
