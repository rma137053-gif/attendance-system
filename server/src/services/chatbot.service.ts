import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tz from 'dayjs/plugin/timezone';
import { PrismaClient } from '@prisma/client';
import { upsertRestDay } from './weekly-rest.service';
import { createLeave, listLeaves } from './leave.service';
import { queryWeeklyRosterForWechatUser, sendAppMessage } from './wechat.service';

dayjs.extend(utc);
dayjs.extend(tz);

const prisma = new PrismaClient();

const WEEKDAY_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WEEKDAY_MAP: Record<string, number> = {
  '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6,
  '星期一': 1, '星期二': 2, '星期三': 3, '星期四': 4, '星期五': 5, '星期六': 6, '星期日': 7,
  '周日': 7, '周天': 7,
};
const LEAVE_TYPE_CN: Record<string, string> = {
  '1': 'ANNUAL', '年假': 'ANNUAL',
  '2': 'SICK', '病假': 'SICK',
  '3': 'PERSONAL', '事假': 'PERSONAL',
};
const LEAVE_TYPE_LABEL: Record<string, string> = {
  ANNUAL: '年假', SICK: '病假', PERSONAL: '事假',
};

// ==================== Session Management ====================

type SessionState =
  | 'REST_SELECT_WEEK'
  | 'REST_SELECT_DAY'
  | 'REST_CONFIRM'
  | 'LEAVE_SELECT_TYPE'
  | 'LEAVE_ENTER_DATES'
  | 'LEAVE_ENTER_REASON'
  | 'LEAVE_CONFIRM';

interface Session {
  state: SessionState;
  userId: string;
  storeId: string;
  role: string;
  name: string;
  stepData: Record<string, any>;
  createdAt: number;
}

const sessions = new Map<string, Session>();
const SESSION_TTL = 5 * 60 * 1000; // 5 分钟过期

function getSession(wechatUserId: string): Session | null {
  const s = sessions.get(wechatUserId);
  if (!s) return null;
  if (Date.now() - s.createdAt > SESSION_TTL) {
    sessions.delete(wechatUserId);
    return null;
  }
  s.createdAt = Date.now(); // 刷新 TTL
  return s;
}

function setSession(wechatUserId: string, session: Session): void {
  session.createdAt = Date.now();
  sessions.set(wechatUserId, session);
}

function clearSession(wechatUserId: string): void {
  sessions.delete(wechatUserId);
}

// ==================== User Lookup ====================

async function lookupUser(wechatUserId: string): Promise<{
  userId: string; storeId: string; role: string; name: string;
} | null> {
  const user = await prisma.user.findFirst({
    where: { wechatUserId },
    select: { id: true, storeId: true, role: true, name: true },
  });
  if (!user) return null;
  return {
    userId: user.id,
    storeId: user.storeId || '',
    role: user.role,
    name: user.name,
  };
}

// ==================== Date Parsing ====================

function getThisMonday(): dayjs.Dayjs {
  const now = dayjs().tz('Asia/Shanghai');
  return now.day(1).startOf('day');
}

function parseDate(input: string, monday: dayjs.Dayjs): dayjs.Dayjs | null {
  const cleaned = input.trim();
  const today = dayjs().tz('Asia/Shanghai').startOf('day');

  // "今天"
  if (/^今[天日]$/.test(cleaned)) return today;
  // "明天"
  if (/^明[天日]$/.test(cleaned)) return today.add(1, 'day');
  // "后天"
  if (/^后[天日]$/.test(cleaned)) return today.add(2, 'day');

  // Weekday names: "周三", "星期一"
  for (const [cn, dayNum] of Object.entries(WEEKDAY_MAP)) {
    if (cleaned === cn || cleaned.startsWith(cn)) {
      // dayNum 1=Mon..7=Sun, monday is dayjs for this week's Monday
      return monday.add(dayNum - 1, 'day');
    }
  }

  // "5月20日" or "5/20" or "5-20"
  let m: RegExpMatchArray | null;
  if ((m = cleaned.match(/^(\d{1,2})月(\d{1,2})[日号]?$/))) {
    return dayjs.tz(`${dayjs().tz('Asia/Shanghai').year()}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`, 'Asia/Shanghai').startOf('day');
  }
  if ((m = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})$/))) {
    return dayjs.tz(`${dayjs().tz('Asia/Shanghai').year()}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`, 'Asia/Shanghai').startOf('day');
  }

  // "周一" alone without matching (already handled above)
  return null;
}

