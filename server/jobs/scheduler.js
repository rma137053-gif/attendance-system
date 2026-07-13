"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startScheduler = startScheduler;
const node_cron_1 = __importDefault(require("node-cron"));
const clockReminder_job_1 = require("./clockReminder.job");
let started = false;
function startScheduler() {
    if (started)
        return;
    started = true;
    // PM2 多实例保护：仅在 worker 0 启动 cron
    const pm2Instance = process.env.NODE_APP_INSTANCE;
    if (pm2Instance !== undefined && pm2Instance !== '0') {
        console.log(`[Scheduler] PM2 worker ${pm2Instance}, skipping cron (only worker 0 runs)`);
        return;
    }
    // 每分钟检查一次
    node_cron_1.default.schedule('* * * * *', async () => {
        try {
            await (0, clockReminder_job_1.runReminderCheck)();
        }
        catch (err) {
            console.error('[Scheduler] Reminder check error:', err);
        }
    });
    console.log('[Scheduler] Cron jobs started (every minute)');
}
