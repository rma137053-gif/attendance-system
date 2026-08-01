# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Server (Express + TypeScript 5.6, CommonJS output)

```bash
cd server
npm install
npm run dev            # tsx watch src/index.ts → :3000
npm run build          # tsc → dist/
npm start              # node dist/index.js (production entry)
npm run db:migrate     # prisma migrate dev
npm run db:seed        # tsx prisma/seed.ts
npm run db:reset       # prisma migrate reset --force (wipes DB, re-runs migrations + seed)
```

### Client (React 19 + Vite 8 + Tailwind CSS v4)

```bash
cd client
npm install
npm run dev            # Vite → :5173, proxies /api → :3000
npm run build          # tsc -b && vite build → dist/
npm run lint           # eslint
npm run preview        # vite preview (preview built dist)
```

### Roster Client (排班助手 — same stack as client, separate app)

```bash
cd roster-client
npm install
npm run dev            # Vite → :5174, base=/roster/, proxies /api → :3000
npm run build          # tsc -b && vite build → dist/
```

### Type checking

```bash
cd server && npx tsc --noEmit
cd client && npx tsc -b
cd roster-client && npx tsc -b
```

## Architecture

### Three sub-projects

| Project | Path | Purpose |
|---------|------|---------|
| `server` | `/server` | Express API, Prisma ORM, WeChat service, cron jobs |
| `client` | `/client` | Main app: clock-in/out, employee dashboard, admin management, leave, rest-day selection |
| `roster-client` | `/roster-client` | 排班助手: today/week roster views, roster management, hours stats |

Both `client` and `roster-client` share the same API server. In production, `client` is served from `/app/client/dist/` at `/`, and `roster-client` from `/app/client/dist/roster/` at `/roster/`.

### Roles & permissions

Three roles in `User.role` (Prisma string field):

| Role | storeId | Scope |
|------|---------|-------|
| `ADMIN` | `null` | All stores, audit logs, leave approval, user management, anomaly toggle |
| `STORE_ADMIN` | has `storeId` | Own store: roster, clock for employees, records/stats, add employees. Cannot edit/disable employees, no audit logs, no leave access |
| `EMPLOYEE` | has `storeId` | Self-service: clock (legacy), leave requests, rest-day selection. No longer logs in for clocking (done by STORE_ADMIN on shared tablet) |

### Auth & middleware chain

1. **`authMiddleware`** — JWT Bearer → `req.user: { userId, role, storeId }`. Applied to most routes.
2. **`requireStoreAdmin`** — permits `ADMIN` or `STORE_ADMIN`.
3. **`requireAdmin`** — permits `ADMIN` only.
4. **`audit(action, resourceType?)`** — wraps `res.json` to fire-and-forget AuditLog on 2xx.

JWT tokens: signed with `config.jwtSecret`, expire `7d`. Payload: `userId`, `role`, `storeId`.

### Permission patterns in routes

Each route independently checks permissions — no blanket middleware for role-specific routes (see `routes/leaves.ts`, `routes/weekly-rest.ts`):

```typescript
router.use(authMiddleware);
router.get('/', async (req, res, next) => {
  const { role, userId, storeId } = req.user!;
  if (role === 'STORE_ADMIN') throw new ForbiddenError();
  // EMPLOYEE: scope to own userId; ADMIN: optional filters
});
```

### Store scoping

Service functions accept `requesterStoreId: string | null`:
- `null` (ADMIN) → sees all stores
- `string` (STORE_ADMIN/EMPLOYEE) → scoped to that store only

### Route mounting order (index.ts)

```
/api/auth, /api/users, /api/records, /api/photos, /api/reports,
/api/stats, /api/audit-logs, /api/roster, /api/handover,
/api/leaves, /api/weekly-rest, /api/wechat/callback, /api/wechat
```

### Database — Prisma with SQLite (dev) / Postgres (prod)

9 models: `Store`, `User`, `ClockRecord`, `AuditLog`, `Roster`, `HandoverNote`, `Leave`, `WeeklyRest`, `PushLog`

Key constraints and patterns:
- **Roster**: `@@unique([userId, shiftDate])` — one shift per employee per day. `shiftDate` = Beijing 00:00 stored as UTC. `startTime`/`endTime` = `"HH:mm"` Beijing time strings.
- **Leave**: `@@index([startDate, endDate])`. Types: `ANNUAL`, `SICK`, `PERSONAL`. Statuses: `PENDING`, `APPROVED`, `REJECTED`.
- **WeeklyRest**: `@@unique([userId, weekStart])` — one rest day per employee per week. `restDate` and `weekStart` = Beijing 00:00 UTC.
- **ClockRecord**: `rosterId` optionally links to Roster. `isAnomalous` flag, `lateMinutes`, `note`.
- Seed: 1 ADMIN, 3 stores × (1 STORE_ADMIN + 2-3 EMPLOYEEs). All passwords: `password123`. PINs: `1234`.