function parseDateRange(input: string): { start: dayjs.Dayjs; end: dayjs.Dayjs } | null {
  const cleaned = input.trim();

  // "5月20日-5月21日" or "5月20日到5月21日"
  const rangeMatch = cleaned.match(/^(.+?)[\-\~到至](.+)$/);
  if (rangeMatch) {
    const monday = getThisMonday();
    const start = parseDate(rangeMatch[1].trim(), monday);
    const end = parseDate(rangeMatch[2].trim(), monday);
    if (start && end && (end.isSame(start) || end.isAfter(start))) {
      return { start, end };
    }
  }

  // Single date: "5月20日"
  const monday = getThisMonday();
  const single = parseDate(cleaned, monday);
  if (single) return { start: single, end: single };

  return null;
}

function formatDate(d: dayjs.Dayjs): string {
  return d.format('M月D日');
}

// ==================== Status Query ====================

async function queryStatus(userId: string): Promise<string> {
  const now = dayjs().tz('Asia/Shanghai');
  const monday = getThisMonday();
  const sunday = monday.add(6, 'day');

  // 本周休息日
  const weekStartUTC = monday.startOf('day').utc().toDate();
  const rest = await prisma.weeklyRest.findUnique({
    where: { userId_weekStart: { userId, weekStart: weekStartUTC } },
  });
  const restStr = rest
    ? `${dayjs.utc(rest.restDate).tz('Asia/Shanghai').format('M月D日')}（${WEEKDAY_CN[dayjs.utc(rest.restDate).tz('Asia/Shanghai').day()]}）`
    : '未选择';

  // 请假记录（最近10条）
  const leaveResult = await listLeaves({ userId, page: 1, pageSize: 10 });
  const leaveLines: string[] = [];
  if (leaveResult.items.length === 0) {
    leaveLines.push('  暂无请假记录');
  } else {
    for (const l of leaveResult.items) {
      const start = dayjs.utc(l.startDate).tz('Asia/Shanghai').format('M月D日');
      const end = dayjs.utc(l.endDate).tz('Asia/Shanghai').format('M月D日');
      const statusMap: Record<string, string> = { PENDING: '⏳待审批', APPROVED: '✅已通过', REJECTED: '❌已拒绝' };
      const statusLabel = statusMap[l.status] || l.status;
      const typeLabel = LEAVE_TYPE_LABEL[l.type] || l.type;
      const reasonPart = l.reason ? `（${l.reason}）` : '';
      leaveLines.push(`  ${start}~${end} ${typeLabel}${reasonPart} ${statusLabel}`);
    }
  }

  const lines = [
    `📋 ${monday.format('M月D日')} - ${sunday.format('M月D日')} 本周信息`,
    '',
    `【休息日】${restStr}`,
    '',
    '【请假记录】',
    ...leaveLines,
  ];

  return lines.join('\n');
}

// ==================== Admin Notification ====================

async function notifyAdminsForLeave(
  employeeName: string, type: string, startDate: string, endDate: string, reason?: string,
) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', wechatUserId: { not: null } },
      select: { wechatUserId: true },
    });
    if (admins.length === 0) return;

    const typeLabel = LEAVE_TYPE_LABEL[type] || type;
    const content = `【${typeLabel}】${employeeName}\n日期：${startDate} ~ ${endDate}\n原因：${reason || '无'}\n\n请及时审批（通过企业微信审核后回复员工）`;

    for (const admin of admins) {
      sendAppMessage({
        touser: admin.wechatUserId!,
        title: '新的请假申请',
        content,
        url: 'http://47.102.223.195/admin/leaves',
      }).catch((err: any) => console.error('[Bot] 请假通知发送失败:', err.message));
    }
  } catch (err: any) {
    console.error('[Bot] 查询管理员失败:', err.message);
  }
}

// ==================== Message Router ====================

