import dayjs from 'dayjs';
/** 将 "HH:mm" 字符串解析为指定日期的北京时间 dayjs 对象 */
export declare function parseTimeToBeijing(date: dayjs.Dayjs, time: string): dayjs.Dayjs;
/** 计算迟到分钟数 */
export declare function calcLateMinutes(startTime: string, clockInTime: dayjs.Dayjs): number;
/** 判断是否接近下班时间 */
export declare function isShiftEndNear(endTime: string, now: dayjs.Dayjs, minutesBefore?: number): boolean;
