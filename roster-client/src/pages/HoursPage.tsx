import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import Spinner from '../components/Spinner';
import { ChevronLeft, ChevronRight } from '../components/Icon';
import dayjs from 'dayjs';

interface ReportRow {
  userId: string;
  userName: string;
  userEmail: string;
  storeName: string;
  clockInCount: number;
  clockOutCount: number;
  daysWithRecords: number;
  workHours: string;
  overtime: string;
  overtimeVoluntary: string;
  overtimeCoverage: string;
  earlyDeparture: string;
  lateCount: number;
  lateMinutes: string;
  earlyCount: number;
  missingClockOut: boolean;
  leaveDays: number;
  restDays: number;
}

interface DailyItem {
  date: string;
  dow: number;
  roster: { startTime: string; endTime: string } | null;
  ins: string[];
  outs: string[];
  isLeave: boolean;
  isRest: boolean;
}

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];

export default function HoursPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role === 'ADMIN';
  const [currentMonth, setCurrentMonth] = useState(dayjs().startOf('month'));
  const [items, setItems] = useState<ReportRow[]>([]);
  const [summary, setSummary] = useState<ReportRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [dailyData, setDailyData] = useState<DailyItem[]>([]);
  const [dailyLoading, setDailyLoading] = useState(false);

  const monthStr = currentMonth.format('YYYY-MM');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/monthly', { params: { month: monthStr } });
      const data = res.data;
      setItems(data.rows || data);
      setSummary(data.summary || null);
    } catch {
      showToast('加载工时数据失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [monthStr]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleDetail = async (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(userId);
    setDailyLoading(true);
    try {
      const res = await api.get('/reports/user-daily', { params: { userId, month: monthStr } });
      setDailyData(res.data);
    } catch {
      showToast('加载明细失败', 'error');
      setExpandedUserId(null);
    } finally {
      setDailyLoading(false);
    }
  };

  const exportCsv = () => {
    const headers = ['姓名', '门店', '出勤天', '请假天', '选休天', '工时', '主动加班', '被动加班', '早退', '迟到(次)', '迟到(分钟)', '缺卡'];
    const lines = [headers.join(',')];
    items.forEach((r) => {
      lines.push([
        r.userName, r.storeName, r.daysWithRecords, r.leaveDays || 0, r.restDays || 0,
        r.workHours, r.overtimeVoluntary !== '0' ? r.overtimeVoluntary : '0',
        r.overtimeCoverage !== '0' ? r.overtimeCoverage : '0',
        r.earlyDeparture !== '0' ? r.earlyDeparture : '0',
        r.lateCount || '', r.lateMinutes || '', r.missingClockOut ? '是' : '否',
      ].join(','));
    });
    if (summary) {
      lines.push(['合计', '', summary.daysWithRecords, summary.leaveDays || 0, summary.restDays || 0,
        summary.workHours, summary.overtimeVoluntary !== '0' ? summary.overtimeVoluntary : '0',
        summary.overtimeCoverage !== '0' ? summary.overtimeCoverage : '0',
        summary.earlyDeparture !== '0' ? summary.earlyDeparture : '0',
        summary.lateCount || '', summary.lateMinutes || '', summary.missingClockOut ? '是' : '否',
      ].join(','));
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `工时统计_${monthStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const prevMonth = () => setCurrentMonth(currentMonth.subtract(1, 'month'));
  const nextMonth = () => setCurrentMonth(currentMonth.add(1, 'month'));

  const tdClass = 'py-2.5 px-2 text-center';
  const thClass = 'py-2.5 px-2 text-center';

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold text-gray-800">工时统计</h1>
        {!loading && items.length > 0 && (
          <button onClick={exportCsv} className="px-3 py-1.5 text-xs font-medium bg-brand-light text-brand rounded-lg hover:bg-brand/10 transition-colors">
            导出 CSV
          </button>
        )}
      </div>

      <div className="flex items-center justify-between bg-white rounded-2xl p-3 border border-gray-100 shadow-sm">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <span className="text-base font-semibold text-gray-700">{currentMonth.format('YYYY年M月')}</span>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {loading ? <Spinner /> : items.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500 text-xs">
                <th className="text-left py-2.5 px-3">姓名</th>
                {isAdmin && <th className={`text-left ${thClass} hidden sm:table-cell`}>门店</th>}
                <th className={thClass}>出勤</th>
                <th className={`${thClass} hidden sm:table-cell`}>请假</th>
                <th className={`${thClass} hidden sm:table-cell`}>选休</th>
                <th className={thClass}>工时</th>
                <th className={thClass}>主动加班</th>
                <th className={`${thClass} hidden sm:table-cell`}>被动加班</th>
                <th className={`${thClass} hidden sm:table-cell`}>早退</th>
                <th className={thClass}>迟到</th>
                <th className={thClass}>缺卡</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <><tr
                  key={r.userId}
                  onClick={() => toggleDetail(r.userId)}
                  className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${expandedUserId === r.userId ? 'bg-brand-light/30' : ''}`}
                >
                  <td className="py-2.5 px-3 font-medium text-gray-800">{r.userName}</td>
                  {isAdmin && <td className={`${tdClass} text-gray-400 hidden sm:table-cell`}>{r.storeName}</td>}
                  <td className={`${tdClass} text-gray-600`}>{r.daysWithRecords}</td>
                  <td className={`${tdClass} text-gray-600 hidden sm:table-cell`}>{r.leaveDays || '—'}</td>
                  <td className={`${tdClass} hidden sm:table-cell font-medium ${r.restDays > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                    {r.restDays > 0 ? `${r.restDays}天` : '—'}
                  </td>
                  <td className={`${tdClass} font-semibold text-brand`}>{r.workHours}</td>
                  <td className={`${tdClass} font-medium ${r.overtimeVoluntary !== '0' ? 'text-danger' : 'text-gray-400'}`}>
                    {r.overtimeVoluntary !== '0' ? `+${r.overtimeVoluntary}` : '—'}
                  </td>
                  <td className={`${tdClass} font-medium hidden sm:table-cell ${r.overtimeCoverage !== '0' ? 'text-purple-600' : 'text-gray-400'}`}>
                    {r.overtimeCoverage !== '0' ? `+${r.overtimeCoverage}` : '—'}
                  </td>
                  <td className={`${tdClass} font-medium hidden sm:table-cell ${r.earlyDeparture !== '0' ? 'text-anomaly' : 'text-gray-400'}`}>
                    {r.earlyDeparture !== '0' ? `-${r.earlyDeparture}` : '—'}
                  </td>
                  <td className={tdClass}>{r.lateCount > 0 ? <span className="text-anomaly font-medium">{r.lateCount}次 / {r.lateMinutes}</span> : <span className="text-gray-400">—</span>}</td>
                  <td className={tdClass}>{r.missingClockOut ? <span className="text-danger text-xs">⚠️</span> : <span className="text-gray-400">—</span>}</td>
                </tr>
                {/* 展开的每日明细 */}
                {expandedUserId === r.userId && (
                  <tr key={`${r.userId}-detail`}>
                    <td colSpan={isAdmin ? 11 : 10} className="bg-gray-50 px-3 py-3">
                      {dailyLoading ? (
                        <div className="text-center py-4 text-gray-400 text-xs">加载中...</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-400 border-b border-gray-200">
                                <th className="text-left py-1.5 pr-2">日期</th>
                                <th className="text-left py-1.5 px-1">排班</th>
                                <th className="text-left py-1.5 px-1">打卡</th>
                                <th className="text-center py-1.5 px-1 w-10">假</th>
                                <th className="text-center py-1.5 px-1 w-10">休</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dailyData.filter((d) => d.roster || d.ins.length > 0 || d.isLeave || d.isRest).map((d) => {
                                const rosterStr = d.roster ? `${d.roster.startTime}-${d.roster.endTime}` : '';
                                const clockStr = [d.ins.join(','), d.outs.join(',')].filter((s) => s).join('→');
                                return (
                                  <tr key={d.date} className="border-b border-gray-100 last:border-b-0">
                                    <td className="py-1 pr-2 text-gray-500 whitespace-nowrap">
                                      {dayjs(d.date).format('M/D')} {WEEKDAY[d.dow]}
                                    </td>
                                    <td className={`py-1 px-1 whitespace-nowrap ${d.roster ? 'text-gray-700' : 'text-gray-300'}`}>
                                      {d.roster ? rosterStr : '休'}
                                    </td>
                                    <td className={`py-1 px-1 font-mono ${d.ins.length > 0 || d.outs.length > 0 ? 'text-gray-700' : 'text-gray-300'}`}>
                                      {clockStr || '—'}
                                    </td>
                                    <td className="py-1 px-1 text-center">
                                      {d.isLeave ? <span className="text-amber-600 font-medium">假</span> : <span className="text-gray-300">—</span>}
                                    </td>
                                    <td className="py-1 px-1 text-center">
                                      {d.isRest ? <span className="text-purple-500 font-medium">休</span> : <span className="text-gray-300">—</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                </>
              ))}
            </tbody>
            {summary && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-xs">
                  <td className="py-2.5 px-3 text-gray-700">合计</td>
                  {isAdmin && <td className={`${tdClass} text-gray-400 hidden sm:table-cell`}>—</td>}
                  <td className={`${tdClass} text-gray-700`}>{summary.daysWithRecords}</td>
                  <td className={`${tdClass} text-gray-700 hidden sm:table-cell`}>{summary.leaveDays || '—'}</td>
                  <td className={`${tdClass} text-gray-700 hidden sm:table-cell`}>{summary.restDays || '—'}</td>
                  <td className={`${tdClass} text-brand`}>{summary.workHours}</td>
                  <td className={`${tdClass} ${summary.overtimeVoluntary !== '0' ? 'text-danger' : 'text-gray-400'}`}>
                    {summary.overtimeVoluntary !== '0' ? `+${summary.overtimeVoluntary}` : '—'}
                  </td>
                  <td className={`${tdClass} hidden sm:table-cell ${summary.overtimeCoverage !== '0' ? 'text-purple-600' : 'text-gray-400'}`}>
                    {summary.overtimeCoverage !== '0' ? `+${summary.overtimeCoverage}` : '—'}
                  </td>
                  <td className={`${tdClass} hidden sm:table-cell ${summary.earlyDeparture !== '0' ? 'text-anomaly' : 'text-gray-400'}`}>
                    {summary.earlyDeparture !== '0' ? `-${summary.earlyDeparture}` : '—'}
                  </td>
                  <td className={tdClass}>{summary.lateCount > 0 ? <span className="text-anomaly font-medium">{summary.lateCount}次 / {summary.lateMinutes}</span> : <span className="text-gray-400">—</span>}</td>
                  <td className={tdClass}>{summary.missingClockOut ? <span className="text-danger text-xs">⚠️</span> : <span className="text-gray-400">—</span>}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400"><p className="text-sm">本月暂无数据</p></div>
      )}
    </div>
  );
}
