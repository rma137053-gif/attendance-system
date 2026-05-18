import { PrismaClient } from '@prisma/client';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';
import { beijingDayStart, beijingDayEnd, formatBeijing, nowBeijing } from '../utils/timezone';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

export async function createHandoverNote(
  rosterId: string,
  authorId: string,
  content: string,
  requesterStoreId: string | null,
) {
  if (!content.trim()) {
    throw new BadRequestError('备注内容不能为空');
  }

  const roster = await prisma.roster.findUnique({
    where: { id: rosterId },
    include: {
      user: { select: { id: true, name: true, storeId: true } },
    },
  });
  if (!roster) throw new NotFoundError('排班记录不存在');

  if (requesterStoreId && roster.storeId !== requesterStoreId) {
    throw new ForbiddenError('只能查看本店排班');
  }

  // Check: can't write notes for future shifts
  const rosterBeijing = dayjs(roster.shiftDate).tz('Asia/Shanghai');
  const todayBeijing = nowBeijing().startOf('day');
  if (rosterBeijing.isAfter(todayBeijing)) {
    throw new BadRequestError('不能给未来日期的班次写备注');
  }

  // Check: author must be a colleague (same store, same day, any shift)
  // or the roster owner themselves
  const dayStart = beijingDayStart(dayjs.tz(roster.shiftDate, 'UTC'));
  const dayEnd = beijingDayEnd(dayjs.tz(roster.shiftDate, 'UTC'));

  const isColleague = await prisma.roster.findFirst({
    where: {
      storeId: roster.storeId,
      shiftDate: { gte: dayStart, lte: dayEnd },
      userId: authorId,
    },
  });

  if (!isColleague) {
    throw new ForbiddenError('只有同天同店搭班的同事才能写交接备注');
  }

  const note = await prisma.handoverNote.create({
    data: { rosterId, authorId, content: content.trim() },
    include: {
      author: { select: { id: true, name: true } },
    },
  });

  return {
    ...note,
    createdAt: formatBeijing(note.createdAt),
  };
}

export async function listHandoverNotes(rosterId: string, requesterStoreId: string | null) {
  const roster = await prisma.roster.findUnique({ where: { id: rosterId } });
  if (!roster) throw new NotFoundError('排班记录不存在');
  if (requesterStoreId && roster.storeId !== requesterStoreId) {
    throw new ForbiddenError('只能查看本店排班');
  }

  const notes = await prisma.handoverNote.findMany({
    where: { rosterId },
    include: {
      author: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return notes.map((n) => ({
    ...n,
    createdAt: formatBeijing(n.createdAt),
  }));
}