### Timezone handling

All timestamps stored as **UTC**. The `utils/timezone.ts` module provides helpers:

| Function | Returns |
|----------|---------|
| `nowBeijing()` | Current Beijing time as dayjs |
| `toBeijing(d)` | UTC Date → Beijing dayjs |
| `beijingDayStart(d)` | Beijing 00:00 → UTC Date |
| `beijingDayEnd(d)` | Beijing 23:59:59 → UTC Date |
| `beijingWeekStart(d)` | Beijing Monday 00:00 → UTC Date |
| `formatBeijing(d)` | UTC Date → `YYYY-MM-DDTHH:mm:ss+08:00` string |

API responses use `formatBeijing()`. Frontends use `dayjs.utc(d).tz('Asia/Shanghai')`.

### Error handling

Custom error classes in `utils/errors.ts`: `AppError`, `BadRequestError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404).

Global error handler in `index.ts` catches: `AppError` → statusCode; `MulterError` → 400; `ZodError` → 400; unknown → 500.

### Zod validation

Routes use Zod schemas for request body validation. Errors thrown by `.parse()` are caught by the global handler and formatted as `"path: message"`. Example pattern:

```typescript
const createSchema = z.object({
  type: z.enum(['ANNUAL', 'SICK', 'PERSONAL']),
  startDate: z.string().min(1, '开始日期不能为空'),
});
const body = createSchema.parse(req.body);
```

### WeChat (企业微信) integration

`services/wechat.service.ts`:
- `getAccessToken()` — cached with 5-min buffer before expiry
- `sendAppMessage({ touser, title?, content, url? })` — text or textcard. Fire-and-forget: `.catch(err => console.error(...))`
- `matchWechatUsers()` — exact name match first, then fuzzy. Writes `wechatUserId` back to User.
- WeChat notification is sent on: new roster, updated roster, deleted roster, new leave request, new rest-day selection.

### Scheduled jobs (`jobs/scheduler.ts`)

Uses `node-cron`. Only runs on PM2 worker 0 (`NODE_APP_INSTANCE === '0'`):
- `* * * * *` — `runReminderCheck()`: clock-in reminder (5min before), late urge, clock-out reminder (5min before). Skips employees on leave AND rest days.
- `0 3 * * *` — `runPhotoCleanup()`: deletes photos >70 days old and orphan files.

### Leave system

- Employees submit leave requests; admins approve/reject
- Approved leave dates: clock records not marked anomalous; reminders suppressed; reports count `leaveDays`
- WeChat notification sent to all admins with wechatUserId on new request
- Employee can only view/edit own PENDING leaves; admin manages all

### Weekly rest-day selection (选休)

- `WeeklyRest` model: `@@unique([userId, weekStart])` — one per employee per week
- Deadline: day before rest date at 23:59 Beijing time (`canStillModify()`)
- Conflict check: cannot select a day that already has a roster; cannot roster a rest day
- Employee self-service page: `client/src/pages/employee/RestDaySelector.tsx`
- Admin override: ManagePage in roster-client can set/unset rest days
- WeChat notification to admins on first selection by employee

### Photo upload — dual path

1. **Multipart** (`multipart/form-data`): multer in-memory. For web browsers.
2. **JSON base64** (`application/json`): `photoBase64` + `photoName`. Preferred from client — avoids nginx/mobile carrier multipart drops.

### Two clock flows

- **`store-admin/ClockPage.tsx`** (primary): Select employee → PIN → type → camera → confirm. Auto-resets 3s.
- **`employee/ClockPage.tsx`** (legacy): Select identity → type → camera → confirm. No PIN.

## 部署 (Deployment)

### ⛔ 部署三大铁律 — 违反任何一条都会导致生产事故

1. **备份先行**：部署前必须先执行 `bash /root/backup-all-dbs.sh`
2. **保护数据库**：tar 包禁止包含 `prisma/dev.db`；服务器上禁止 `rm -rf prisma/`，只删 `prisma/migrations/` 和 `prisma/schema.prisma`
3. **只动目标服务**：禁止 `pm2 delete all`；用 `pm2 delete attendance-server` 只操作考勤系统

### 服务器连接

阿里云 ECS: `47.102.223.195`，用户 `root`，密码 `Amlx123456`
Nginx 80 → Express :3000，前端 `/app/client/dist/`

### 服务器目录结构

| 路径 | 说明 |
|------|------|
| `/app/server/` | 考勤 Express 后端 (PM2: attendance-server → :3000) |
| `/app/finance-server/` | 财务后端 (PM2: finance-server → :3001) |
| `/app/inventory-server/` | 进销存后端 (PM2: inventory-server → :3002) |
| `/app/tag-server/` | 标签后端 (PM2: tag-server → :3003) |
| `/app/client/dist/` | 考勤前端 (nginx `/`) |
| `/app/client/dist/roster/` | 排班助手前端 (nginx `/roster/`) |

### 部署步骤（严格按顺序）

**Step 0: 备份数据库**

```bash
# 通过 SSH 执行，备份所有系统的数据库
bash /root/backup-all-dbs.sh
```

**Step 1: 本地构建**

```bash
cd server && npm run build
cd client && npm run build
cd roster-client && npm run build
```

**Step 2: 打包（禁止包含 dev.db）**

```bash
# macOS 必须加 COPYFILE_DISABLE=1 防止 Apple Double 文件污染
# ⛔ 只打包 dist/ prisma/migrations/ prisma/schema.prisma — 绝不打 prisma/dev.db！
cd server && COPYFILE_DISABLE=1 tar czf /tmp/server-deploy.tar.gz dist/ prisma/migrations/ prisma/schema.prisma package.json package-lock.json
cd client/dist && COPYFILE_DISABLE=1 tar czf /tmp/client-only.tar.gz .
cd roster-client/dist && COPYFILE_DISABLE=1 tar czf /tmp/roster-only.tar.gz .
```

**Step 3: 上传到服务器**

用 Perl Expect 脚本通过 scp 上传（自动处理密码）。

**Step 4: 服务器端部署**

```bash
# === 停止考勤服务（只停这一个！） ===
pm2 delete attendance-server

