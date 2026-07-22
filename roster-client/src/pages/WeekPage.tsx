import { useState, useEffect } from 'react';
import api from '../api/client';
import Spinner from '../components/Spinner';
import { ChevronLeft, ChevronRight } from '../components/Icon';
import dayjs from 'dayjs';

interface RosterItem {
  id: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  user: { id: string; name: string };
  store?: { id: string; name: string };
  leaveType?: string | null;
}

export default function WeekPage() {
  const [rosters, setRosters] = useState<RosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(dayjs().startOf('week').add(1, 'day'));
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [restMap, setRestMap] = useState<Record<string, string>>({});
  const [leaveMap, setLeaveMap] = useState<Record<string, string>>({});

  const weekEnd = weekStart.add(6, 'day');
  const days: dayjs.Dayjs[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(weekStart.add(i, 'day'));
  }

  useEffect(() => {
    setLoading(true);
    api
      .get('/roster', {
        params: {
          startDate: weekStart.format('YYYY-MM-DD'),
          endDate: weekEnd.format('YYYY-MM-DD'),
        },
      })
      .then(async (res) => {
        const data = res.data;
        setRosters(data.items);
        setLeaveMap(data.leaveMap || {});
        // Fetch rest days for stores in roster data
        const storeIds = [...new Set((data.items as RosterItem[]).map((r) => r.store?.id).filter(Boolean))];
        const allRestMap: Record<string, string> = {};
        for (const storeId of storeIds) {
          try {
            const restRes = await api.get('/weekly-rest/store-week', {
              params: { storeId, weekStart: weekStart.format('YYYY-MM-DD') },
            });
            Object.assign(allRestMap, restRes.data.restMap || {});
          } catch { /* ignore */ }
        }
        setRestMap(allRestMap);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [weekStart.format('YYYY-MM-DD')]);

  const grouped = groupByStore(rosters);

  const toggleCollapse = (storeName: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(storeName)) next.delete(storeName);
      else next.add(storeName);
      return next;
    });
  };

  const prevWeek = () => setWeekStart(weekStart.subtract(7, 'day'));
  const nextWeek = () => setWeekStart(weekStart.add(7, 'day'));

  function getShiftDotColor(startTime: string): string {
    if (startTime < '10:00') return 'bg-shift-early';
    if (startTime < '14:00') return 'bg-shift-mid';
    return 'bg-shift-late';
  }

  const LEAVE_TYPE_LABEL: Record<string, string> = {
    ANNUAL: '年假',
    SICK: '病假',
    PERSONAL: '事假',
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="animate-fade-in space-y-4">
      {/* Week Navigator */}
      <div className="flex items-center justify-between bg-white rounded-2xl p-3 border border-gray-100 shadow-sm no-print">
        <button onClick={prevWeek} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <span className="text-sm font-medium text-gray-700">
          {weekStart.format('MM/DD')} - {weekEnd.format('MM/DD')}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-brand-light text-brand font-medium hover:bg-brand/10 transition-colors">
            打印排班表
          </button>
          <button onClick={nextWeek} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Print-only header */}
      <div className="print-only text-center mb-4">
        <h1 className="text-xl font-bold">排班表</h1>
        <p className="text-sm text-gray-500">{weekStart.format('YYYY年M月D日')} - {weekEnd.format('M月D日')}</p>
      </div>

      {loading ? (
        <Spinner />
      ) : Object.keys(grouped).length > 0 ? (
        <div className="space-y-3">
          {Object.entries(grouped).map(([storeName, daysMap]) => {
            const isCollapsed = collapsed.has(storeName);
            // Count total employees with shifts this week
            const employeeNames = new Set<string>();
            Object.values(daysMap).forEach((arr) => arr.forEach((r) => employeeNames.add(r.user.name)));

            return (
              <div key={storeName} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Store Header — clickable */}
                <button
                  onClick={() => toggleCollapse(storeName)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                  {Object.keys(grouped).length > 1 && (
                    <span className="w-1.5 h-5 rounded-full bg-brand" />
                  )}
                  <span className="text-base font-semibold text-gray-800">{storeName}</span>
                  <span className="text-sm text-gray-400 ml-auto">
                    {employeeNames.size} 人排班
                  </span>
                </button>

                {/* Collapsible days */}
                {!isCollapsed && (
                  <div className="px-4 pb-3 space-y-1.5">
                    {days.map((day) => {
                      const dayKey = day.format('YYYY-MM-DD');
                      const dayRosters = daysMap[dayKey] || [];
                      const isToday = dayKey === dayjs().format('YYYY-MM-DD');

                      return (
                        <div
                          key={dayKey}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-colors ${
                            isToday ? 'bg-brand-light/50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <span
                            className={`text-xs font-semibold min-w-[2.5rem] text-center ${
                              isToday ? 'text-brand' : 'text-gray-500'
                            }`}
                          >
                            {day.format('dd')}
                          </span>
                          <span className={`text-xs min-w-[3rem] ${isToday ? 'text-brand font-semibold' : 'text-gray-400'}`}>
                            {day.format('MM/DD')}
                          </span>
                          <div className="flex-1 flex flex-wrap gap-x-4 gap-y-1">
                            {dayRosters.length > 0 ? (
                              dayRosters.map((r) => {
                                const isRest = restMap[r.user.id] === dayKey;
                                const leaveType = r.leaveType || leaveMap[`${r.user.id}_${dayKey}`];
                                return (
                                  <span key={r.id} className="inline-flex items-center gap-1.5 text-sm">
                                    <span className={`w-1.5 h-1.5 rounded-full ${getShiftDotColor(r.startTime)}`} />
                                    <span className="text-gray-700 font-medium">{r.user.name}</span>
                                    <span className="text-gray-400 text-xs">{r.startTime}-{r.endTime}</span>
                                    {leaveType && (
                                      <span className="text-xs px-1 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">{LEAVE_TYPE_LABEL[leaveType] || '假'}</span>
                                    )}
                                    {isRest && (
                                      <span className="text-xs px-1 py-0.5 rounded bg-purple-100 text-purple-600 font-medium">休</span>
                                    )}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">本周暂无排班</p>
        </div>
      )}
    </div>
  );
}

function groupByStore(rosters: RosterItem[]): Record<string, Record<string, RosterItem[]>> {
  const result: Record<string, Record<string, RosterItem[]>> = {};
  for (const r of rosters) {
    const storeName = r.store?.name || '本店';
    if (!result[storeName]) result[storeName] = {};
    const dateKey = dayjs(r.shiftDate).format('YYYY-MM-DD');
    if (!result[storeName][dateKey]) result[storeName][dateKey] = [];
    result[storeName][dateKey].push(r);
  }
  return result;
}