export async function handleBotMessage(
  wechatUserId: string,
  content: string,
): Promise<string> {
  const input = content.trim();

  // ---- Global command: 取消 ----
  if (/^取消$/.test(input)) {
    clearSession(wechatUserId);
    return '已取消当前操作。\n\n您可以随时输入：\n· 排班 - 查看本周排班（含门店、时间）\n· 选休 - 选择休息日（周一~周五，可提前选）\n· 请假 - 申请请假\n· 查询 - 查看状态';
  }

  // ---- Global command: 帮助 ----
  if (/^(帮助|help|功能)$/.test(input)) {
    clearSession(wechatUserId);
    return '我可以帮您：\n· 输入「排班」查看本周排班（含门店、工时）\n· 输入「选休」选择休息日（周一至周五，支持提前选未来周）\n· 输入「请假」申请请假\n· 输入「查询」查看休息日和请假状态\n\n💡 周末休息请用「请假」功能\n· 操作中随时输入「取消」退出';
  }

  // ---- Check active session ----
  const session = getSession(wechatUserId);
  if (session) {
    return handleSessionInput(wechatUserId, session, input);
  }

  // ---- Lookup user ----
  const user = await lookupUser(wechatUserId);
  if (!user) {
    return '未找到您的账号信息，请联系管理员在企业微信后台绑定账号。';
  }

  // ---- Global command: 查询 ----
  if (/^(查询|状态|我的)$/.test(input)) {
    return await queryStatus(user.userId);
  }

  // ---- Global command: 排班 ----
  if (/^排班$/.test(input)) {
    return (await queryWeeklyRosterForWechatUser(wechatUserId))
      ?? '未找到您的排班信息。';
  }

  // ---- Start 选休 ----
  if (/^(选休|选修|休息日|选择休息)$/.test(input)) {
    setSession(wechatUserId, {
      state: 'REST_SELECT_WEEK',
      userId: user.userId,
      storeId: user.storeId,
      role: user.role,
      name: user.name,
      stepData: {},
      createdAt: Date.now(),
    });
    const thisMonday = getThisMonday();
    const nextMonday = thisMonday.add(7, 'day');
    const weekAfterNext = thisMonday.add(14, 'day');

    return [
      '请选择要选休的周，直接回复数字：',
      `1. 本周（${thisMonday.format('M月D日')}~${thisMonday.add(6, 'day').format('M月D日')}）`,
      `2. 下周（${nextMonday.format('M月D日')}~${nextMonday.add(6, 'day').format('M月D日')}）`,
      `3. 下下周（${weekAfterNext.format('M月D日')}~${weekAfterNext.add(6, 'day').format('M月D日')}）`,
      '',
      '也可以直接输入日期（如 5月20日）指定要选休的周，',
      '回复「否」取消',
    ].join('\n');
  }

  // ---- Start 请假 ----
  if (/^(请假|申请请假|休假)$/.test(input)) {
    setSession(wechatUserId, {
      state: 'LEAVE_SELECT_TYPE',
      userId: user.userId,
      storeId: user.storeId,
      role: user.role,
      name: user.name,
      stepData: {},
      createdAt: Date.now(),
    });
    return '请选择请假类型，回复数字或类型名：\n1. 年假\n2. 病假\n3. 事假';
  }

  // ---- Default ----
  return '我没有理解您的消息。您可以输入：\n· 排班 - 查看本周排班\n· 选休 - 选择休息日\n· 请假 - 申请请假\n· 查询 - 查看状态';
}

// ==================== Session State Handlers ====================

async function handleSessionInput(
  wechatUserId: string,
  session: Session,
  input: string,
): Promise<string> {
  switch (session.state) {
    case 'REST_SELECT_WEEK':
      return handleRestSelectWeek(wechatUserId, session, input);
    case 'REST_SELECT_DAY':
      return handleRestSelectDay(wechatUserId, session, input);
    case 'REST_CONFIRM':
      return handleRestConfirm(wechatUserId, session, input);
    case 'LEAVE_SELECT_TYPE':
      return handleLeaveSelectType(wechatUserId, session, input);
    case 'LEAVE_ENTER_DATES':
      return handleLeaveEnterDates(wechatUserId, session, input);
    case 'LEAVE_ENTER_REASON':
      return handleLeaveEnterReason(wechatUserId, session, input);
    case 'LEAVE_CONFIRM':
      return handleLeaveConfirm(wechatUserId, session, input);
    default:
      clearSession(wechatUserId);
      return '操作异常，已重置。请重新输入指令。';
  }
}

// ==================== Rest Day Handlers ====================

