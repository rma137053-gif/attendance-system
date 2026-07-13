const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

const env = {};
fs.readFileSync('/app/server/.env', 'utf8').split('\n').forEach(l => {
  const t = l.trim();
  if (!t || t.startsWith('#')) return;
  const i = t.indexOf('=');
  if (i === -1) return;
  env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
});

// Extract PROPOSAL from the existing file
const sendJs = fs.readFileSync('/app/server/send-proposal.js', 'utf8');
const match = sendJs.match(/const PROPOSAL = `([\s\S]*?)`;\n\nasync/);
const proposal = match[1];

async function main() {
  const tokenRes = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${env.WECHAT_CORP_ID}&corpsecret=${env.WECHAT_SECRET}`
  );
  const tokenData = await tokenRes.json();

  const user = await prisma.user.findFirst({
    where: { name: process.argv[2] || '牟思敏', wechatUserId: { not: null } },
    select: { name: true, wechatUserId: true },
  });
  if (!user) { console.log('未找到'); process.exit(1); }

  const res = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${tokenData.access_token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        touser: user.wechatUserId,
        msgtype: 'markdown',
        agentid: Number(env.WECHAT_AGENT_ID),
        markdown: { content: proposal },
      }),
    },
  );
  const data = await res.json();
  console.log(data.errcode === 0 ? `${user.name} 发送成功` : `失败: ${data.errmsg}`);
  await prisma.$disconnect();
}
main();
