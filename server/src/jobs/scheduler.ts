import cron from 'node-cron';
import { runReminderCheck } from './clockReminder.job';
import { runPhotoCleanup } from './photoCleanup.job';

let started = false;

export function startScheduler() {
  if (started) return;
  started = true;

  // PM2 多实例保护：仅在 worker 0 启动 cron
  const pm2Instance = process.env.NODE_APP_INSTANCE;
  if (pm2Instance !== undefined && pm2Instance !== '0') {
    console.log(`[Scheduler] PM2 worker ${pm2Instance}, skipping cron (only worker 0 runs)`);
    return;
  }

  // 每分钟检查一次打卡提醒
  cron.schedule('* * * * *', async () => {
    try {
      await runReminderCheck();
    } catch (err) {
      console.error('[Scheduler] Reminder check error:', err);
    }
  });

  // 每天凌晨3点清理超过70天的打卡照片
  cron.schedule('0 3 * * *', async () => {
    try {
      await runPhotoCleanup();
    } catch (err) {
      console.error('[Scheduler] Photo cleanup error:', err);
    }
  });

  console.log('[Scheduler] Cron jobs started (reminder: every min, photo cleanup: daily 3am)');
}