/** 选休第一步：选择选休周 */
async function handleRestSelectWeek(
  wechatUserId: string,
  session: Session,
  input: string,
): Promise<string> {
  const trimmed = input.trim();

  // "否" / "不" → cancel
  if (/^[否不]$/.test(trimmed)) {
    clearSession(wechatUserId);
    return '已取消选休操作。';
  }

  const thisMonday = getThisMonday();
  let targetMonday: dayjs.Dayjs | null = null;

  // "1" / "本周"
  if (/^1$|^本周$/.test(trimmed)) {
    targetMonday = thisMonday;
  }
  // "2" / "下周"
  else if (/^2$|^下周$/.test(trimmed)) {
    targetMonday = thisMonday.add(7, 'day');
  }
  // "3" / "下下周"
  else if (/^3$|^下下周$/.test(trimmed)) {
    targetMonday = thisMonday.add(14, 'day');
  }
  // Try parsing a date, then get its Monday
  else {
    const parsed = parseDate(trimmed, thisMonday);
    if (parsed) {
      targetMonday = parsed.startOf('isoWeek');
    }
  }

  if (!targetMonday) {
    return [
      '未能识别，请回复数字选择：',
      `1. 本周（${thisMonday.format('M月D日')}~${thisMonday.add(6, 'day').format('M月D日')}）`,
      `2. 下周（${thisMonday.add(7, 'day').format('M月D日')}~${thisMonday.add(13, 'day').format('M月D日')}）`,
      `3. 下下周（${thisMonday.add(14, 'day').format('M月D日')}~${thisMonday.add(20, 'day').format('M月D日')}）`,
      '',
      '或直接输入日期（如 5月20日）',
      '回复「否」取消',
    ].join('\n');
  }

  // Can't select past weeks
  if (targetMonday.isBefore(thisMonday)) {
    return `不能选择过去的周，请选择本周或未来的周。\n\n当前时间：${dayjs().tz('Asia/Shanghai').format('M月D日')}`;
  }

  // Check if this week's rest day can still be modified
  const sunday = targetMonday.add(6, 'day');
  const now = dayjs().tz('Asia/Shanghai').startOf('day');

  // Only produce Mon-Fri buttons
  const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const availableDays: string[] = [];
  const unavailableDays: string[] = [];

  for (let i = 0; i < 7; i++) {
    const d = targetMonday.add(i, 'day');
    const dateLabel = `${weekdays[i]} ${d.format('M月D日')}`;

    if (d.isBefore(now)) {
      unavailableDays.push(`${dateLabel}（已过期）`);
    } else if (i >= 5) {
      // Sat(i=5) or Sun(i=6) — not allowed for rest day selection
      unavailableDays.push(`${dateLabel}（周末休息请用请假功能）`);
    } else {
      availableDays.push(`${weekdays[i]} ${d.format('M月D日')}`);
    }
  }

  session.stepData.targetMonday = targetMonday.format('YYYY-MM-DD');
  session.state = 'REST_SELECT_DAY';
  setSession(wechatUserId, session);

  const lines: string[] = [];
  lines.push(`已选择：${targetMonday.format('M月D日')}~${sunday.format('M月D日')} 这一周`);
  lines.push('');
  lines.push('可选休息日（周一~周五）：');
  lines.push(...availableDays.map((d) => `  · ${d}`));
  if (unavailableDays.length > 0) {
    lines.push('');
    lines.push('不可选：');
    lines.push(...unavailableDays.map((d) => `  ✕ ${d}`));
  }
  lines.push('');
  lines.push('回复日期选择休息日，如「周三」或「5月20日」，回复「否」取消');

  return lines.join('\n');
}

