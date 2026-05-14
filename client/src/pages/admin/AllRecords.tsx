import { useState, useEffect } from 'react';
import api from '../../api/client';

import { useToast } from '../../hooks/useToast';

interface Record {
  id: string;
  type: 'CLOCK_IN' | 'CLOCK_OUT';
  createdAt: string;
  hasPhoto: boolean;
  isAnomalous: boolean;
  user: { id: string; name: string; email: string; store?: { id: string; name: string } | null };
}

interface User {
  id: string;
  name: string;
}

interface Store {
  id: string;
  name: string;
}

export default function AllRecords() {
  const { success, error: showError } = useToast();
  const [records, setRecords] = useState<Record[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [viewPhotoId, setViewPhotoId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [filters, setFilters] = useState({
    userId: '',
    storeId: '',
    type: '',
    startDate: '',
    endDate: '',
    anomalous: '',
  });
  const pageSize = 15;

  useEffect(() => {
    Promise.all([
      api.get('/users'),
      api.get('/users/stores'),
    ]).then(([usersRes, storesRes]) => {
      setUsers(usersRes.data);
      setStores(storesRes.data);
    }).catch(() => {});
  }, []);

  const fetchRecords = async (p: number) => {
    setLoading(true);
    try {
      const params: any = { page: p, pageSize };
      if (filters.userId) params.userId = filters.userId;
      if (filters.storeId) params.storeId = filters.storeId;
      if (filters.type) params.type = filters.type;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.anomalous) params.anomalous = filters.anomalous;
      const res = await api.get('/records', { params });
      setRecords(res.data.records);
      setTotal(res.data.total);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords(page);
  }, [page, filters]);

  const totalPages = Math.ceil(total / pageSize);

  const handleViewPhoto = async (id: string) => {
    if (viewPhotoId === id) {
      setViewPhotoId(null);
      setPhotoUrl(null);
      return;
    }
    setViewPhotoId(id);
    setLoadingPhoto(true);
    try {
      const res = await api.get(`/photos/${id}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      setPhotoUrl(url);
    } catch {
      setPhotoUrl(null);
    } finally {
      setLoadingPhoto(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-6">全员打卡记录</h1>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">门店</label>
            <select
              value={filters.storeId}
              onChange={(e) => { setFilters({ ...filters, storeId: e.target.value }); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">全部门店</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">员工</label>
            <select
              value={filters.userId}
              onChange={(e) => { setFilters({ ...filters, userId: e.target.value }); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">全部</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">类型</label>
            <select
              value={filters.type}
              onChange={(e) => { setFilters({ ...filters, type: e.target.value }); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">全部</option>
              <option value="CLOCK_IN">上班</option>
              <option value="CLOCK_OUT">下班</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">异常</label>
            <select
              value={filters.anomalous}
              onChange={(e) => { setFilters({ ...filters, anomalous: e.target.value }); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">全部</option>
              <option value="true">仅异常</option>
              <option value="false">正常</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">开始日期</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => { setFilters({ ...filters, startDate: e.target.value }); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">结束日期</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => { setFilters({ ...filters, endDate: e.target.value }); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-10">加载中...</div>
      ) : records.length === 0 ? (
        <div className="text-center text-gray-500 py-10">暂无记录</div>
      ) : (
        <>
          <div className="space-y-2">
            {records.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-lg border border-gray-200 p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{r.user.name}</span>
                      <span className="text-xs text-gray-400">{r.user.email}</span>
                      {r.user.store && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{r.user.store.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          r.type === 'CLOCK_IN' ? 'bg-green-500' : 'bg-orange-500'
                        }`}
                      />
                      <span className="text-sm text-gray-600">
                        {r.type === 'CLOCK_IN' ? '上班' : '下班'}
                      </span>
                      <span className="text-sm text-gray-400">{r.createdAt}</span>
                      {r.isAnomalous && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">异常</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {r.hasPhoto && (
                      <button
                        onClick={() => handleViewPhoto(r.id)}
                        className="text-sm text-brand hover:text-brand-dark"
                      >
                        {viewPhotoId === r.id ? '收起' : '查看照片'}
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        try {
                          await api.patch(`/records/${r.id}/anomaly`);
                          success(r.isAnomalous ? '已标记为正常' : '已标记为异常');
                          fetchRecords(page);
                        } catch (err: any) {
                          showError(err.response?.data?.error || '操作失败');
                        }
                      }}
                      className={`text-xs ${r.isAnomalous ? 'text-green-500 hover:text-green-600' : 'text-yellow-500 hover:text-yellow-600'}`}
                    >
                      {r.isAnomalous ? '✓ 标记正常' : '标记异常'}
                    </button>
                  </div>
                </div>
                {viewPhotoId === r.id && (
                  <div className="mt-3">
                    {loadingPhoto ? (
                      <div className="text-sm text-gray-500 py-4">加载照片中...</div>
                    ) : photoUrl ? (
                      <img src={photoUrl} alt="打卡照片" className="max-w-xs rounded-lg" />
                    ) : (
                      <div className="text-sm text-red-500 py-4">照片加载失败</div>
                    )}
                  </div>
                )}
              </div>
            ))}
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
