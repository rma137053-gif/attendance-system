import dayjs from 'dayjs';
export declare const TZ = "Asia/Shanghai";
/** Convert a UTC Date to a dayjs instance in Asia/Shanghai */
export declare function toBeijing(d: Date | string): dayjs.Dayjs;
/** Get current time in Beijing as dayjs */
export declare function nowBeijing(): dayjs.Dayjs;
/** Format a UTC date to ISO string with +08:00 offset for API responses */
export declare function formatBeijing(d: Date | string): string;
/** Get start of day (00:00:00) in Beijing time, returned as UTC Date */
export declare function beijingDayStart(d: dayjs.Dayjs): Date;
/** Get end of day (23:59:59.999) in Beijing time, returned as UTC Date */
export declare function beijingDayEnd(d: dayjs.Dayjs): Date;
/** Get start of week (Monday 00:00:00) in Beijing time */
export declare function beijingWeekStart(d: dayjs.Dayjs): Date;
/** Get end of week (Sunday 23:59:59.999) in Beijing time */
export declare function beijingWeekEnd(d: dayjs.Dayjs): Date;
/** Get start of month in Beijing time */
export declare function beijingMonthStart(d: dayjs.Dayjs): Date;
/** Get end of month in Beijing time */
export declare function beijingMonthEnd(d: dayjs.Dayjs): Date;