# === 部署 server（逐文件删除，不用 rm -rf prisma/） ===
rm -rf /app/server/dist/
rm -rf /app/server/prisma/migrations/
rm -f /app/server/prisma/schema.prisma
rm -f /app/server/package.json
rm -f /app/server/package-lock.json
# ⛔ 绝对不碰 /app/server/prisma/dev.db！
tar xzf /tmp/server-deploy.tar.gz -C /app/server/
cd /app/server && npm ci --omit=dev
cd /app/server && npx prisma migrate deploy

# === 部署 client ===
cd /app/client/dist && rm -rf assets/ index.html favicon.svg logo.png
cd /app/client/dist && tar xzf /tmp/client-only.tar.gz
chmod -R 755 /app/client/dist

# === 部署 roster-client ===
cd /app/client/dist/roster && rm -rf assets/ index.html
cd /app/client/dist/roster && tar xzf /tmp/roster-only.tar.gz
chmod -R 755 /app/client/dist/roster

# === 启动考勤服务 ===
cd /app/server && pm2 start dist/index.js --name attendance-server
pm2 save
```

**Step 5: 验证**

```bash
curl -s http://localhost:3000/api/health   # 考勤
# 确认其他服务没有被影响：
pm2 list   # 四个服务都应该 online
```

**Step 6: 拉取数据库备份到本地**

```bash
cd ~/Desktop/Claude\ Code && bash pull-backups.sh
```

### PM2 重启规则

- ✅ `pm2 delete attendance-server` → `pm2 start ... --name attendance-server`（只重启考勤）
- ❌ `pm2 delete all`（会杀掉财务、进销存、标签服务！）
- ❌ `pm2 restart`（不清理 require cache）

### 客户端部署规则

- 禁止 `rm -rf /app/client/dist/*`（会删掉 `/app/client/dist/roster/`）
- 禁止 `rm -rf /app/client/dist/roster/*`
- 只删除具体文件：`assets/`、`index.html`、`favicon.svg`、`logo.png`

## Tailwind CSS v4 theme

Custom `@theme` in both `client/src/index.css` and `roster-client/src/index.css`:
- Brand: `--color-brand` (champagne/gold)
- Clock: `--color-clock-in` (green), `--color-clock-out` (blue)
- Status: `--color-anomaly` (amber), `--color-danger` (red)
- Shift colors (roster-client): `--color-shift-early` (green), `--color-shift-mid` (orange), `--color-shift-late` (purple)
- Surface: `--color-surface`, `--color-surface-card`
