import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const prisma = new PrismaClient();

function beijingDayStart(date: string): Date {
  return dayjs.tz(date, 'Asia/Shanghai').startOf('day').toDate();
}

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  // Global admin (no store)
  await prisma.user.create({
    data: {
      email: 'admin@test.com',
      passwordHash,
      name: '管理员',
      role: 'ADMIN',
    },
  });

  // Store 1: 瑞伦大店
  await prisma.store.create({
    data: {
      name: '瑞伦大店',
      users: {
        create: [
          { email: 'cy-manager@test.com', passwordHash, name: '瑞伦大店店长', role: 'STORE_ADMIN' },
          { email: 'zhangsan@test.com', passwordHash, name: '张三', role: 'EMPLOYEE', pin: '1234' },
          { email: 'lisi@test.com', passwordHash, name: '李四', role: 'EMPLOYEE', pin: '1234' },
          { email: 'wangwu@test.com', passwordHash, name: '王五', role: 'EMPLOYEE', pin: '1234' },
        ],
      },
    },
  });

  // Store 2: 墟沟瑞伦
  await prisma.store.create({
    data: {
      name: '墟沟瑞伦',
      users: {
        create: [
          { email: 'hd-manager@test.com', passwordHash, name: '墟沟瑞伦店长', role: 'STORE_ADMIN' },
          { email: 'zhaoliu@test.com', passwordHash, name: '赵六', role: 'EMPLOYEE', pin: '1234' },
          { email: 'sunqi@test.com', passwordHash, name: '孙七', role: 'EMPLOYEE', pin: '1234' },
        ],
      },
    },
  });

  // Store 3: 通灌路瑞伦
  await prisma.store.create({
    data: {
      name: '通灌路瑞伦',
      users: {
        create: [
          { email: 'ft-manager@test.com', passwordHash, name: '通灌路瑞伦店长', role: 'STORE_ADMIN' },
          { email: 'zhouba@test.com', passwordHash, name: '周八', role: 'EMPLOYEE', pin: '1234' },
          { email: 'wujiu@test.com', passwordHash, name: '吴九', role: 'EMPLOYEE', pin: '1234' },
        ],
      },
    },
  });

  // --- Seed roster data for the current week ---
  const stores = await prisma.store.findMany({
    include: { users: { select: { id: true, name: true, role: true } } },
  });

  const today = dayjs().tz('Asia/Shanghai').startOf('day');
  // Generate roster for 7 days starting from today
  for (let i = 0; i < 7; i++) {
    const date = today.add(i, 'day');
    const dateStr = date.format('YYYY-MM-DD');

    for (const store of stores) {
      const regularEmployees = store.users.filter((u) => u.role === 'EMPLOYEE');

      for (let j = 0; j < regularEmployees.length; j++) {
        const startTime = j % 2 === 0 ? '08:00' : '12:00';
        const endTime = j % 2 === 0 ? '13:30' : '21:00';
        await prisma.roster.upsert({
          where: { userId_shiftDate: { userId: regularEmployees[j].id, shiftDate: beijingDayStart(dateStr) } },
          create: { storeId: store.id, userId: regularEmployees[j].id, shiftDate: beijingDayStart(dateStr), startTime, endTime },
          update: {},
        });
      }
    }
  }

  console.log('Seed completed: 1 global admin, 3 stores with roster data\n');
  console.log('全局管理员: admin@test.com / password123');
  console.log('瑞伦大店店长: cy-manager@test.com / password123 (员工: 张三, 李四, 王五)');
  console.log('墟沟瑞伦店长: hd-manager@test.com / password123 (员工: 赵六, 孙七)');
  console.log('通灌路瑞伦店长: ft-manager@test.com / password123 (员工: 周八, 吴九)');
  console.log('排班数据: 已为所有门店员工生成最近7天排班');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
