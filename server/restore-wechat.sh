#!/bin/bash
# 恢复企业微信匹配 — 即使数据库被替换也能一键恢复
cd /app/server
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const mapping = {
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
  for (const [name, wxId] of Object.entries(mapping)) {
    try {
      await prisma.user.updateMany({ where: { name }, data: { wechatUserId: wxId } });
      console.log('OK:', name, '->', wxId);
    } catch(e) { console.log('SKIP:', name, e.message); }
  }
  await prisma.\$disconnect();
  console.log('Done');
}
main();
"
