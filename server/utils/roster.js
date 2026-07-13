"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTimeToBeijing = parseTimeToBeijing;
exports.calcLateMinutes = calcLateMinutes;
exports.isShiftEndNear = isShiftEndNear;
const shifts_1 = require("../constants/shifts");
/** 将 "HH:mm" 字符串解析为指定日期的北京时间 dayjs 对象 */
function parseTimeToBeijing(date, time) {
    const [h, m] = time.split(':').map(Number);
    return date.hour(h).minute(m).second(0).millisecond(0);
}
/** 计算迟到分钟数 */
function calcLateMinutes(startTime, clockInTime) {
    const [h, m] = startTime.split(':').map(Number);
    const deadline = clockInTime
        .hour(h)
        .minute(m + shifts_1.GRACE_MINUTES)
        .second(0)
        .millisecond(0);
    const diff = clockInTime.diff(deadline, 'minute');
    return diff > 0 ? diff : 0;
}
/** 判断是否接近下班时间 */
function isShiftEndNear(endTime, now, minutesBefore = 5) {
    const end = parseTimeToBeijing(now, endTime);
    const remain = end.diff(now, 'minute');
    return remain > 0 && remain <= minutesBefore;
}
