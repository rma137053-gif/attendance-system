import { useState, useEffect } from 'react';
import api from '../../api/client';

interface Record {
  id: string;
  type: 'CLOCK_IN' | 'CLOCK_OUT';
  createdAt: string;
  hasPhoto: boolean;
  photoKey?: string;
}

export default function MyRecords() {
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [viewPhotoId, setViewPhotoId] = useState<string | null>(null);
  const pageSize = 10;

  const fetchRecords = async (p: number) => {
    setLoading(true);
    try {
      const res = await api.get('/records', { params: { page: p, pageSize } });
      setRecords(res.data.records);
      setTotal(res.data.total);
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords(page);
  }, [page]);

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

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-6">我的打卡记录</h1>

      {loading ? (
        <div className="text-center text-gray-500 py-10">加载中...</div>
      ) : records.length === 0 ? (
        <div className="text-center text-gray-500 py-10">暂无打卡记录</div>
      ) : (
        <>
          <div className="space-y-3">
            {records.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        r.type === 'CLOCK_IN' ? 'bg-green-500' : 'bg-orange-500'
                      }`}
                    />
                    <span className="font-medium text-gray-800">
                      {r.type === 'CLOCK_IN' ? '上班' : '下班'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">{r.createdAt}</div>
                </div>
                {r.hasPhoto && (
                  <button
                    onClick={() => handleViewPhoto(r.id)}
                    className="text-sm text-brand hover:text-brand-dark transition-colors"
                  >
                    {viewPhotoId === r.id ? '收起' : '查看照片'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {viewPhotoId && (
            <div className="mt-4 bg-white rounded-lg border border-gray-200 p-4">
              {loadingPhoto ? (
                <div className="text-sm text-gray-500 py-4 text-center">加载照片中...</div>
              ) : photoUrl ? (
                <img src={photoUrl} alt="打卡照片" className="max-w-sm rounded-lg" />
              ) : (
                <div className="text-sm text-red-500 py-4">照片加载失败</div>
              )}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 transition-colors"
              >
                上一页
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 transition-colors"
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
