import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import dayjs from 'dayjs';

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

interface Notice {
  id: string;
  type: 'rest' | 'leave';
  name: string;
  dateLabel: string;
  detail: string;
}

const WEEKDAY_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const LEAVE_TYPE_CN: Record<string, string> = { ANNUAL: '年假', SICK: '病假', PERSONAL: '事假' };

export default function StoreAdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string; canSelectRest?: boolean }[]>([]);
  const [restForm, setRestForm] = useState({ userId: '', date: '' });
  const [leaveForm, setLeaveForm] = useState({ userId: '', type: 'ANNUAL', startDate: '', endDate: '', reason: '' });
  const [submitting, setSubmitting] = useState<string>(''); // 'rest' | 'leave' | ''

  const storeId = (user as any)?.storeId;

  useEffect(() => {
    api.get('/stats/today').then((res) => setStats(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (storeId) {
      api.get('/users', { params: { storeId } }).then((res) => {
        setEmployees(res.data.filter((u: any) => u.role === 'EMPLOYEE'));
      }).catch(() => {});
    }
  }, [storeId]);

  useEffect(() => {
    const storeId = (user as any)?.storeId;
    if (!storeId) return;

    const weekStart = dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD');
    const today = dayjs().format('YYYY-MM-DD');
    const endDate = dayjs().endOf('week').format('YYYY-MM-DD');

    Promise.all([
      api.get('/weekly-rest/store-week', { params: { storeId, weekStart } }).catch(() => ({ data: { restMap: {} } })),
      api.get('/leaves', { params: { storeId, startDate: today, endDate } }).catch(() => ({ data: { items: [] } })),
    ]).then(([restRes, leaveRes]) => {
      const items: Notice[] = [];

      // Rest days
      const restMap = restRes.data.restMap || {};
      for (const [userId, dateStr] of Object.entries(restMap)) {
        items.push({
          id: `rest-${userId}`,
          type: 'rest',
          name: '', // name will be filled from user list
          dateLabel: `${dayjs(dateStr as string).format('M月D日')} ${WEEKDAY_CN[dayjs(dateStr as string).day()]}`,
          detail: '休息',
        });
      }

      // Leaves
      const leaves = leaveRes.data.items || [];
      for (const l of leaves) {
        if (l.status !== 'PENDING' && l.status !== 'APPROVED') continue;
        const start = dayjs(l.startDate).format('M月D日');
        const end = dayjs(l.endDate).format('M月D日');
        const dateRange = start === end ? start : `${start}~${end}`;
        items.push({
          id: `leave-${l.id}`,
          type: 'leave',
          name: l.user?.name || '',
          dateLabel: dateRange,
          detail: `${LEAVE_TYPE_CN[l.type] || l.type}${l.status === 'PENDING' ? '（待审批）' : '（已通过）'}`,
        });
      }

      setNotices(items);
    }).catch(() => {});
  }, [user]);

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

      {/* Store notices */}
      {notices.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-3">门店通告</h2>
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 space-y-2">
            {notices.map((n) => (
              <div key={n.id} className="flex items-center gap-3 text-sm">
                {n.type === 'rest' ? (
                  <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">休</span>
                ) : (
                  <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center text-xs font-bold">假</span>
                )}
                <span className="font-medium text-gray-800">{n.name}</span>
                <span className="text-gray-500">{n.dateLabel}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  n.type === 'rest' ? 'bg-purple-100 text-purple-600' : 'bg-amber-100 text-amber-700'
                }`}>
                  {n.detail}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rest / Leave Management */}
      <div className="mb-6 space-y-4">
        <div className="bg-white rounded-2xl border-2 border-purple-300 p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-3">🏠 员工选休</h3>
          <select value={restForm.userId} onChange={(e) => setRestForm({ ...restForm, userId: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white mb-2">
            <option value="">选择员工</option>
            {employees.filter((e: any) => e.canSelectRest).map((e: any) => (<option key={e.id} value={e.id}>{e.name}</option>))}
          </select>
          <input type="date" value={restForm.date} onChange={(e) => setRestForm({ ...restForm, date: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm mb-2" />
          <button disabled={!restForm.userId || !restForm.date || submitting !== ''}
            onClick={async () => { setSubmitting('rest'); try { const weekStart = dayjs(restForm.date).startOf('week').add(1, 'day').format('YYYY-MM-DD'); await api.put('/weekly-rest', { userId: restForm.userId, restDate: restForm.date, weekStart, storeId }); alert('选休设置成功'); setRestForm({ userId: '', date: '' }); } catch (err: any) { alert(err.response?.data?.error || '操作失败'); } finally { setSubmitting(''); } }}
            className="w-full py-2 rounded-xl bg-purple-500 text-white text-sm font-medium hover:bg-purple-600 disabled:opacity-40">
            {submitting === 'rest' ? '提交中...' : '设为休息日'}
          </button>
        </div>
        <div className="bg-white rounded-2xl border-2 border-amber-300 p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-3">📝 员工请假</h3>
          <select value={leaveForm.userId} onChange={(e) => setLeaveForm({ ...leaveForm, userId: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white mb-2">
            <option value="">选择员工</option>
            {employees.map((e: any) => (<option key={e.id} value={e.id}>{e.name}</option>))}
          </select>
          <select value={leaveForm.type} onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white mb-2">
            <option value="ANNUAL">年假</option><option value="SICK">病假</option><option value="PERSONAL">事假</option>
          </select>
          <div className="flex gap-2 mb-2">
            <input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm" />
            <input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm" />
          </div>
          <input type="text" value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
            placeholder="原因（选填）" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm mb-2" />
          <button disabled={!leaveForm.userId || !leaveForm.startDate || !leaveForm.endDate || submitting !== ''}
            onClick={async () => { setSubmitting('leave'); try { await api.post('/leaves', { userId: leaveForm.userId, type: leaveForm.type, startDate: leaveForm.startDate, endDate: leaveForm.endDate, reason: leaveForm.reason }); alert('请假提交成功'); setLeaveForm({ userId: '', type: 'ANNUAL', startDate: '', endDate: '', reason: '' }); } catch (err: any) { alert(err.response?.data?.error || '操作失败'); } finally { setSubmitting(''); } }}
            className="w-full py-2 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-40">
            {submitting === 'leave' ? '提交中...' : '提交请假'}
          </button>
        </div>
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