/** 选休第二步：选择具体日期 */
async function handleRestSelectDay(
  wechatUserId: string,
  session: Session,
  input: string,
): Promise<string> {
  const trimmed = input.trim();

  // "否" / "不" → back to week selection
  if (/^[否不]$/.test(trimmed)) {
    session.state = 'REST_SELECT_WEEK';
    session.stepData = {};
    setSession(wechatUserId, session);
    const thisMonday = getThisMonday();
    return [
      '请重新选择要选休的周：',
      `1. 本周（${thisMonday.format('M月D日')}~${thisMonday.add(6, 'day').format('M月D日')}）`,
      `2. 下周（${thisMonday.add(7, 'day').format('M月D日')}~${thisMonday.add(13, 'day').format('M月D日')}）`,
      `3. 下下周`,
      '回复「否」取消',
    ].join('\n');
  }

  const targetMonday = dayjs.tz(session.stepData.targetMonday, 'Asia/Shanghai');
  const selected = parseDate(trimmed, targetMonday);

  if (!selected) {
    return `未能识别您输入的日期，请回复：\n· 周一/周二/...\n· 或具体日期如 5月20日\n\n回复「否」回到上一步`;
  }

  // Check within the week
  const sunday = targetMonday.add(6, 'day');
  if (selected.isBefore(targetMonday) || selected.isAfter(sunday)) {
    return `请选择目标周内的日期（${targetMonday.format('M月D日')}~${sunday.format('M月D日')}），回复「否」回到上一步`;
  }

  // Check not in the past
  const now = dayjs().tz('Asia/Shanghai').startOf('day');
  if (selected.isBefore(now)) {
    return '该日期已过，无法选择。请选择今天或未来的日期，回复「否」回到上一步';
  }

  // Check Mon-Fri only
  const dayOfWeek = selected.day();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    clearSession(wechatUserId);
    return [
      '⛔ 周六和周日不能选为休息日。',
      '',
      '如需在周末休息，请使用「请假」功能申请。',
      '周一至周五为可选休息日。',
      '',
      '输入「请假」开始请假申请',
    ].join('\n');
  }

  const dateStr = selected.format('YYYY-MM-DD');
  const weekday = WEEKDAY_CN[selected.day()];
  const weekLabel = `${targetMonday.format('M月D日')}~${sunday.format('M月D日')}`;

  session.stepData.selectedDate = dateStr;
  session.state = 'REST_CONFIRM';
  setSession(wechatUserId, session);

  return `确认在 ${weekLabel} 这一周，选择 ${selected.format('M月D日')}（${weekday}）作为休息日？\n\n回复「是」确认，「否」重新选择日期`;
}

/** 选休第三步：确认提交 */
async function handleRestConfirm(
  wechatUserId: string,
  session: Session,
  input: string,
): Promise<string> {
  const trimmed = input.trim();

  if (/^[否不]$/.test(trimmed)) {
    session.state = 'REST_SELECT_DAY';
    session.stepData = {};
    setSession(wechatUserId, session);
    const monday = dayjs.tz(session.stepData.targetMonday, 'Asia/Shanghai');
    const sunday = monday.add(6, 'day');
    return `请重新选择休息日（${monday.format('M月D日')}~${sunday.format('M月D日')}），回复「否」回到选周`;
  }

  if (/^(是|确认|好|可以|ok|yes|对|嗯|行)$/i.test(trimmed)) {
    const dateStr = session.stepData.selectedDate;
    const targetMonday = session.stepData.targetMonday;
    try {
      const result = await upsertRestDay(
        session.userId,
        session.storeId,
        dateStr,
        { userId: session.userId, role: session.role, storeId: session.storeId },
        targetMonday,
      );
      const restDate = dayjs.utc(result.restDate).tz('Asia/Shanghai');
      const weekday = WEEKDAY_CN[restDate.day()];
      const weekStart = dayjs.tz(targetMonday, 'Asia/Shanghai');
      clearSession(wechatUserId);
      return `✅ 已设置！\n${weekStart.format('M月D日')}~${weekStart.add(6, 'day').format('M月D日')} 这一周\n休息日：${restDate.format('M月D日')}（${weekday}）\n\n输入「查询」可查看当前状态`;
    } catch (err: any) {
      clearSession(wechatUserId);
      const msg = err.message || '操作失败';
      if (msg.includes('周一') || msg.includes('周五') || msg.includes('周末')) return `⛔ ${msg}`;
      if (msg.includes('截止时间')) return `⛔ ${msg}\n\n如需帮助请联系管理员。`;
      if (msg.includes('排班')) return `⛔ ${msg}\n\n请重新发起选休，选择一个没有排班的日期。`;
      return `⛔ ${msg}`;
    }
  }

  return '请回复「是」确认设置，或「否」重新选择';
}

// ==================== Leave Handlers ====================

async function handleLeaveSelectType(
  wechatUserId: string,
  session: Session,
  input: string,
): Promise<string> {
  const trimmed = input.trim();

  // "否" / "不" → cancel
  if (/^[否不]$/.test(trimmed)) {
    clearSession(wechatUserId);
    return '已取消请假操作。';
  }

  const type = LEAVE_TYPE_CN[trimmed];
  if (!type) {
    return '请输入有效的请假类型：\n1. 年假\n2. 病假\n3. 事假\n\n回复数字（1/2/3）或类型名（年假/病假/事假），回复「否」取消';
  }

  session.stepData.leaveType = type;
  session.state = 'LEAVE_ENTER_DATES';
  setSession(wechatUserId, session);

  return `已选择：${LEAVE_TYPE_LABEL[type]}\n\n请输入请假起止日期，例如：\n· 5月20日-5月21日\n· 5月20日到5月21日\n· 5月20日（只请一天）\n\n回复「否」取消`;
}

