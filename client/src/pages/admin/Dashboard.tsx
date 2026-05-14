import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';
import api from '../../api/client';

interface Store {
  id: string;
  name: string;
}

interface TodayStats {
  date: string;
  totalEmployees: number;
  clockedInCount: number;
  notClockedInCount: number;
  clockedOutCount: number;
  missingClockOutCount: number;
  clockedIn: { id: string; name: string; email: string; storeName: string; firstIn: string; lastOut: string | null }[];
  notClockedIn: { id: string; name: string; email: string; storeName: string }[];
  missingClockOut: { id: string; name: string; email: string; storeName: string }[];
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState('');

  useEffect(() => {
    api.get('/users/stores').then((res) => setStores(res.data)).catch(() => {});
    fetchStats();
  }, []);

  const fetchStats = (sid = '') => {
    const params = sid ? { storeId: sid } : {};
    api.get('/stats/today', { params }).then((res) => setStats(res.data)).catch(() => {});
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-6">
        管理后台 — 欢迎，{user?.name}
      </h1>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
        <Link
          to="/admin/users"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-1">👥</div>
          <h2 className="text-sm font-semibold text-gray-800">员工管理</h2>
        </Link>
        <Link
          to="/admin/records"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-1">📋</div>
          <h2 className="text-sm font-semibold text-gray-800">打卡记录</h2>
        </Link>
        <Link
          to="/admin/reports"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-1">📊</div>
          <h2 className="text-sm font-semibold text-gray-800">报表</h2>
        </Link>
        <Link
          to="/admin/audit-logs"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-1">🔍</div>
          <h2 className="text-sm font-semibold text-gray-800">操作日志</h2>
        </Link>
      </div>

      {/* Store filter */}
      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm font-medium text-gray-700">门店：</label>
        <select
          value={storeId}
          onChange={(e) => { setStoreId(e.target.value); fetchStats(e.target.value); }}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="">全部门店</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Today stats */}
      {stats && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            今日概况 — {stats.date}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            <StatCard label="总人数" value={stats.totalEmployees} color="text-gray-800" />
            <StatCard label="已打卡" value={stats.clockedInCount} color="text-green-600" />
            <StatCard label="未打卡" value={stats.notClockedInCount} color="text-red-600" />
            <StatCard label="已签退" value={stats.clockedOutCount} color="text-blue-600" />
            <StatCard label="缺签退" value={stats.missingClockOutCount} color="text-orange-600" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {stats.notClockedIn.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-red-600 mb-2">
                  ⚠️ 未打卡 ({stats.notClockedIn.length})
                </h3>
                <div className="space-y-1">
                  {stats.notClockedIn.map((e) => (
                    <div key={e.id} className="text-sm text-gray-600 flex justify-between">
                      <span>{e.name}</span>
                      <span className="text-gray-400 text-xs">{e.storeName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {stats.missingClockOut.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-orange-600 mb-2">
                  ⚠️ 未签退 ({stats.missingClockOut.length})
                </h3>
                <div className="space-y-1">
                  {stats.missingClockOut.map((e) => (
                    <div key={e.id} className="text-sm text-gray-600 flex justify-between">
                      <span>{e.name}</span>
                      <span className="text-gray-400 text-xs">{e.storeName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-green-600 mb-2">
                ✅ 已打卡 ({stats.clockedIn.length})
              </h3>
              <div className="space-y-1">
                {stats.clockedIn.map((e) => (
                  <div key={e.id} className="text-sm text-gray-600 flex justify-between">
                    <span>{e.name}</span>
                    <span className="text-gray-400 text-xs">
                      {e.storeName} {e.firstIn}{e.lastOut ? ` → ${e.lastOut}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}
