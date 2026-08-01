import { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

dayjs.extend(utc);
dayjs.extend(timezone);

const WEEKDAY_CN = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

interface MonthlyRestItem {
  userId: string;
  userName: string;
  storeName: string;
  restCount: number;
  restDates: string[];
}

interface Store {
  id: string;
  name: string;
}

interface RestRecord {
  id: string;
  userId: string;
  restDate: string;
  weekStart: string;
  createdBy: string;
  user: { id: string; name: string };
}

export default function RestPage() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(dayjs().startOf('week').add(1, 'day'));
  const [record, setRecord] = useState<RestRecord | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { showToast } = useToast();

  const canUseRest = user?.role === 'ADMIN' || (user as any)?.canSelectRest === true;

  // 月度统计（管理员 + 店长）
  const isManager = user?.role === 'ADMIN' || user?.role === 'STORE_ADMIN';
  const [showMonthly, setShowMonthly] = useState(false);
  const [statsMonth, setStatsMonth] = useState(dayjs().format('YYYY-MM'));
  const [statsStoreId, setStatsStoreId] = useState('');
  const [stores, setStores] = useState<Store[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlyRestItem[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  // 加载门店列表
  useEffect(() => {
    if (user?.role === 'ADMIN') {
      api.get('/users/stores').then((res) => setStores(res.data)).catch(() => {});
    }
  }, [user?.role]);

  const fetchMonthlySummary = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params: any = { month: statsMonth };
      if (user?.role === 'ADMIN' && statsStoreId) params.storeId = statsStoreId;
      const res = await api.get('/weekly-rest/monthly-summary', { params });
      setMonthlySummary(res.data);
    } catch {
      setMonthlySummary([]);
    } finally {
      setStatsLoading(false);
    }
  }, [statsMonth, statsStoreId, user?.role]);

  useEffect(() => {
    if (showMonthly) fetchMonthlySummary();
  }, [showMonthly, fetchMonthlySummary]);

  const fetchRecord = useCallback(async () => {
    try {
      const ws = weekStart.format('YYYY-MM-DD');
      const res = await api.get('/weekly-rest', { params: { weekStart: ws } });
      if (res.data.length > 0) {
        setRecord(res.data[0]);
        setSelectedDate(dayjs(res.data[0].restDate).format('YYYY-MM-DD'));
      } else {
        setRecord(null);
        setSelectedDate('');
      }
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    setLoading(true);
    fetchRecord();
  }, [fetchRecord]);

  const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));

  const nowBeijing = dayjs().tz('Asia/Shanghai');

  const canSelect = (date: dayjs.Dayjs) => {
    // Fri(5), Sat(6), Sun(0) → not selectable
    const dow = date.day();
    if (dow === 0 || dow >= 5) return false;
    // deadline: day before rest date 23:59
    const deadline = date.subtract(1, 'day').endOf('day');
    return nowBeijing.isBefore(deadline);
  };

  const canSubmit = selectedDate && (() => {
    if (!record) return canSelect(dayjs(selectedDate));
    if (selectedDate === dayjs(record.restDate).format('YYYY-MM-DD')) return true;
    return canSelect(dayjs(selectedDate));
  })();

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      await api.put('/weekly-rest', {
        restDate: selectedDate,
        weekStart: weekStart.format('YYYY-MM-DD'),
      });
      showToast(record ? '休息日已更新' : '休息日已选择', 'success');
      fetchRecord();
    } catch (err: any) {
      setError(err.response?.data?.error || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const isReadonly = !canUseRest;

  if (loading) return <div className="text-center text-gray-500 py-10">加载中...</div>;

  // No permission
  if (!canUseRest) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-base font-bold text-gray-800 mb-4">选择休息日</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <p className="text-amber-700 font-medium mb-1">选休功能仅限全天班员工使用</p>
          <p className="text-sm text-amber-500">半天班员工如需休息请使用请假功能</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-base font-bold text-gray-800 mb-4">选择休息日</h1>

      {/* Current selection info */}
      {record && (
        <div className={`p-4 rounded-xl mb-4 ${isReadonly ? 'bg-purple-50 border border-purple-200' : 'bg-blue-50 border border-blue-200'}`}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">本周休息日：</span>
            <span className="text-sm font-bold text-gray-800">
              {dayjs(record.restDate).format('M月D日')}（{WEEKDAY_CN[dayjs(record.restDate).day() === 0 ? 6 : dayjs(record.restDate).day() - 1]}）
            </span>
            {record.createdBy === 'ADMIN' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">由管理员指定</span>
            )}
          </div>
          {isReadonly && !canUseRest && (
            <p className="text-xs text-gray-500 mt-1">选休仅限全天班员工</p>
          )}
        </div>
      )}

      {!record && (
        <p className="text-sm text-gray-500 mb-4">请选择本周周一至周四的一天作为休息日</p>
      )}

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

      {/* Week navigator */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setWeekStart(weekStart.subtract(7, 'day'))}
          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
        >
          ← 上一周
        </button>
        <span className="text-sm font-medium text-gray-600">
          {weekStart.format('M月D日')} ~ {weekStart.add(6, 'day').format('M月D日')}
        </span>
        <button
          onClick={() => setWeekStart(weekStart.add(7, 'day'))}
          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
        >
          下一周 →
        </button>
      </div>

      {/* Day selector */}
      <div className="grid grid-cols-7 gap-2 mb-6">
        {days.map((d, idx) => {
          const dateStr = d.format('YYYY-MM-DD');
          const isSelected = selectedDate === dateStr;
          const isToday = d.isSame(nowBeijing, 'day');
          const selectable = !isReadonly && canSelect(d);
          const dow = d.day();
          const isWeekend = dow === 0 || dow >= 5; // Fri-Sun

          return (
            <button
              key={dateStr}
              disabled={!selectable}
              onClick={() => setSelectedDate(dateStr)}
              className={`flex flex-col items-center py-3 rounded-xl text-sm transition-colors ${
                isSelected
                  ? 'bg-brand text-white'
                  : selectable
                  ? 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                  : 'bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-100'
              } ${isToday ? 'ring-2 ring-brand/30' : ''}`}
            >
              <span className="text-xs font-medium">
                {WEEKDAY_CN[idx]}
                {isWeekend && <span className="ml-0.5 text-red-400">✕</span>}
              </span>
              <span className="text-lg font-bold">{d.format('D')}</span>
              <span className="text-xs">{d.format('M月')}</span>
            </button>
          );
        })}
      </div>

      {/* 月度休息统计（管理员 + 店长） */}
      {isManager && (
        <div className="mt-8 border-t border-gray-200 pt-6">
          <button
            onClick={() => setShowMonthly(!showMonthly)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-brand transition-colors"
          >
            <span className="text-lg">{showMonthly ? '📊' : '📊'}</span>
            月度休息登记
            <span className="text-xs text-gray-400">{showMonthly ? '收起' : '展开'}</span>
          </button>

          {showMonthly && (
            <div className="mt-4 space-y-4">
              {/* 筛选栏 */}
              <div className="flex gap-2 flex-wrap">
                <input
                  type="month"
                  value={statsMonth}
                  onChange={(e) => setStatsMonth(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
                />
                {user?.role === 'ADMIN' && (
                  <select
                    value={statsStoreId}
                    onChange={(e) => setStatsStoreId(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
                  >
                    <option value="">全部门店</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
                <button
                  onClick={fetchMonthlySummary}
                  className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand-dark"
                >
                  查询
                </button>
              </div>

              {statsLoading ? (
                <div className="text-center py-8 text-gray-400 text-sm">加载中...</div>
              ) : monthlySummary.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">暂无数据</div>
              ) : (
                <>
                  {/* 统计卡片 */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
                      <div className="text-xl font-bold text-brand">{monthlySummary.length}</div>
                      <div className="text-xs text-gray-400">全天班人数</div>
                    </div>
                    <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
                      <div className="text-xl font-bold text-purple-600">
                        {monthlySummary.filter((r) => r.restCount > 0).length}
                      </div>
                      <div className="text-xs text-gray-400">已选休</div>
                    </div>
                    <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
                      <div className="text-xl font-bold text-shift-early">
                        {monthlySummary.reduce((s, r) => s + r.restCount, 0)}
                      </div>
                      <div className="text-xs text-gray-400">总选休次数</div>
                    </div>
                  </div>

                  {/* 员工列表 */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-gray-500 text-xs">
                          <th className="text-left py-3 px-3">姓名</th>
                          {user?.role === 'ADMIN' && !statsStoreId && (
                            <th className="text-left py-3 px-3">门店</th>
                          )}
                          <th className="text-center py-3 px-3">本月休息</th>
                          <th className="text-left py-3 px-3">休息日期</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlySummary.map((r) => (
                          <tr key={r.userId} className="border-b border-gray-50 last:border-b-0">
                            <td className="py-3 px-3 font-medium text-gray-800">{r.userName}</td>
                            {user?.role === 'ADMIN' && !statsStoreId && (
                              <td className="py-3 px-3 text-gray-400">{r.storeName}</td>
                            )}
                            <td className="py-3 px-3 text-center">
                              <span className={`font-semibold ${r.restCount > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                                {r.restCount}天
                              </span>
                            </td>
                            <td className="py-3 px-3 text-gray-500 text-xs">
                              {r.restDates.length > 0
                                ? r.restDates.map((d) => dayjs(d).format('M/D')).join('、')
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Submit */}
      {!isReadonly && (
        <div className="flex justify-center">
          <button
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-40 transition-colors text-sm font-medium"
          >
            {submitting ? '提交中...' : record ? '修改休息日' : '确认选择'}
          </button>
        </div>
      )}
    </div>
  );
}
