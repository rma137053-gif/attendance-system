import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import Spinner from '../components/Spinner';
import { ChevronLeft, ChevronRight } from '../components/Icon';
import dayjs from 'dayjs';

interface Employee {
  id: string;
  name: string;
  role?: string;
}

interface Store {
  id: string;
  name: string;
}

type CellData = { id?: string; startTime: string; endTime: string; breakMinutes?: number } | null;

interface EditingCell {
  userId: string;
  dateStr: string;
  empName: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
}

const SHIFT_TEMPLATES = [
  { label: '上午', start: '08:15', end: '12:30', breakMin: 0 },
  { label: '下午', start: '12:30', end: '21:00', breakMin: 0 },
  { label: '全天', start: '09:00', end: '19:30', breakMin: 120 },
];

function getShiftColor(startTime: string): { bg: string; dot: string; badge: string } {
  if (startTime < '10:00') return { bg: 'bg-shift-early-light border-shift-early/30 text-shift-early', dot: 'bg-shift-early', badge: 'bg-shift-early text-white' };
  if (startTime < '14:00') return { bg: 'bg-shift-mid-light border-shift-mid/30 text-shift-mid', dot: 'bg-shift-mid', badge: 'bg-shift-mid text-white' };
  return { bg: 'bg-shift-late-light border-shift-late/30 text-shift-late', dot: 'bg-shift-late', badge: 'bg-shift-late text-white' };
}

function calcHours(startTime: string, endTime: string, breakMinutes?: number): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return (eh * 60 + em - sh * 60 - sm - (breakMinutes ?? 0)) / 60;
}

