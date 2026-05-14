import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export const TZ = 'Asia/Shanghai';

/** Convert a UTC Date to a dayjs instance in Asia/Shanghai */
export function toBeijing(d: Date | string): dayjs.Dayjs {
  return dayjs.utc(d).tz(TZ);
}

/** Get current time in Beijing as dayjs */
export function nowBeijing(): dayjs.Dayjs {
  return dayjs().tz(TZ);
}

/** Format a UTC date to ISO string with +08:00 offset for API responses */
export function formatBeijing(d: Date | string): string {
  return toBeijing(d).format('YYYY-MM-DDTHH:mm:ss+08:00');
}

/** Get start of day (00:00:00) in Beijing time, returned as UTC Date */
export function beijingDayStart(d: dayjs.Dayjs): Date {
  return d.startOf('day').utc().toDate();
}

/** Get end of day (23:59:59.999) in Beijing time, returned as UTC Date */
export function beijingDayEnd(d: dayjs.Dayjs): Date {
  return d.endOf('day').utc().toDate();
}

/** Get start of week (Monday 00:00:00) in Beijing time */
export function beijingWeekStart(d: dayjs.Dayjs): Date {
  return d.startOf('week').utc().toDate();
}

/** Get end of week (Sunday 23:59:59.999) in Beijing time */
export function beijingWeekEnd(d: dayjs.Dayjs): Date {
  return d.endOf('week').utc().toDate();
}

/** Get start of month in Beijing time */
export function beijingMonthStart(d: dayjs.Dayjs): Date {
  return d.startOf('month').utc().toDate();
}

/** Get end of month in Beijing time */
export function beijingMonthEnd(d: dayjs.Dayjs): Date {
  return d.endOf('month').utc().toDate();
}
