# 员工打卡系统

全公司上下班打卡系统。员工通过网页端选择姓名并拍照完成打卡，管理员通过后台管理员工并查看报表。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 18 + Vite + Tailwind CSS + React Router |
| 后端 | Node.js + Express + TypeScript |
| 数据库 | SQLite（开发）/ PostgreSQL（生产） |
| ORM | Prisma |
| 文件存储 | 本地文件系统（开发）/ S3 兼容对象存储（生产） |
| 鉴权 | JWT (JSON Web Token) |

## 时区说明

- **所有时间戳以 UTC 存储**在数据库中
- API 响应中的时间字段统一返回 `Asia/Shanghai` (+08:00) 格式
- 报表统计按北京时间计算日/周/月边界

## 快速开始（本地开发）

### 前置要求

- Node.js >= 18
- npm >= 9

### 1. 启动后端

```bash
cd server
cp .env.example .env   # 如需要，编辑 .env 配置
npm install
npm run db:migrate     # 初始化数据库
npm run db:seed        # 导入种子数据（测试账号）
npm run dev            # 启动后端 http://localhost:3000
```

### 2. 启动前端

```bash
cd client
npm install
npm run dev            # 启动前端 http://localhost:5173
```

浏览器访问 `http://localhost:5173` 即可使用。

## 测试账号

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 管理员 | admin@test.com | password123 |
| 员工 | employee@test.com | password123 |

## 环境变量

### 后端 (server/.env)

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | Prisma 数据库连接串 | `file:./dev.db` |
| `JWT_SECRET` | JWT 签名密钥（生产环境请使用 32 位以上随机字符串） | `dev-secret-change-me` |
| `JWT_EXPIRES_IN` | JWT 过期时间 | `7d` |
| `PORT` | 后端监听端口 | `3000` |
| `UPLOAD_DIR` | 照片本地存储目录 | `./uploads/photos` |
| `STORAGE_TYPE` | 存储类型：`local` 或 `s3` | `local` |
| `S3_ENDPOINT` | S3 服务端点 | - |
| `S3_BUCKET` | S3 Bucket 名称 | - |
| `S3_REGION` | S3 区域 | - |
| `S3_ACCESS_KEY` | S3 Access Key | - |
| `S3_SECRET_KEY` | S3 Secret Key | - |

## 如何初始化首个管理员

1. 启动后端并运行种子脚本：`npm run db:seed`
2. 种子脚本会创建管理员 `admin@test.com`
3. 或通过注册接口手动创建后，直接在数据库中修改该用户的 `role` 字段为 `ADMIN`

## 生产部署

### 使用 Docker Compose

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - '3000:3000'
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/attendance
      - JWT_SECRET=your-production-secret-min-32-chars
      - STORAGE_TYPE=s3
      - S3_ENDPOINT=https://your-s3-endpoint
      - S3_BUCKET=attendance-photos
      - S3_REGION=auto
      - S3_ACCESS_KEY=your-access-key
      - S3_SECRET_KEY=your-secret-key
    depends_on:
      - db
  db:
    image: postgres:16
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=attendance
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

### 直接部署

1. 构建前端：`cd client && npm run build`，产物在 `client/dist/`
2. 构建后端：`cd server && npm run build`，产物在 `server/dist/`
3. 将前端静态文件配置到 Nginx 或 CDN，将 `/api` 反向代理到后端
4. 后端使用 `node dist/index.js` 启动

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name example.com;

    # 前端静态文件
    root /var/www/attendance/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 照片存储与隐私

- **存储**：开发环境照片存于 `server/uploads/photos/`；生产环境应配置 S3 兼容对象存储
- **访问控制**：照片不直接暴露 URL，通过 `GET /api/photos/:recordId` 接口访问，后端校验用户权限：
  - 员工只能查看自己的打卡照片
  - 管理员可查看所有人的照片
- **保留策略**：默认永久保留。可根据需要配置定期清理（如 90 天前的照片通过定时任务删除）

## API 概览

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/auth/register` | 公开 | 注册 |
| POST | `/api/auth/login` | 公开 | 登录，返回 JWT |
| GET | `/api/auth/me` | 登录用户 | 获取当前用户信息 |
| GET | `/api/users` | 管理员 | 员工列表 |
| POST | `/api/users` | 管理员 | 添加员工 |
| PUT | `/api/users/:id` | 管理员 | 编辑员工 |
| PATCH | `/api/users/:id/status` | 管理员 | 启停员工 |
| POST | `/api/records/clock-in` | 登录用户 | 上班打卡（multipart: photo） |
| POST | `/api/records/clock-out` | 登录用户 | 下班打卡（multipart: photo） |
| GET | `/api/records` | 登录用户 | 查询打卡记录 |
| GET | `/api/photos/:recordId` | 登录用户 | 查看打卡照片 |
| GET | `/api/reports/weekly` | 管理员 | 周报 |
| GET | `/api/reports/monthly` | 管理员 | 月报 |
| GET | `/api/reports/export` | 管理员 | 导出 CSV |

## 项目结构

```
attendance-system/
├── server/                 # 后端
│   ├── src/
│   │   ├── index.ts        # 入口
│   │   ├── config.ts       # 环境变量
│   │   ├── middleware/      # auth, requireAdmin, audit
│   │   ├── routes/          # API 路由
│   │   ├── services/        # 业务逻辑
│   │   └── utils/           # 工具函数（时区、错误类）
│   ├── prisma/
│   │   ├── schema.prisma    # 数据模型
│   │   └── seed.ts          # 种子数据
│   └── uploads/photos/      # 本地照片存储 (dev)
├── client/                  # 前端
│   └── src/
│       ├── App.tsx          # 路由 + 鉴权守卫
│       ├── api/client.ts    # axios 实例
│       ├── hooks/           # useAuth, useCamera
│       ├── components/      # Layout 等
│       └── pages/           # 登录、员工端、管理员端
└── README.md
```
