import { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';
import { useToast } from '../../hooks/useToast';
import dayjs from 'dayjs';

const WEEKDAY_CN = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const ALLOWED_DAYS = [0, 1, 2, 3, 4]; // Mon-Fri only (0-indexed from Monday)

interface RestRecord {
  id: string;
  userId: string;
  restDate: string;
  weekStart: string;
  createdBy: string;
  user: { id: string; name: string };
}

export default function RestDaySelector() {
  const [weekStart, setWeekStart] = useState(dayjs().startOf('week').add(1, 'day'));
  const [record, setRecord] = useState<RestRecord | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { success } = useToast();

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

  const canSelect = (date: dayjs.Dayjs, dayIndex: number) => {
    // Past dates
    const today = nowBeijing.startOf('day');
    if (date.isBefore(today)) return false;
    // Only Mon-Fri (dayIndex 0-4)
    if (!ALLOWED_DAYS.includes(dayIndex)) return false;
    // Deadline: rest date minus 1 day 23:59
    const deadline = date.subtract(1, 'day').endOf('day');
    return nowBeijing.isBefore(deadline);
  };

  const canSubmit = selectedDate && (() => {
    const d = dayjs(selectedDate);
    const idx = days.findIndex((day) => day.format('YYYY-MM-DD') === d.format('YYYY-MM-DD'));
    if (!record) return canSelect(d, idx >= 0 ? idx : d.day() === 0 ? 6 : d.day() - 1);
    if (selectedDate === dayjs(record.restDate).format('YYYY-MM-DD')) return true;
    return canSelect(d, idx >= 0 ? idx : d.day() === 0 ? 6 : d.day() - 1);
  })();

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      await api.put('/weekly-rest', {
        restDate: selectedDate,
        weekStart: weekStart.format('YYYY-MM-DD'),
      });
      success(record ? '休息日已更新' : '休息日已选择');
      fetchRecord();
    } catch (err: any) {
      setError(err.response?.data?.error || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const isReadonly = record && (() => {
    const restDate = dayjs(record.restDate);
    const idx = restDate.day() === 0 ? 6 : restDate.day() - 1;
    return !canSelect(restDate, idx);
  })();

  if (loading) return <div className="text-center text-gray-500 py-10">加载中...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">选择休息日</h1>
      </div>

      {/* Rule reminder */}
      <div className="p-3 rounded-xl mb-4 bg-amber-50 border border-amber-200">
        <p className="text-xs text-amber-700">
          休息日仅限<strong>周一至周五</strong>。如需周末休息，请使用「请假」功能。
        </p>
      </div>

      {/* Current selection info */}
      {record && (
        <div className={`p-4 rounded-xl mb-4 ${isReadonly ? 'bg-purple-50 border border-purple-200' : 'bg-blue-50 border border-blue-200'}`}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">
              {dayjs(record.weekStart).format('M月D日')}~{dayjs(record.weekStart).add(6, 'day').format('M月D日')} 休息日：
            </span>
            <span className="text-sm font-bold text-gray-800">
              {dayjs(record.restDate).format('M月D日')}（{WEEKDAY_CN[dayjs(record.restDate).day() === 0 ? 6 : dayjs(record.restDate).day() - 1]}）
            </span>
            {record.createdBy === 'ADMIN' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">由管理员指定</span>
            )}
            {isReadonly && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">已锁定</span>
            )}
          </div>
          {isReadonly && (
            <p className="text-xs text-gray-500 mt-1">已超过修改截止时间（休息日前一天 23:59），无法修改</p>
          )}
        </div>
      )}

      {!record && (
        <p className="text-sm text-gray-500 mb-4">请选择一周中的一天作为休息日（周一~周五可选）</p>
      )}

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

      {/* Week navigator */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setWeekStart(weekStart.subtract(7, 'day'))}
          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-30"
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
          const isWeekend = idx >= 5; // Sat(5) or Sun(6)
          const selectable = !isReadonly && canSelect(d, idx);

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
                  : isWeekend
                  ? 'bg-red-50 text-red-300 cursor-not-allowed border border-red-100'
                  : 'bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-100'
              } ${isToday ? 'ring-2 ring-brand/30' : ''}`}
            >
              <span className="text-xs font-medium">{WEEKDAY_CN[idx]}</span>
              <span className="text-lg font-bold">{d.format('D')}</span>
              <span className="text-xs">{isWeekend ? '需请假' : d.format('M月')}</span>
            </button>
          );
        })}
      </div>

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
