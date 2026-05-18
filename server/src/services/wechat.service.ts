import { config } from '../config';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tz from 'dayjs/plugin/timezone';
import { beijingDayStart, beijingDayEnd } from '../utils/timezone';

dayjs.extend(utc);
dayjs.extend(tz);

const prisma = new PrismaClient();
const WEEKDAY_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

/** 获取企业微信 access_token，自动缓存和刷新（有效期 7200 秒） */
export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 300_000) {
    return cachedToken;
  }

  const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${config.wechat.corpId}&corpsecret=${config.wechat.secret}`;
  const res = await fetch(url);
  const data = await res.json() as any;

  if (data.errcode !== 0) {
    throw new Error(`获取企业微信 token 失败: ${data.errmsg} (errcode=${data.errcode})`);
  }

  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in ?? 7200) * 1000;
  console.log('[WeChat] access_token 已刷新');
  return cachedToken!;
}

/** 向指定员工发送应用消息（支持 text 和 textcard） */
export async function sendAppMessage(params: {
  touser: string;
  content: string;
  title?: string; // 提供 title 时使用 textcard 卡片格式
  url?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!config.wechat.enabled) {
    console.log('[WeChat] 推送未启用，跳过');
    return { success: true };
  }

  try {
    const token = await getAccessToken();
    const useCard = !!params.title;
    const body: any = {
      touser: params.touser,
      msgtype: useCard ? 'textcard' : 'text',
      agentid: Number(config.wechat.agentId),
    };
    if (useCard) {
      body.textcard = {
        title: params.title,
        description: params.content.replace(/\n/g, '<br>'),
        url: params.url || '',
      };
    } else {
      body.text = { content: params.content };
    }

    const res = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    const data = await res.json() as any;

    if (data.errcode !== 0) {
      throw new Error(`${data.errmsg} (errcode=${data.errcode})`);
    }

    console.log(`[WeChat] 消息已发送 -> ${params.touser}`);
    return { success: true };
  } catch (err: any) {
    console.error(`[WeChat] 发送失败: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/** 获取部门成员列表 */
export async function listDepartmentUsers(
  departmentId = 1,
): Promise<{ userid: string; name: string }[]> {
  const token = await getAccessToken();
  const url = `https://qyapi.weixin.qq.com/cgi-bin/user/simplelist?access_token=${token}&department_id=${departmentId}&fetch_child=1`;
  const res = await fetch(url);
  const data = await res.json() as any;

  if (data.errcode !== 0) {
    throw new Error(`获取成员列表失败: ${data.errmsg}`);
  }

  return (data.userlist ?? []).map((u: any) => ({
    userid: u.userid,
    name: u.name,
  }));
}

/**
 * 将企业微信用户与本地用户按姓名匹配（先精确 → 再模糊包含）
 * 返回 { matched, unmatched }
 */
export async function matchWechatUsers(): Promise<{
  matched: { name: string; wechatUserId: string }[];
  unmatched: string[];
}> {
  const wxUsers = await listDepartmentUsers();
  const localUsers = await prisma.user.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true, wechatUserId: true },
  });

  const matched: { name: string; wechatUserId: string }[] = [];
  const unmatched: string[] = [];
  const usedLocal = new Set<string>(); // 已匹配的本地用户，防止重复匹配

  for (const wx of wxUsers) {
    // 1. 精确匹配
    let local = localUsers.find((u) => u.name === wx.name && !usedLocal.has(u.id));

    // 2. 模糊匹配：本地名包含在企业微信名中，或反之（去空格后比较）
    if (!local) {
      const wxClean = wx.name.replace(/\s/g, '');
      local = localUsers.find((u) => {
        if (usedLocal.has(u.id)) return false;
        const localClean = u.name.replace(/\s/g, '');
        return wxClean.includes(localClean) || localClean.includes(wxClean);
      });
    }

    if (local) {
      usedLocal.add(local.id);
      await prisma.user.update({
        where: { id: local.id },
        data: { wechatUserId: wx.userid },
      });
      matched.push({ name: wx.name, wechatUserId: wx.userid });
    } else {
      unmatched.push(wx.name);
    }
  }

  return { matched, unmatched, total: wxUsers.length } as any;
}

