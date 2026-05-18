import dayjs from 'dayjs';
import { GRACE_MINUTES } from '../constants/shifts';

/** 将 "HH:mm" 字符串解析为指定日期的北京时间 dayjs 对象 */
export function parseTimeToBeijing(date: dayjs.Dayjs, time: string): dayjs.Dayjs {
  const [h, m] = time.split(':').map(Number);
  return date.hour(h).minute(m).second(0).millisecond(0);
}

/** 计算迟到分钟数 */
export function calcLateMinutes(startTime: string, clockInTime: dayjs.Dayjs): number {
  const [h, m] = startTime.split(':').map(Number);
  const deadline = clockInTime
    .hour(h)
    .minute(m + GRACE_MINUTES)
    .second(0)
    .millisecond(0);
  const diff = clockInTime.diff(deadline, 'minute');
  return diff > 0 ? diff : 0;
}

/** 判断是否接近下班时间 */
export function isShiftEndNear(endTime: string, now: dayjs.Dayjs, minutesBefore = 5): boolean {
  const end = parseTimeToBeijing(now, endTime);
  const remain = end.diff(now, 'minute');
  return remain > 0 && remain <= minutesBefore;
}
