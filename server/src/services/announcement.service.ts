import { PrismaClient, Prisma } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { formatBeijing } from '../utils/timezone';
import { sendAppMessage } from './wechat.service';

const prisma = new PrismaClient();

const TYPE_LABELS: Record<string, string> = {
  GENERAL: '通用通知',
  ROSTER: '排班变更',
  HOLIDAY: '假期通知',
};

interface CreateParams {
  title: string;
  content: string;
  type?: string;
  storeId?: string | null;
  createdBy: string;
  requesterStoreId?: string | null;
}

export async function createAnnouncement(params: CreateParams) {
  const { title, content, type, storeId, createdBy, requesterStoreId } = params;

  // STORE_ADMIN can only create for their own store
  const effectiveStoreId = requesterStoreId ? requesterStoreId : (storeId || null);

  const announcement = await prisma.announcement.create({
    data: {
      title,
      content,
      type: type || 'GENERAL',
      storeId: effectiveStoreId,
      createdBy,
    },
    include: {
      user: { select: { id: true, name: true } },
      store: { select: { id: true, name: true } },
    },
  });

  // Push WeChat notification to target store's employees
  const userWhere: Prisma.UserWhereInput = {
    wechatUserId: { not: null },
    status: 'ACTIVE',
    role: { not: 'ADMIN' },
  };
  if (effectiveStoreId) {
    userWhere.storeId = effectiveStoreId;
  }

  const users = await prisma.user.findMany({
    where: userWhere,
    select: { wechatUserId: true, name: true },
  });

  const typeLabel = TYPE_LABELS[announcement.type] || '通知';
  const storeLabel = effectiveStoreId ? '' : '【全部门店】';

  for (const u of users) {
    if (!u.wechatUserId) continue;
    sendAppMessage({
      touser: u.wechatUserId,
      title: `${storeLabel}${typeLabel}: ${title}`,
      content: content,
      url: 'http://47.102.223.195/',
    }).catch((e) =>
      console.error(`[公告通知] 发送失败: ${u.name}`, e.message),
    );
  }

  return {
    ...announcement,
    createdAt: formatBeijing(announcement.createdAt),
    updatedAt: formatBeijing(announcement.updatedAt),
  };
}

interface QueryParams {
  storeId?: string;
  page?: number;
  pageSize?: number;
}

export async function queryAnnouncements(params: QueryParams, requesterStoreId: string | null, role?: string) {
  const { storeId, page = 1, pageSize = 20 } = params;

  const where: Prisma.AnnouncementWhereInput = {};

  // Scope by store
  if (role === 'ADMIN' && !requesterStoreId) {
    if (storeId) where.storeId = storeId;
    // else: all stores (no filter)
  } else if (requesterStoreId) {
    where.OR = [
      { storeId: requesterStoreId },
      { storeId: null },
    ];
  }

  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        store: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.announcement.count({ where }),
  ]);

  return {
    items: announcements.map((a) => ({
      ...a,
      createdAt: formatBeijing(a.createdAt),
      updatedAt: formatBeijing(a.updatedAt),
    })),
    total,
    page,
    pageSize,
  };
}

export async function updateAnnouncement(id: string, params: { title?: string; content?: string; type?: string }, requesterStoreId: string | null) {
  const announcement = await prisma.announcement.findUnique({ where: { id } });
  if (!announcement) throw new NotFoundError('公告不存在');

  if (requesterStoreId && announcement.storeId !== requesterStoreId) {
    throw new NotFoundError('公告不存在');
  }

  const data: Prisma.AnnouncementUpdateInput = {};
  if (params.title) data.title = params.title;
  if (params.content) data.content = params.content;
  if (params.type) data.type = params.type;

  const updated = await prisma.announcement.update({
    where: { id },
    data,
    include: {
      user: { select: { id: true, name: true } },
      store: { select: { id: true, name: true } },
    },
  });

  return {
    ...updated,
    createdAt: formatBeijing(updated.createdAt),
    updatedAt: formatBeijing(updated.updatedAt),
  };
}

export async function deleteAnnouncement(id: string, requesterStoreId: string | null) {
  const announcement = await prisma.announcement.findUnique({ where: { id } });
  if (!announcement) throw new NotFoundError('公告不存在');

  if (requesterStoreId && announcement.storeId !== requesterStoreId) {
    throw new NotFoundError('公告不存在');
  }

  await prisma.announcement.delete({ where: { id } });
}
