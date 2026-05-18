import { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import Spinner from '../components/Spinner';
import { ChevronLeft, ChevronRight } from '../components/Icon';
import dayjs from 'dayjs';

interface RosterItem {
  id: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  overtimeMinutes?: number;
  user: { id: string; name: string };
  store?: { id: string; name: string };
}

interface EmpHours {
  userId: string;
  name: string;
  storeName: string;
  totalHours: number;
  overtimeHours: number;
  workDays: number;
  details: { dateStr: string; startTime: string; endTime: string; hours: number; overtime: number }[];
}

function calcHours(startTime: string, endTime: string, breakMinutes?: number): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return (eh * 60 + em - sh * 60 - sm - (breakMinutes ?? 0)) / 60;
}

export default function HoursPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [currentMonth, setCurrentMonth] = useState(dayjs().startOf('month'));
  const [rosters, setRosters] = useState<RosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const monthStart = currentMonth.format('YYYY-MM-DD');
  const monthEnd = currentMonth.endOf('month').format('YYYY-MM-DD');

  useEffect(() => {
    setLoading(true);
    const params: any = {
      startDate: monthStart,
      endDate: monthEnd,
    };
    api.get('/roster', { params })
      .then((res) => setRosters(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [monthStart]);

  const prevMonth = () => setCurrentMonth(currentMonth.subtract(1, 'month'));
  const nextMonth = () => setCurrentMonth(currentMonth.add(1, 'month'));

  // Aggregate by employee
  const empMap = new Map<string, EmpHours>();
  for (const r of rosters) {
    const key = r.user.id;
    if (!empMap.has(key)) {
      empMap.set(key, {
        userId: r.user.id,
        name: r.user.name,
        storeName: r.store?.name || '本店',
        totalHours: 0,
        overtimeHours: 0,
        workDays: 0,
        details: [],
      });
    }
    const emp = empMap.get(key)!;
    const hours = calcHours(r.startTime, r.endTime, r.breakMinutes);
    const overtime = r.overtimeMinutes ? r.overtimeMinutes / 60 : 0;
    emp.totalHours += hours;
    emp.overtimeHours += overtime;
    emp.workDays++;
    emp.details.push({
      dateStr: dayjs(r.shiftDate).format('YYYY-MM-DD'),
      startTime: r.startTime,
      endTime: r.endTime,
      hours,
      overtime,
    });
  }

  // Sort by store then name
  const employees = [...empMap.values()].sort((a, b) => {
    if (a.storeName !== b.storeName) return a.storeName.localeCompare(b.storeName);
    return a.name.localeCompare(b.name);
  });

  const toggleExpand = (userId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  return (
    <div className="animate-fade-in space-y-4">
      <h1 className="text-base font-bold text-gray-800">工时统计</h1>

      {/* Month Navigator */}
      <div className="flex items-center justify-between bg-white rounded-2xl p-3 border border-gray-100 shadow-sm">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <span className="text-base font-semibold text-gray-700">
          {currentMonth.format('YYYY年M月')}
        </span>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : employees.length > 0 ? (
        <div className="space-y-2">
          {employees.map((emp) => {
            const isExpanded = expanded.has(emp.userId);
            return (
              <div key={emp.userId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleExpand(emp.userId)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  <span className="text-sm font-semibold text-gray-800">{emp.name}</span>
                  {isAdmin && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{emp.storeName}</span>
                  )}
                  <div className="ml-auto flex items-center gap-3 text-sm">
                    <span className="text-gray-500">{emp.workDays}天</span>
                    {emp.overtimeHours > 0 && (
                      <span className="text-danger font-medium text-xs">+{emp.overtimeHours.toFixed(1)}h</span>
                    )}
                    <span className="text-brand font-bold min-w-[3rem] text-right">{emp.totalHours.toFixed(1)}h</span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-3 space-y-1">
                    <div className="text-xs text-gray-400 flex items-center gap-3 px-2 pb-1">
                      <span className="min-w-[5rem]">日期</span>
                      <span className="min-w-[6.5rem]">时间</span>
                      <span className="min-w-[3rem]">工时</span>
                      <span>加班</span>
                    </div>
                    {emp.details
                      .sort((a, b) => a.dateStr.localeCompare(b.dateStr))
                      .map((d) => (
                        <div key={d.dateStr} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-sm">
                          <span className="text-gray-500 min-w-[5rem]">
                            {dayjs(d.dateStr).format('MM/DD (dd)')}
                          </span>
                          <span className="text-gray-700 font-medium min-w-[6.5rem]">
                            {d.startTime} - {d.endTime}
                          </span>
                          <span className="text-brand font-semibold min-w-[3rem]">{d.hours.toFixed(1)}h</span>
                          <span className={d.overtime > 0 ? 'text-danger font-medium' : 'text-gray-400'}>
                            {d.overtime > 0 ? `+${d.overtime.toFixed(1)}h` : '—'}
                          </span>
                        </div>
                      ))}
                    {emp.totalHours > 160 && (
                      <p className="text-xs text-danger mt-2">已超过标准工时(160h)</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">本月暂无排班数据</p>
        </div>
      )}
    </div>
  );
}
