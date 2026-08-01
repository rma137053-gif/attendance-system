import { execSync } from 'child_process';
import path from 'path';

const BACKUP_DIR = path.resolve(__dirname, '../../prisma/backups');

export async function runDbBackup() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const src = path.resolve(__dirname, '../../prisma/dev.db');
  const dest = path.join(BACKUP_DIR, `dev.db.${stamp}`);

  try {
    execSync(`mkdir -p "${BACKUP_DIR}"`);
    execSync(`cp "${src}" "${dest}"`);
    console.log(`[DB Backup] ${stamp}`);
  } catch (err: any) {
    console.error('[DB Backup] Failed:', err.message);
  }
}
