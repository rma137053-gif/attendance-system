import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';
import api from '../../api/client';

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

export default function StoreAdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<TodayStats | null>(null);

  useEffect(() => {
    api.get('/stats/today').then((res) => setStats(res.data)).catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-1">
        {user?.store?.name || '门店'}
      </h1>
      <p className="text-gray-500 text-sm mb-6">欢迎，{user?.name}</p>

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Link
          to="/store-admin/clock"
          className="bg-brand text-white rounded-2xl p-5 hover:bg-brand-dark active:scale-[0.98] transition-all text-center"
        >
          <div className="text-2xl mb-1">📸</div>
          <h2 className="text-sm font-bold">员工打卡</h2>
        </Link>
        <Link
          to="/store-admin/employees"
          className="bg-surface-card rounded-2xl border-2 border-gray-200 p-5 hover:border-brand active:scale-[0.98] transition-all text-center"
        >
          <div className="text-2xl mb-1">👥</div>
          <h2 className="text-sm font-semibold text-gray-800">员工管理</h2>
        </Link>
        <Link
          to="/store-admin/records"
          className="bg-surface-card rounded-2xl border-2 border-gray-200 p-5 hover:border-brand active:scale-[0.98] transition-all text-center"
        >
          <div className="text-2xl mb-1">📋</div>
          <h2 className="text-sm font-semibold text-gray-800">打卡记录</h2>
        </Link>
      </div>

      {/* Today stats */}
      {stats && (
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-3">
            今日概况 — {stats.date}
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 mb-6">
            <StatCard label="总人数" value={stats.totalEmployees} color="text-gray-800" bg="bg-gray-100" />
            <StatCard label="已打卡" value={stats.clockedInCount} color="text-clock-in" bg="bg-clock-in-light" />
            <StatCard label="未打卡" value={stats.notClockedInCount} color="text-danger" bg="bg-danger-light" />
            <StatCard label="已签退" value={stats.clockedOutCount} color="text-blue-600" bg="bg-blue-50" />
            <StatCard label="缺签退" value={stats.missingClockOutCount} color="text-clock-out" bg="bg-clock-out-light" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {stats.notClockedIn.length > 0 && (
              <div className="bg-danger-light rounded-2xl border border-red-200 p-4">
                <h3 className="text-sm font-bold text-danger mb-2">
                  未打卡 ({stats.notClockedIn.length})
                </h3>
                <div className="space-y-1">
                  {stats.notClockedIn.map((e) => (
                    <div key={e.id} className="text-sm text-gray-700">{e.name}</div>
                  ))}
                </div>
              </div>
            )}
            {stats.missingClockOut.length > 0 && (
              <div className="bg-clock-out-light rounded-2xl border border-clock-out-border p-4">
                <h3 className="text-sm font-bold text-clock-out mb-2">
                  缺签退 ({stats.missingClockOut.length})
                </h3>
                <div className="space-y-1">
                  {stats.missingClockOut.map((e) => (
                    <div key={e.id} className="text-sm text-gray-700">{e.name}</div>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-clock-in-light rounded-2xl border border-clock-in-border p-4">
              <h3 className="text-sm font-bold text-clock-in mb-2">
                已打卡 ({stats.clockedIn.length})
              </h3>
              <div className="space-y-1">
                {stats.clockedIn.map((e) => (
                  <div key={e.id} className="text-sm text-gray-700 flex justify-between">
                    <span>{e.name}</span>
                    <span className="text-gray-500 font-mono text-xs">
                      {e.firstIn}{e.lastOut ? ` → ${e.lastOut}` : ''}
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

function StatCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className="bg-surface-card rounded-2xl border border-gray-200 p-5 text-center">
      <div className={`text-3xl font-extrabold ${color}`}>{value}</div>
      <div className={`text-xs font-medium mt-1.5 px-2 py-0.5 rounded-full inline-block ${bg} ${color}`}>{label}</div>
    </div>
  );
}
