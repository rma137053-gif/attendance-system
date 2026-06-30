import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);
  const userPwdHash = await bcrypt.hash('123', 10);

  // Global admin (no store)
  await prisma.user.create({
    data: {
      email: 'admin@ruilun.com',
      passwordHash,
      name: '管理员',
      role: 'ADMIN',
    },
  });

  // Store 1: 海昌路瑞伦
  await prisma.store.create({
    data: {
      name: '海昌路瑞伦',
      users: {
        create: [
          { email: 'haichanglu@ruilun.com', passwordHash: userPwdHash, name: '海昌路瑞伦店长', role: 'STORE_ADMIN' },
          { email: 'liuyongji@ruilun.com',   passwordHash: userPwdHash, name: '刘永纪', role: 'EMPLOYEE', pin: '1234' },
          { email: 'wulingzhi@ruilun.com',   passwordHash: userPwdHash, name: '邬灵芝', role: 'EMPLOYEE', pin: '1234' },
          { email: 'xiashuli@ruilun.com',    passwordHash: userPwdHash, name: '夏淑利', role: 'EMPLOYEE', pin: '1234' },
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
          { email: 'xugou@ruilun.com',    passwordHash: userPwdHash, name: '墟沟瑞伦店长', role: 'STORE_ADMIN' },
          { email: 'tianjiamei@ruilun.com', passwordHash: userPwdHash, name: '田加美', role: 'EMPLOYEE', pin: '1234' },
          { email: 'wanghaiyun@ruilun.com', passwordHash: userPwdHash, name: '王海云', role: 'EMPLOYEE', pin: '1234' },
          { email: 'liujing@ruilun.com',    passwordHash: userPwdHash, name: '刘静',   role: 'EMPLOYEE', pin: '1234' },
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
          { email: 'tongguan@ruilun.com',   passwordHash: userPwdHash, name: '通灌路瑞伦店长', role: 'STORE_ADMIN' },
          { email: 'jiangyanbin@ruilun.com', passwordHash: userPwdHash, name: '蒋艳滨', role: 'EMPLOYEE', pin: '1234' },
          { email: 'muxueqin@ruilun.com',   passwordHash: userPwdHash, name: '穆雪琴', role: 'EMPLOYEE', pin: '1234' },
          { email: 'dongjinyan@ruilun.com',  passwordHash: userPwdHash, name: '董金艳', role: 'EMPLOYEE', pin: '1234' },
        ],
      },
    },
  });

  console.log('Seed completed: 1 admin + 3 stores\n');
  console.log('管理员: admin@ruilun.com / password123');
  console.log('');
  console.log('海昌路瑞伦: haichanglu@ruilun.com / 123');
  console.log('  员工: 刘永纪, 邬灵芝, 夏淑利');
  console.log('墟沟瑞伦:   xugou@ruilun.com / 123');
  console.log('  员工: 田加美, 王海云, 刘静');
  console.log('通灌路瑞伦: tongguan@ruilun.com / 123');
  console.log('  员工: 蒋艳滨, 穆雪琴, 董金艳');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
