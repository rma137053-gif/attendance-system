import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { sendAppMessage } from './wechat.service';

const prisma = new PrismaClient();

interface PushMessage {
  userId: string;
  title: string;
  body: string;
  type: 'CLOCK_IN_REMINDER' | 'CLOCK_IN_URGE' | 'CLOCK_OUT_REMINDER';
  rosterId?: string;
}

export async function sendPush(msg: PushMessage): Promise<{ success: boolean; error?: string }> {
  console.log(`[Push] 用户 ${msg.userId} [${msg.type}] ${msg.title} - ${msg.body}`);

  // 防止重复推送
  if (msg.rosterId) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const existing = await prisma.pushLog.findFirst({
      where: {
        userId: msg.userId,
        rosterId: msg.rosterId,
        type: msg.type,
        status: 'SENT',
        createdAt: { gte: todayStart },
      },
    });
    if (existing) {
      console.log(`[Push] 跳过重复推送: userId=${msg.userId}, type=${msg.type}`);
      return { success: true };
    }
  }

  let sent = false;
  let errorMsg: string | undefined;

  // 企业微信个人推送
  if (config.wechat.enabled) {
    const user = await prisma.user.findUnique({
      where: { id: msg.userId },
      select: { wechatUserId: true, name: true },
    });

    if (user?.wechatUserId) {
      const content = `${msg.title}\n${msg.body}`;
      const result = await sendAppMessage({ touser: user.wechatUserId, content });
      sent = result.success;
      errorMsg = result.error;
    } else {
      console.log(`[Push] 用户 ${msg.userId} 未绑定企业微信，跳过企业微信推送`);
    }
  }

  // 如果企业微信未启用或未绑定，webhook 作为兜底
  if (!sent && config.wechat.webhookUrl) {
    try {
      const response = await fetch(config.wechat.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'markdown',
          markdown: { content: `## ${msg.title}\n${msg.body}` },
        }),
      });
      if (!response.ok) {
        errorMsg = `Webhook 失败: ${response.status}`;
      } else {
        sent = true;
      }
    } catch (err: any) {
      errorMsg = err.message;
    }
  }

  // 记录推送日志
  await prisma.pushLog.create({
    data: {
      userId: msg.userId,
      rosterId: msg.rosterId,
      type: msg.type,
      status: sent ? 'SENT' : 'FAILED',
      errorMsg: sent ? null : (errorMsg ?? '未配置推送通道'),
    },
  });

  return { success: sent, error: errorMsg };
}
