const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const fs = require('fs');
const path = require('path');
const envPath = path.join('/app/server', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1).replace(/^["']|["']$/g, '');
}

async function getToken(corpId, secret) {
  const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpId}&corpsecret=${secret}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.errcode !== 0) throw new Error(data.errmsg);
  return data.access_token;
}

async function listWxUsers(token) {
  const url = `https://qyapi.weixin.qq.com/cgi-bin/user/simplelist?access_token=${token}&department_id=1&fetch_child=1`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.errcode !== 0) throw new Error(data.errmsg);
  return data.userlist || [];
}

async function main() {
  const token = await getToken(env.WECHAT_CORP_ID, env.WECHAT_SECRET);

  console.log('=== 企微通讯录成员 ===');
  const wxUsers = await listWxUsers(token);
  for (const u of wxUsers) {
    console.log(`  ${u.name} (userid: ${u.userid})`);
  }

  console.log('\n=== 本地系统用户 ===');
  const localUsers = await prisma.user.findMany({
    where: { status: 'ACTIVE' },
    select: { name: true, role: true, wechatUserId: true },
  });
  for (const u of localUsers) {
    console.log(`  ${u.name} (${u.role}) wechatUserId: ${u.wechatUserId || '未绑定'}`);
  }

  await prisma.$disconnect();
}
main();