export default function ManagePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const success = (msg: string) => showToast(msg, 'success');
  const showError = (msg: string) => showToast(msg, 'error');
  const isAdmin = user?.role === 'ADMIN';

  const [weekStart, setWeekStart] = useState(() => dayjs().startOf('week').add(1, 'day'));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rosterMap, setRosterMap] = useState<Record<string, CellData>>({});
  const [dirtyCells, setDirtyCells] = useState<Set<string>>(new Set());
  const [restMap, setRestMap] = useState<Record<string, string>>({});
  const [leaveMap, setLeaveMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [batchDay, setBatchDay] = useState<{ dateStr: string; label: string } | null>(null);
  const [batchStart, setBatchStart] = useState('09:00');
  const [batchEnd, setBatchEnd] = useState('18:00');
  const [batchBreak, setBatchBreak] = useState(0);
  const [copying, setCopying] = useState(false);
  const [showOneClick, setShowOneClick] = useState(false);
  const [ocStartDate, setOcStartDate] = useState(() => dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD'));
  const [ocEndDate, setOcEndDate] = useState(() => dayjs().startOf('week').add(1, 'day').add(6, 'day').format('YYYY-MM-DD'));
  const [ocFullDayEmp, setOcFullDayEmp] = useState('');
  const [ocMorningStart, setOcMorningStart] = useState('08:15');
  const [ocMorningEnd, setOcMorningEnd] = useState('12:30');
  const [ocEveningStart, setOcEveningStart] = useState('12:30');
  const [ocEveningEnd, setOcEveningEnd] = useState('21:00');
  const [ocFullStart, setOcFullStart] = useState('09:00');
  const [ocFullEnd, setOcFullEnd] = useState('19:30');
  const [ocFullBreak, setOcFullBreak] = useState(120);
  const [ocFirstMorning, setOcFirstMorning] = useState(''); // 第一天上午班员工

  const weekEnd = weekStart.add(6, 'day');
  const days: dayjs.Dayjs[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(weekStart.add(i, 'day'));
  }

  const makeKey = (userId: string, dateStr: string) => `${userId}_${dateStr}`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let allEmployees: Employee[] = [];
      if (isAdmin && selectedStoreId) {
        const usersRes = await api.get('/users', { params: { storeId: selectedStoreId } });
        allEmployees = usersRes.data
          .filter((u: any) => u.role === 'EMPLOYEE' && !u.crossStore)
          .map((u: any) => ({ id: u.id, name: u.name, role: u.role }));
      } else if (!isAdmin) {
        const empRes = await api.get('/users/roster');
        allEmployees = empRes.data;
      }
      setEmployees(allEmployees);

      const storeIdParam = isAdmin && selectedStoreId ? selectedStoreId : '';
      const rosterRes = await api.get('/roster', {
        params: {
          ...(storeIdParam ? { storeId: storeIdParam } : {}),
          startDate: weekStart.format('YYYY-MM-DD'),
          endDate: weekEnd.format('YYYY-MM-DD'),
        },
      });

      const map: Record<string, CellData> = {};
      const data = rosterRes.data;
      (data.items as any[]).forEach((r) => {
        const dateStr = dayjs(r.shiftDate).format('YYYY-MM-DD');
        map[makeKey(r.userId, dateStr)] = { id: r.id, startTime: r.startTime, endTime: r.endTime, breakMinutes: r.breakMinutes ?? 0 };
      });
      setRosterMap(map);
      setLeaveMap(data.leaveMap || {});
      setDirtyCells(new Set());

      // Fetch rest days
      const effectiveStoreId = isAdmin ? selectedStoreId : (user?.storeId || '');
      if (effectiveStoreId) {
        try {
          const restRes = await api.get('/weekly-rest/store-week', {
            params: { storeId: effectiveStoreId, weekStart: weekStart.format('YYYY-MM-DD') },
          });
          setRestMap(restRes.data.restMap || {});
        } catch { /* ignore */ }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [weekStart.format('YYYY-MM-DD'), selectedStoreId, isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (isAdmin) {
      api.get('/users/stores').then((res) => setStores(res.data)).catch(() => {});
    }
  }, [isAdmin]);

  const openEditor = (userId: string, dateStr: string, empName: string) => {
    const key = makeKey(userId, dateStr);
    const existing = rosterMap[key];
    setEditing({
      userId,
      dateStr,
      empName,
      startTime: existing?.startTime || '09:00',
      endTime: existing?.endTime || '18:00',
      breakMinutes: existing?.breakMinutes ?? 0,
    });
  };

  const copyLastWeek = async () => {
    setCopying(true);
    const lastWeekStart = weekStart.subtract(7, 'day');
    const lastWeekEnd = weekEnd.subtract(7, 'day');
    try {
      const params: any = {
        startDate: lastWeekStart.format('YYYY-MM-DD'),
        endDate: lastWeekEnd.format('YYYY-MM-DD'),
      };
      if (isAdmin && selectedStoreId) params.storeId = selectedStoreId;
      const res = await api.get('/roster', { params });
      const newMap = { ...rosterMap };
      const newDirty = new Set(dirtyCells);
      (res.data.items as any[]).forEach((r) => {
        const oldDate = dayjs(r.shiftDate);
        const newDate = oldDate.add(7, 'day');
        const dateStr = newDate.format('YYYY-MM-DD');
        const key = makeKey(r.userId, dateStr);
        newMap[key] = { startTime: r.startTime, endTime: r.endTime, breakMinutes: r.breakMinutes ?? 0 };
        newDirty.add(key);
      });
      setRosterMap(newMap);
      setDirtyCells(newDirty);
      success(`已复制上周排班，${newDirty.size} 条待保存`);
    } catch {
      showError('复制失败，请确认上周有排班数据');
    } finally {
      setCopying(false);
    }
  };

  const applyBatch = () => {
    if (!batchDay) return;
    const newMap = { ...rosterMap };
    const newDirty = new Set(dirtyCells);
    employees.forEach((emp) => {
      const key = makeKey(emp.id, batchDay.dateStr);
      newMap[key] = { startTime: batchStart, endTime: batchEnd, breakMinutes: batchBreak };
      newDirty.add(key);
    });
    setRosterMap(newMap);
    setDirtyCells(newDirty);
    setBatchDay(null);
    success(`已为 ${employees.length} 人设置 ${batchDay.label}`);
  };

  const applyOneClickSchedule = () => {
    // Validate
    if (employees.length !== 3) {
      showError(`一键排班需要恰好3名员工，当前门店有 ${employees.length} 人`);
      return;
    }
    if (!ocFullDayEmp) {
      showError('请选择全天班员工');
      return;
    }
    if (ocEndDate < ocStartDate) {
      showError('结束日期不能早于开始日期');
      return;
    }

    // Identify half-day alternators — morning employee first, then evening
    const halfDayEmps = employees.filter((e) => e.id !== ocFullDayEmp);
    if (halfDayEmps.length === 2 && ocFirstMorning) {
      // Reorder: morning person first, evening person second
      const morningIdx = halfDayEmps.findIndex((e) => e.id === ocFirstMorning);
      if (morningIdx === 1) {
        [halfDayEmps[0], halfDayEmps[1]] = [halfDayEmps[1], halfDayEmps[0]];
      }
    }

    // Shift definitions (from modal inputs)
    const FULL_DAY = { start: ocFullStart, end: ocFullEnd, breakMin: ocFullBreak };
    const MORNING = { start: ocMorningStart, end: ocMorningEnd, breakMin: 0 };
    const EVENING = { start: ocEveningStart, end: ocEveningEnd, breakMin: 0 };

    const newMap = { ...rosterMap };
    const newDirty = new Set(dirtyCells);
    const startD = dayjs(ocStartDate);
    const endD = dayjs(ocEndDate);
    let dayIndex = 0;

    for (let d = startD; d.isBefore(endD.add(1, 'day'), 'day'); d = d.add(1, 'day')) {
      const dateStr = d.format('YYYY-MM-DD');

      // Full-day employee
      const fdKey = makeKey(ocFullDayEmp, dateStr);
      newMap[fdKey] = { startTime: FULL_DAY.start, endTime: FULL_DAY.end, breakMinutes: FULL_DAY.breakMin };
      newDirty.add(fdKey);

      // Alternating half-day: even days → EmpA morning / EmpB evening; odd days → swap
      const morningEmp = halfDayEmps[dayIndex % 2];
      const eveningEmp = halfDayEmps[(dayIndex + 1) % 2];

      const moKey = makeKey(morningEmp.id, dateStr);
      newMap[moKey] = { startTime: MORNING.start, endTime: MORNING.end, breakMinutes: MORNING.breakMin };
      newDirty.add(moKey);

      const evKey = makeKey(eveningEmp.id, dateStr);
      newMap[evKey] = { startTime: EVENING.start, endTime: EVENING.end, breakMinutes: EVENING.breakMin };
      newDirty.add(evKey);

      dayIndex++;
    }

    setRosterMap(newMap);
    setDirtyCells(newDirty);
    setShowOneClick(false);
    success(`已生成 ${dayIndex} 天排班，共 ${newDirty.size} 条待保存`);
  };

  const confirmEdit = () => {
    if (!editing) return;
    const key = makeKey(editing.userId, editing.dateStr);
    setRosterMap((prev) => ({
      ...prev,
      [key]: { startTime: editing.startTime, endTime: editing.endTime, breakMinutes: editing.breakMinutes },
    }));
    setDirtyCells((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setEditing(null);
  };

  const deleteCell = () => {
    if (!editing) return;
    const key = makeKey(editing.userId, editing.dateStr);
    setRosterMap((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setDirtyCells((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setEditing(null);
  };

  const handleSave = async () => {
    if (dirtyCells.size === 0) {
      success('没有需要保存的更改');
      return;
    }

    let storeId = '';
    if (isAdmin && selectedStoreId) {
      storeId = selectedStoreId;
    } else if (!isAdmin && user?.storeId) {
      storeId = user.storeId;
    }

    if (!storeId) {
      showError('请先选择门店');
      return;
    }

    const assignments: { userId: string; shiftDate: string; startTime: string; endTime: string; breakMinutes?: number }[] = [];
    const deletions: string[] = [];

    for (const key of dirtyCells) {
      const sepIdx = key.indexOf('_');
      const userId = key.substring(0, sepIdx);
      const dateStr = key.substring(sepIdx + 1);
      const cell = rosterMap[key];

      if (cell) {
        assignments.push({ userId, shiftDate: dateStr, startTime: cell.startTime, endTime: cell.endTime, breakMinutes: cell.breakMinutes ?? 0 });
      } else {
        // Cell was deleted — need to find original roster ID from previous data
        deletions.push(key);
      }
    }

    if (assignments.length === 0 && deletions.length === 0) {
      success('没有需要保存的更改');
      return;
    }

    setSaving(true);
    try {
      let resultMsg = '';

      if (assignments.length > 0) {
        const res = await api.post('/roster/batch', { storeId, assignments });
        resultMsg = `新增 ${res.data.created} 条，更新 ${res.data.updated} 条`;
      }

      // Handle deletions — need original roster ID
      if (deletions.length > 0) {
        const originalMap: Record<string, string> = {};
        // Re-fetch current roster data to get IDs for deleted cells
        try {
          const rosterRes = await api.get('/roster', {
            params: {
              ...(storeId ? { storeId } : {}),
              startDate: weekStart.format('YYYY-MM-DD'),
              endDate: weekEnd.format('YYYY-MM-DD'),
            },
          });
          (rosterRes.data.items as any[]).forEach((r) => {
            const dateStr = dayjs(r.shiftDate).format('YYYY-MM-DD');
            originalMap[makeKey(r.userId, dateStr)] = r.id;
          });
        } catch {
          // If we can't fetch, skip deletions
        }

        let deletedCount = 0;
        for (const key of deletions) {
          const rosterId = originalMap[key];
          if (rosterId) {
            try {
              await api.delete(`/roster/${rosterId}`);
              deletedCount++;
            } catch {
              // skip failed deletions
            }
          }
        }
        if (deletedCount > 0) {
          resultMsg += `，删除 ${deletedCount} 条`;
        }
      }

      success(resultMsg || '已保存');
      setDirtyCells(new Set());
      fetchData();
    } catch (err: any) {
      showError(err.response?.data?.error || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const prevWeek = () => setWeekStart(weekStart.subtract(7, 'day'));
  const nextWeek = () => setWeekStart(weekStart.add(7, 'day'));

  const formatDateDisplay = (dateStr: string) => {
    const d = dayjs(dateStr);
    return `${d.format('M月D日')}（${d.format('dd')}）`;
  };

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="animate-fade-in space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold text-gray-800">排班管理</h1>
        <button
          onClick={handleSave}
          disabled={saving || dirtyCells.size === 0}
          className="bg-brand text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-brand-dark transition-colors disabled:opacity-50 active:scale-[0.98]"
        >
          {saving ? '保存中...' : dirtyCells.size > 0 ? `保存(${dirtyCells.size})` : '保存'}
        </button>
      </div>

      {/* Store selector (admin only) */}
      {isAdmin && (
        <select
          value={selectedStoreId}
          onChange={(e) => setSelectedStoreId(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none bg-white"
        >
          <option value="">请选择门店</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      )}

      {isAdmin && !selectedStoreId ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">请先选择门店</p>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          {(() => {
            const today = dayjs().format('YYYY-MM-DD');
            const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
            let totalHours = 0;
            let todayCount = 0;
            let tomorrowCount = 0;
            employees.forEach((emp) => {
              days.forEach((day) => {
                const cell = rosterMap[makeKey(emp.id, day.format('YYYY-MM-DD'))];
                if (cell) {
                  totalHours += calcHours(cell.startTime, cell.endTime, cell.breakMinutes);
                }
              });
              if (rosterMap[makeKey(emp.id, today)]) todayCount++;
              if (rosterMap[makeKey(emp.id, tomorrow)]) tomorrowCount++;
            });
            const coverageByDay = days.map((day) => {
              const dateStr = day.format('YYYY-MM-DD');
              return employees.filter((emp) => rosterMap[makeKey(emp.id, dateStr)]).length;
            });
            const gapDays = coverageByDay.filter((c) => c === 0).length;
            const lowDays = coverageByDay.filter((c) => c > 0 && c < 2).length;
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
                  <div className="text-xl font-bold text-brand">{totalHours.toFixed(1)}h</div>
                  <div className="text-xs text-gray-400 mt-0.5">本周总工时</div>
                </div>
                <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
                  <div className="text-xl font-bold text-shift-early">{todayCount}</div>
                  <div className="text-xs text-gray-400 mt-0.5">今日在岗</div>
                </div>
                <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
                  <div className="text-xl font-bold text-shift-mid">{tomorrowCount}</div>
                  <div className="text-xs text-gray-400 mt-0.5">明日在岗</div>
                </div>
                <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center">
                  <div className={`text-xl font-bold ${gapDays > 0 ? 'text-danger' : lowDays > 0 ? 'text-anomaly' : 'text-shift-early'}`}>
                    {gapDays > 0 ? `${gapDays}天空档` : lowDays > 0 ? `${lowDays}天不足` : '良好'}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">覆盖状态</div>
                </div>
              </div>
            );
          })()}

          {/* Week Navigator */}
          <div className="flex items-center justify-between bg-white rounded-2xl p-3 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2">
              <button onClick={prevWeek} className="p-3 hover:bg-gray-100 rounded-xl transition-colors">
                <ChevronLeft className="w-6 h-6 text-gray-600" />
              </button>
              <button
                onClick={copyLastWeek}
                disabled={copying}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-brand-light text-brand font-medium hover:bg-brand/10 transition-colors disabled:opacity-50"
              >
                {copying ? '复制中...' : '复制上周'}
              </button>
              <button
                onClick={() => {
                  setOcStartDate(weekStart.format('YYYY-MM-DD'));
                  setOcEndDate(weekEnd.format('YYYY-MM-DD'));
                  setOcFullDayEmp('');
                  setOcFirstMorning('');
                  setShowOneClick(true);
                }}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-brand text-white font-medium hover:bg-brand-dark transition-colors"
              >
                一键排班
              </button>
            </div>
            <span className="text-base font-semibold text-gray-700">
              {weekStart.format('MM/DD')} - {weekEnd.format('MM/DD')}
            </span>
            <button onClick={nextWeek} className="p-3 hover:bg-gray-100 rounded-xl transition-colors">
              <ChevronRight className="w-6 h-6 text-gray-600" />
            </button>
          </div>

          {/* Roster Grid */}
          {employees.length > 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3.5 px-1 font-semibold text-gray-500 text-sm w-[3.6rem]">
                      员工
                    </th>
                    {days.map((day) => {
                      const dateStr = day.format('YYYY-MM-DD');
                      const isToday = dateStr === dayjs().format('YYYY-MM-DD');
                      const count = employees.filter((emp) => rosterMap[makeKey(emp.id, dateStr)]).length;
                      const coverageIcon = count === 0 ? '🔴' : count < 2 ? '🟡' : '🟢';
                      return (
                        <th key={dateStr} className={`px-0.5 py-2 text-center ${isToday ? 'text-brand' : 'text-gray-500'}`}>
                          <div className="text-sm font-semibold">{day.format('dd')}</div>
                          <div className="text-xs opacity-70">{day.format('MM/DD')}</div>
                          <div className="text-xs mt-0.5" title={`${count}人在岗`}>{coverageIcon}</div>
                          <button
                            onClick={() => {
                              setBatchDay({ dateStr, label: `${day.format('M月D日')}（${day.format('dd')}）` });
                              setBatchStart('09:00');
                              setBatchEnd('18:00');
                              setBatchBreak(0);
                            }}
                            className="text-xs mt-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 hover:bg-brand-light hover:text-brand transition-colors"
                          >
                            一键填充
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id} className="border-b border-gray-50 last:border-b-0">
                      <td className="py-3 px-1 w-[3.6rem]">
                        <span className="font-semibold text-gray-800 text-sm">{emp.name}</span>
                      </td>
                      {days.map((day) => {
                        const dateStr = day.format('YYYY-MM-DD');
                        const cell = rosterMap[makeKey(emp.id, dateStr)];
                        const dirty = dirtyCells.has(makeKey(emp.id, dateStr));
                        const isRest = restMap[emp.id] === dateStr;
                        const leaveType = leaveMap[makeKey(emp.id, dateStr)];

                        let cellStyle = 'bg-gray-100 text-gray-400';
                        if (leaveType) {
                          cellStyle = 'bg-amber-100 text-amber-700';
                        } else if (cell) {
                          cellStyle = getShiftColor(cell.startTime).badge;
                        } else if (isRest) {
                          cellStyle = 'bg-purple-100 text-purple-600';
                        }

                        return (
                          <td key={dateStr} className="px-0.5 py-2 text-center">
                            <button
                              onClick={() => openEditor(emp.id, dateStr, emp.name)}
                              className={`w-full px-1 py-3 rounded-lg text-sm font-semibold transition-all active:scale-90
                                ${cellStyle}
                                ${dirty ? 'ring-2 ring-brand/50 ring-offset-1' : ''}
                              `}
                            >
                              {leaveType ? (
                                <span className="text-xs font-bold">假</span>
                              ) : cell ? (
                                <><span>{cell.startTime}</span><br /><span>{cell.endTime}</span></>
                              ) : isRest ? '休' : '—'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16 text-gray-400">
              <p className="text-sm">暂无员工</p>
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-3 text-sm text-gray-400 flex-wrap">
            <span>班次颜色：</span>
            <span className="inline-flex items-center gap-1"><span className="w-4 h-4 rounded bg-shift-early" />早班</span>
            <span className="inline-flex items-center gap-1"><span className="w-4 h-4 rounded bg-shift-mid" />午班</span>
            <span className="inline-flex items-center gap-1"><span className="w-4 h-4 rounded bg-shift-late" />晚班</span>
            <span className="inline-flex items-center gap-1"><span className="w-4 h-4 rounded bg-amber-100" />请假</span>
            <span className="inline-flex items-center gap-1"><span className="w-4 h-4 rounded bg-gray-100" />空</span>
            {dirtyCells.size > 0 && (
              <span className="inline-flex items-center gap-1 text-brand">
                <span className="w-3 h-3 rounded ring-2 ring-brand/50 ring-offset-1 bg-shift-early" />已修改
              </span>
            )}
          </div>
        </>
      )}

      {/* Batch Set Modal */}
      {batchDay && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setBatchDay(null)} />
          <div className="relative bg-white rounded-t-2xl p-5 w-full max-w-lg animate-slide-up">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              一键填充 — {batchDay.label}
            </h3>
            <div className="flex items-center gap-4 mb-5">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">上班</label>
                <input type="time" value={batchStart} onChange={(e) => setBatchStart(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-base focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
              </div>
              <span className="text-gray-300 mt-5">—</span>
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">下班</label>
                <input type="time" value={batchEnd} onChange={(e) => setBatchEnd(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-base focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
              </div>
            </div>
            <div className="mb-5">
              <label className="block text-xs text-gray-400 mb-1">休息时间</label>
              <select value={batchBreak} onChange={(e) => setBatchBreak(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-base focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none bg-white">
                <option value={0}>无休息</option>
                <option value={30}>30 分钟</option>
                <option value={60}>1 小时</option>
                <option value={90}>1.5 小时</option>
                <option value={120}>2 小时</option>
              </select>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setBatchDay(null)}
                className="px-6 py-3 rounded-lg text-base bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium">
                取消
              </button>
              <button onClick={applyBatch}
                className="px-6 py-3 rounded-lg text-base bg-brand text-white hover:bg-brand-dark font-medium">
                应用到{employees.length}人
              </button>
            </div>
          </div>
        </div>
      )}

      {/* One-Click Scheduling Modal */}
      {showOneClick && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowOneClick(false)} />
          <div className="relative bg-white rounded-t-2xl p-5 w-full max-w-lg animate-slide-up overflow-y-auto max-h-[90vh]">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">一键排班</h3>

            {/* Date Range */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">开始日期</label>
                <input type="date" value={ocStartDate} onChange={(e) => setOcStartDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
              </div>
              <span className="text-gray-300 mt-5">—</span>
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">结束日期</label>
                <input type="date" value={ocEndDate} onChange={(e) => setOcEndDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
              </div>
            </div>

            {/* Employee Selectors */}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1">全天班员工</label>
              <select value={ocFullDayEmp} onChange={(e) => { setOcFullDayEmp(e.target.value); setOcFirstMorning(''); }}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none bg-white">
                <option value="">请选择</option>
                {employees.map((emp) => (<option key={emp.id} value={emp.id}>{emp.name}</option>))}
              </select>
            </div>

            {/* First Day Morning Selector */}
            {ocFullDayEmp && employees.filter((e) => e.id !== ocFullDayEmp).length === 2 && (
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">第1天上午班员工</label>
                <select value={ocFirstMorning} onChange={(e) => setOcFirstMorning(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none bg-white">
                  <option value="">请选择</option>
                  {employees.filter((e) => e.id !== ocFullDayEmp).map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
                {ocFirstMorning && (
                  <p className="text-xs text-gray-400 mt-1">
                    下午班：{employees.find((e) => e.id !== ocFullDayEmp && e.id !== ocFirstMorning)?.name}（自动分配）
                  </p>
                )}
              </div>
            )}

            {/* Shift Time Editors */}
            <div className="space-y-3 mb-5">
              {/* 上午班 */}
              <div className="bg-blue-50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full bg-shift-early" />
                  <span className="text-sm font-medium text-gray-700">上午班</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="time" value={ocMorningStart} onChange={(e) => setOcMorningStart(e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white" />
                  <span className="text-gray-400">—</span>
                  <input type="time" value={ocMorningEnd} onChange={(e) => setOcMorningEnd(e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white" />
                </div>
              </div>

              {/* 下午班 */}
              <div className="bg-purple-50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full bg-shift-late" />
                  <span className="text-sm font-medium text-gray-700">下午班</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="time" value={ocEveningStart} onChange={(e) => setOcEveningStart(e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white" />
                  <span className="text-gray-400">—</span>
                  <input type="time" value={ocEveningEnd} onChange={(e) => setOcEveningEnd(e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white" />
                </div>
              </div>

              {/* 全天班 */}
              <div className="bg-amber-50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full bg-shift-mid" />
                  <span className="text-sm font-medium text-gray-700">全天班</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <input type="time" value={ocFullStart} onChange={(e) => setOcFullStart(e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white" />
                  <span className="text-gray-400">—</span>
                  <input type="time" value={ocFullEnd} onChange={(e) => setOcFullEnd(e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white" />
                </div>
                <select value={ocFullBreak} onChange={(e) => setOcFullBreak(Number(e.target.value))}
                  className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white text-gray-500">
                  <option value={0}>无休息</option>
                  <option value={30}>休息 30 分钟</option>
                  <option value={60}>休息 1 小时</option>
                  <option value={90}>休息 1.5 小时</option>
                  <option value={120}>休息 2 小时</option>
                </select>
              </div>
            </div>

            {/* Summary preview */}
            {ocFullDayEmp && (
              <div className="bg-gray-50 rounded-xl p-3 mb-5 text-sm text-gray-500">
                <p className="text-gray-700 font-medium mb-1">预览</p>
                <p>全天：{employees.find((e) => e.id === ocFullDayEmp)?.name} {ocFullStart}-{ocFullEnd}（休{ocFullBreak}分）</p>
                <p>上午：{ocMorningStart}-{ocMorningEnd} / 下午：{ocEveningStart}-{ocEveningEnd}</p>
                {(() => {
                  const half = employees.filter((e) => e.id !== ocFullDayEmp);
                  if (half.length === 2) {
                    return <p>轮班：{half[0].name}、{half[1].name}（每日交替）</p>;
                  }
                  return null;
                })()}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowOneClick(false)}
                className="px-6 py-3 rounded-lg text-base bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium">取消</button>
              <button onClick={applyOneClickSchedule}
                className="px-6 py-3 rounded-lg text-base bg-brand text-white hover:bg-brand-dark font-medium">生成排班</button>
            </div>
          </div>
        </div>
      )}

      {/* Time Editor Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setEditing(null)} />
          <div className="relative bg-white rounded-t-2xl p-5 w-full max-w-lg animate-slide-up">
            <h3 className="text-lg font-semibold text-gray-800 mb-5">
              {editing.empName} - {formatDateDisplay(editing.dateStr)}
            </h3>

            {/* Shift Templates */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {SHIFT_TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  onClick={() => setEditing({ ...editing, startTime: t.start, endTime: t.end, breakMinutes: t.breakMin })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    editing.startTime === t.start && editing.endTime === t.end
                      ? 'bg-brand text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t.label}<span className="ml-1 opacity-70">{t.start}-{t.end}</span>
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-base text-gray-500 mb-1.5">上班时间</label>
                <input
                  type="time"
                  value={editing.startTime}
                  onChange={(e) => setEditing({ ...editing, startTime: e.target.value })}
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                />
              </div>
              <div>
                <label className="block text-base text-gray-500 mb-1.5">下班时间</label>
                <input
                  type="time"
                  value={editing.endTime}
                  onChange={(e) => setEditing({ ...editing, endTime: e.target.value })}
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                />
              </div>
              <div>
                <label className="block text-base text-gray-500 mb-1.5">休息时间</label>
                <select
                  value={editing.breakMinutes}
                  onChange={(e) => setEditing({ ...editing, breakMinutes: Number(e.target.value) })}
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-base focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none bg-white"
                >
                  <option value={0}>无休息</option>
                  <option value={30}>30 分钟</option>
                  <option value={60}>1 小时</option>
                  <option value={90}>1.5 小时</option>
                  <option value={120}>2 小时</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center gap-3">
                {confirmingDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red-500 font-medium">确定删除？</span>
                    <button
                      onClick={() => { deleteCell(); setConfirmingDelete(false); }}
                      className="px-3 py-1.5 rounded-lg text-sm bg-red-500 text-white font-medium"
                    >
                      确认删除
                    </button>
                    <button
                      onClick={() => setConfirmingDelete(false)}
                      className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 text-gray-700 font-medium"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingDelete(true)}
                    className="text-red-500 text-base font-semibold"
                  >
                    删除排班
                  </button>
                )}
                {/* Rest day toggle */}
                <button
                  onClick={async () => {
                    const isRest = restMap[editing.userId] === editing.dateStr;
                    const storeId = isAdmin ? selectedStoreId : (user?.storeId || '');
                    try {
                      if (isRest) {
                        // Find and delete rest record
                        const restRes = await api.get('/weekly-rest', {
                          params: { userId: editing.userId, weekStart: weekStart.format('YYYY-MM-DD') },
                        });
                        const restRecord = (restRes.data as any[]).find(
                          (r: any) => dayjs(r.restDate).format('YYYY-MM-DD') === editing.dateStr
                        );
                        if (restRecord) {
                          await api.delete(`/weekly-rest/${restRecord.id}`);
                        }
                        setRestMap((prev) => {
                          const next = { ...prev };
                          delete next[editing.userId];
                          return next;
                        });
                        success('已取消休息日');
                      } else {
                        await api.put('/weekly-rest', {
                          userId: editing.userId,
                          restDate: editing.dateStr,
                          weekStart: weekStart.format('YYYY-MM-DD'),
                          storeId,
                        });
                        setRestMap((prev) => ({ ...prev, [editing.userId]: editing.dateStr }));
                        success('已设为休息日');
                      }
                    } catch (err: any) {
                      showError(err.response?.data?.error || '操作失败');
                    }
                  }}
                  className={`text-sm font-medium px-2 py-1 rounded-lg ${
                    restMap[editing.userId] === editing.dateStr
                      ? 'bg-purple-100 text-purple-600'
                      : 'bg-gray-100 text-gray-500 hover:bg-purple-50 hover:text-purple-600'
                  }`}
                >
                  {restMap[editing.userId] === editing.dateStr ? '取消休息日' : '设为休息日'}
                </button>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setEditing(null); setConfirmingDelete(false); }}
                  className="px-6 py-3 rounded-lg text-base bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
                >
                  取消
                </button>
                <button
                  onClick={confirmEdit}
                  className="px-6 py-3 rounded-lg text-base bg-brand text-white hover:bg-brand-dark font-medium"
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
