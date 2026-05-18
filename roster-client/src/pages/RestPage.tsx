import { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import api from '../api/client';
import { useToast } from '../hooks/useToast';

dayjs.extend(utc);
dayjs.extend(timezone);

const WEEKDAY_CN = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

interface RestRecord {
  id: string;
  userId: string;
  restDate: string;
  weekStart: string;
  createdBy: string;
  user: { id: string; name: string };
}

export default function RestPage() {
  const [weekStart, setWeekStart] = useState(dayjs().startOf('week').add(1, 'day'));
  const [record, setRecord] = useState<RestRecord | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { showToast } = useToast();

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

  const isReadonly = record && !canSelect(dayjs(record.restDate));

  if (loading) return <div className="text-center text-gray-500 py-10">加载中...</div>;

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
        <p className="text-sm text-gray-500 mb-4">请选择本周（周一~周日）的一天作为休息日</p>
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
              <span className="text-xs font-medium">{WEEKDAY_CN[idx]}</span>
              <span className="text-lg font-bold">{d.format('D')}</span>
              <span className="text-xs">{d.format('M月')}</span>
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
