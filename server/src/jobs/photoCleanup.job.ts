import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { config } from '../config';

const prisma = new PrismaClient();

const RETENTION_DAYS = 70;

export async function runPhotoCleanup() {
  const cutoffDate = dayjs().subtract(RETENTION_DAYS, 'day').toDate();

  // 1. 删除超过保留期的打卡照片，清空 photoKey
  const oldRecords = await prisma.clockRecord.findMany({
    where: {
      photoKey: { not: null },
      createdAt: { lt: cutoffDate },
    },
    select: { id: true, photoKey: true },
  });

  let deletedCount = 0;
  for (const record of oldRecords) {
    if (record.photoKey) {
      const filePath = path.join(config.uploadDir, record.photoKey);
      await fs.promises.unlink(filePath).catch(() => {});
      await prisma.clockRecord.update({
        where: { id: record.id },
        data: { photoKey: null },
      });
      deletedCount++;
    }
  }

  // 2. 清理孤儿文件（磁盘有但数据库无对应记录的照片）
  let orphanCount = 0;
  try {
    const files = await fs.promises.readdir(config.uploadDir);
    const dbRecords = await prisma.clockRecord.findMany({
      where: { photoKey: { not: null } },
      select: { photoKey: true },
    });
    const dbKeySet = new Set(dbRecords.map((r) => r.photoKey));

    for (const file of files) {
      if (file === '.gitkeep' || file === '.DS_Store') continue;
      if (!dbKeySet.has(file)) {
        const filePath = path.join(config.uploadDir, file);
        await fs.promises.unlink(filePath).catch(() => {});
        orphanCount++;
      }
    }
  } catch {
    // 目录不存在或无法读取，跳过孤儿清理
  }

  if (deletedCount > 0 || orphanCount > 0) {
    console.log(
      `[PhotoCleanup] 已删除 ${deletedCount} 张过期照片(>${RETENTION_DAYS}天)，${orphanCount} 个孤儿文件`,
    );
  }
}
