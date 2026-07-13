import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// 永久企业微信匹配 — 改代码/换数据库都不会丢失
const WECHAT: Record<string, string> = {
  '刘永纪': 'Yun',
  '夏淑利': 'XiaoXia',
  '邬灵芝': 'ShengRuXiaHua',
  '牟思敏': 'msm',
  '刘静': 'JianDanXingFu',
  '王海云': 'XinXiangShiCheng',
  '田加美': 'TianJiaMei',
  '穆雪琴': 'moon',
  '董金艳': 'dy',
  '蒋滟缤': 'QianMo',
};

async function main() {
  const adminPwd = await bcrypt.hash('password123', 10);
  const userPwd = await bcrypt.hash('123', 10);

  // Global admin
  await prisma.user.create({
    data: {
      email: 'admin@ruilun.com',
      passwordHash: adminPwd,
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
          { email: 'haichanglu@ruilun.com', passwordHash: userPwd, name: '海昌路瑞伦店长', role: 'STORE_ADMIN' },
          { email: 'liuyongji@ruilun.com',   passwordHash: userPwd, name: '刘永纪', role: 'EMPLOYEE', pin: '5411', canSelectRest: true, wechatUserId: WECHAT['刘永纪'] },
          { email: 'xiashuli@ruilun.com',    passwordHash: userPwd, name: '夏淑利', role: 'EMPLOYEE', pin: '4321', wechatUserId: WECHAT['夏淑利'] },
          { email: 'wulingzhi@ruilun.com',   passwordHash: userPwd, name: '邬灵芝', role: 'EMPLOYEE', pin: '1234', wechatUserId: WECHAT['邬灵芝'] },
          { email: 'jessimu1206@gmail.com',  passwordHash: userPwd, name: '牟思敏', role: 'EMPLOYEE', pin: '1234', crossStore: true, wechatUserId: WECHAT['牟思敏'] },
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
          { email: 'xugou@ruilun.com',      passwordHash: userPwd, name: '墟沟瑞伦店长', role: 'STORE_ADMIN' },
          { email: 'tianjiamei@ruilun.com', passwordHash: userPwd, name: '田加美', role: 'EMPLOYEE', pin: '6666', wechatUserId: WECHAT['田加美'] },
          { email: 'wanghaiyun@ruilun.com', passwordHash: userPwd, name: '王海云', role: 'EMPLOYEE', pin: '8209', wechatUserId: WECHAT['王海云'] },
          { email: 'liujing@ruilun.com',    passwordHash: userPwd, name: '刘静',   role: 'EMPLOYEE', pin: '1131', canSelectRest: true, wechatUserId: WECHAT['刘静'] },
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
          { email: 'tongguan@ruilun.com',    passwordHash: userPwd, name: '通灌路瑞伦店长', role: 'STORE_ADMIN' },
          { email: 'jiangyanbin@ruilun.com', passwordHash: userPwd, name: '蒋滟缤', role: 'EMPLOYEE', pin: '4728', canSelectRest: true, wechatUserId: WECHAT['蒋滟缤'] },
          { email: 'muxueqin@ruilun.com',   passwordHash: userPwd, name: '穆雪琴', role: 'EMPLOYEE', pin: '1982', wechatUserId: WECHAT['穆雪琴'] },
          { email: 'dongjinyan@ruilun.com',  passwordHash: userPwd, name: '董金艳', role: 'EMPLOYEE', pin: '1008', wechatUserId: WECHAT['董金艳'] },
        ],
      },
    },
  });

  console.log('Seed completed: 1 admin + 3 stores + 11 employees (all with WeChat IDs)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