/** 解密企业微信回调消息的 Encrypt 字段（AES-256-CBC + PKCS#7） */
export function decryptCallbackMsg(encodingAESKey: string, encrypted: string): string {
  const aesKey = Buffer.from(encodingAESKey + '=', 'base64');
  const iv = aesKey.subarray(0, 16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
  decipher.setAutoPadding(false);
  const encryptedBuf = Buffer.from(encrypted, 'base64');
  let decrypted = Buffer.concat([decipher.update(encryptedBuf), decipher.final()]);
  const padLen = decrypted[decrypted.length - 1];
  decrypted = decrypted.subarray(0, decrypted.length - padLen);
  const msgLen = decrypted.readUInt32BE(16);
  return decrypted.subarray(20, 20 + msgLen).toString('utf8');
}

/** 加密回复消息（AES-256-CBC + PKCS#7） */
export function encryptCallbackMsg(
  encodingAESKey: string,
  message: string,
  corpId: string,
): string {
  const aesKey = Buffer.from(encodingAESKey + '=', 'base64');
  const iv = aesKey.subarray(0, 16);
  const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
  cipher.setAutoPadding(false);

  const random = crypto.randomBytes(16);
  const msgBuf = Buffer.from(message, 'utf8');
  const msgLen = Buffer.alloc(4);
  msgLen.writeUInt32BE(msgBuf.length, 0);
  const corpIdBuf = Buffer.from(corpId, 'utf8');

  let plain = Buffer.concat([random, msgLen, msgBuf, corpIdBuf]);

  const padLen = 32 - (plain.length % 32);
  const pad = Buffer.alloc(padLen, padLen);
  plain = Buffer.concat([plain, pad]);

  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return encrypted.toString('base64');
}

/** 根据 wechatUserId 查询员工本周排班，返回格式化文本 */
export async function queryWeeklyRosterForWechatUser(
  wechatUserId: string,
): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: { wechatUserId },
    select: { id: true, name: true },
  });
  if (!user) return null;

  const now = dayjs().tz('Asia/Shanghai');
  const monday = now.day(1).startOf('day');
  const sunday = now.day(7).endOf('day');

  const rosters = await prisma.roster.findMany({
    where: {
      userId: user.id,
      shiftDate: {
        gte: beijingDayStart(monday),
        lte: beijingDayEnd(now),
      },
    },
    orderBy: { shiftDate: 'asc' },
  });

  const rosterByDate = new Map<string, (typeof rosters)[number]>();
  for (const r of rosters) {
    const d = dayjs.utc(r.shiftDate).tz('Asia/Shanghai');
    rosterByDate.set(d.format('YYYY-MM-DD'), r);
  }

  let totalMinutes = 0;
  const lines: string[] = [];
  lines.push(`【本周排班】${monday.format('M月D日')} - ${sunday.format('M月D日')}`);
  lines.push('');

  for (let i = 0; i < 7; i++) {
    const d = monday.add(i, 'day');
    const dateStr = d.format('YYYY-MM-DD');
    const weekLabel = WEEKDAY_CN[d.day()];
    const dateLabel = d.format('M/D');
    const roster = rosterByDate.get(dateStr);

    if (roster) {
      const [sh, sm] = roster.startTime.split(':').map(Number);
      const [eh, em] = roster.endTime.split(':').map(Number);
      const workMin = (eh * 60 + em) - (sh * 60 + sm) - (roster.breakMinutes || 0);
      totalMinutes += workMin;
      const breakStr = roster.breakMinutes > 0 ? ` 休息${roster.breakMinutes}分钟` : '';
      lines.push(`${weekLabel} (${dateLabel}) ${roster.startTime}-${roster.endTime}${breakStr}`);
    } else {
      lines.push(`${weekLabel} (${dateLabel}) 休息`);
    }
  }

  const totalHours = (totalMinutes / 60).toFixed(1);
  lines.push('');
  lines.push(`本周总工时: ${totalHours}h`);

  return lines.join('\n');
}
