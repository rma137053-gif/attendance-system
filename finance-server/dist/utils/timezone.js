"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TZ = void 0;
exports.toBeijing = toBeijing;
exports.nowBeijing = nowBeijing;
exports.formatBeijing = formatBeijing;
exports.beijingDayStart = beijingDayStart;
exports.beijingDayEnd = beijingDayEnd;
exports.beijingMonthStart = beijingMonthStart;
exports.beijingMonthEnd = beijingMonthEnd;
const dayjs_1 = __importDefault(require("dayjs"));
const utc_1 = __importDefault(require("dayjs/plugin/utc"));
const timezone_1 = __importDefault(require("dayjs/plugin/timezone"));
dayjs_1.default.extend(utc_1.default);
dayjs_1.default.extend(timezone_1.default);
exports.TZ = 'Asia/Shanghai';
/** Convert a UTC Date to a dayjs instance in Asia/Shanghai */
function toBeijing(d) {
    return dayjs_1.default.utc(d).tz(exports.TZ);
}
/** Get current time in Beijing as dayjs */
function nowBeijing() {
    return (0, dayjs_1.default)().tz(exports.TZ);
}
/** Format a UTC date to ISO string with +08:00 offset for API responses */
function formatBeijing(d) {
    return toBeijing(d).format('YYYY-MM-DDTHH:mm:ss+08:00');
}
/** Get start of day (00:00:00) in Beijing time, returned as UTC Date */
function beijingDayStart(d) {
    return d.startOf('day').utc().toDate();
}
/** Get end of day (23:59:59.999) in Beijing time, returned as UTC Date */
function beijingDayEnd(d) {
    return d.endOf('day').utc().toDate();
}
/** Get start of month in Beijing time */
function beijingMonthStart(d) {
    return d.startOf('month').utc().toDate();
}
/** Get end of month in Beijing time */
function beijingMonthEnd(d) {
    return d.endOf('month').utc().toDate();
}
//# sourceMappingURL=timezone.js.map