async function handleLeaveEnterDates(
  wechatUserId: string,
  session: Session,
  input: string,
): Promise<string> {
  const trimmed = input.trim();

  if (/^[否不]$/.test(trimmed)) {
    clearSession(wechatUserId);
    return '已取消请假操作。';
  }

  const range = parseDateRange(trimmed);
  if (!range) {
    return '未能识别日期，请使用以下格式：\n· 5月20日-5月21日\n· 5月20日到5月21日\n· 5月20日（只请一天）\n\n回复「否」取消';
  }

  const now = dayjs().tz('Asia/Shanghai').startOf('day');
  // Allow today and future dates, but warn about past

  const days = range.end.diff(range.start, 'day') + 1;
  session.stepData.leaveStart = range.start.format('YYYY-MM-DD');
  session.stepData.leaveEnd = range.end.format('YYYY-MM-DD');
  session.stepData.leaveDays = days;
  session.state = 'LEAVE_ENTER_REASON';
  setSession(wechatUserId, session);

  const dateDesc = range.start.isSame(range.end, 'day')
    ? formatDate(range.start)
    : `${formatDate(range.start)} ~ ${formatDate(range.end)}（共${days}天）`;

  return `请假日期：${dateDesc}\n\n请输入请假原因（选填）：\n直接回复原因内容，或回复「无」跳过`;
}

async function handleLeaveEnterReason(
  wechatUserId: string,
  session: Session,
  input: string,
): Promise<string> {
  const trimmed = input.trim();

  if (/^[否不]$/.test(trimmed)) {
    clearSession(wechatUserId);
    return '已取消请假操作。';
  }

  const reason = /^无$/.test(trimmed) ? '' : trimmed;
  session.stepData.leaveReason = reason;
  session.state = 'LEAVE_CONFIRM';
  setSession(wechatUserId, session);

  const typeLabel = LEAVE_TYPE_LABEL[session.stepData.leaveType];
  const start = formatDate(dayjs.tz(session.stepData.leaveStart, 'Asia/Shanghai'));
  const end = formatDate(dayjs.tz(session.stepData.leaveEnd, 'Asia/Shanghai'));
  const days = session.stepData.leaveDays;
  const dateDesc = start === end ? start : `${start} ~ ${end}（共${days}天）`;

  return [
    '请确认请假信息：',
    `📋 类型：${typeLabel}`,
    `📅 日期：${dateDesc}`,
    `📝 原因：${reason || '无'}`,
    '',
    '回复「是」确认提交，「否」取消',
  ].join('\n');
}

async function handleLeaveConfirm(
  wechatUserId: string,
  session: Session,
  input: string,
): Promise<string> {
  const trimmed = input.trim();

  if (/^[否不]$/.test(trimmed)) {
    clearSession(wechatUserId);
    return '已取消请假操作。';
  }

  if (/^(是|确认|好|可以|ok|yes|对|嗯|行)$/i.test(trimmed)) {
    try {
      const result = await createLeave(
        session.userId,
        session.storeId,
        session.stepData.leaveType,
        session.stepData.leaveStart,
        session.stepData.leaveEnd,
        session.stepData.leaveReason || undefined,
      );

      // 通知管理员
      const start = dayjs.tz(session.stepData.leaveStart, 'Asia/Shanghai').format('M月D日');
      const end = dayjs.tz(session.stepData.leaveEnd, 'Asia/Shanghai').format('M月D日');
      notifyAdminsForLeave(
        session.name,
        session.stepData.leaveType,
        start,
        end,
        session.stepData.leaveReason || undefined,
      ).catch(() => {});

      clearSession(wechatUserId);
      const typeLabel = LEAVE_TYPE_LABEL[session.stepData.leaveType];
      return [
        '✅ 请假申请已提交！',
        `类型：${typeLabel}`,
        `日期：${start} ~ ${end}`,
        '状态：⏳ 待审批',
        '',
        '管理员审核后会通过企业微信通知您。',
        '输入「查询」可随时查看审批状态。',
      ].join('\n');
    } catch (err: any) {
      clearSession(wechatUserId);
      const msg = err.message || '提交失败';
      if (msg.includes('重叠')) return `⛔ ${msg}\n\n如需帮助请联系管理员。`;
      return `⛔ ${msg}`;
    }
  }

  return '请回复「是」确认提交，或「否」取消';
}
