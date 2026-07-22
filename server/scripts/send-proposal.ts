/**
 * 发送排班薪酬改革方案给指定企微用户
 * 用法: cd /app/server && npx tsx scripts/send-proposal.ts
 * 自包含脚本，不依赖项目源文件
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** 获取企业微信 access_token */
async function getToken(corpId: string, secret: string): Promise<string> {
  const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpId}&corpsecret=${secret}`;
  const res = await fetch(url);
  const data = await res.json() as any;
  if (data.errcode !== 0) throw new Error(`获取token失败: ${data.errmsg}`);
  return data.access_token;
}

/** 发送 markdown 消息 */
async function sendMarkdown(
  token: string,
  agentId: string,
  touser: string,
  content: string,
): Promise<void> {
  const res = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        touser,
        msgtype: 'markdown',
        agentid: Number(agentId),
        markdown: { content },
      }),
    },
  );
  const data = await res.json() as any;
  if (data.errcode !== 0) throw new Error(data.errmsg);
}

const PROPOSAL = `# 排班与薪酬改革方案
> 提案日期：2026年5月18日

## 一、当前痛点

- **全天班排班不合理**：9:00-19:00中间夹2小时死档，店长"被占用时间"高达299小时/月
- **晚高峰人手不足**：19:00-20:30只有下午半天班1人，客流最高峰反而最缺人
- **半天班底薪低于法定最低工资**：2200元/月，连云港2026年最低工资标准2430元，存在合规风险
- **提成平均主义**：店长与员工平分提成，缺乏管店动力
- **加班缺乏约束**：排班不合理导致频繁加班，成本失控

## 二、全天班（店长）改革

### 排班时间优化
- 现行：9:00-19:00（含2h空档），8h/天，208h/30天，底薪3600，时薪17.3元
- <font color="info">改革后：**10:00-13:30 / 15:30-20:00**，8h/天，底薪不变</font>

**为什么这么排：**
10:00到岗后立刻覆盖午高峰期(11:30-13:00)，13:30-15:30真正休息2小时，15:30回来覆盖晚高峰(17:00-20:00)。全天最忙的两个时段店长都在，晚高峰从1人变2人。

### 休息日规则
- 可选休息日：仅限**周一~周四**（周五六日客流最大，店长必在）
- 放弃休息：按17.3元×8h=**138.4元/天**，不可累积到下周或下月

### 加班规则
- 日工时**8小时封顶**，超时须向领导说明理由
- 加班费：17.3元/小时
- 宽限期：**≤15分钟不视为加班**，避免故意磨蹭

## 三、半天班（员工）改革

### 底薪调整
- 现行：2200元，187.5h/月，时薪11.73元
- <font color="warning">改革后：**2500元**（+300），时薪**13.33元**</font>

### 为什么要调
连云港人社局规定2026年最低工资**2430元/月**。当前2200元低于法定标准，存在劳动监察处罚和仲裁风险。这不是福利，是法律义务。

即使涨到2500元，时薪13.33元仍远低于店长17.3元，层级合理。
> 成本：每店每月+600元（2人×300），三店合计**+1,800元/月**

## 四、提成分配改革

店长提成33.3% → **40%**（+6.7%）
半天班员工提成33.3% → **30%**（-3.3%）

**为什么这么调：**
- 店长多拿提成，更有动力管店冲业绩，与公司利益绑定
- 半天班底薪已涨300，提成微降3.3%作为部分对冲，月到手实际增加
- 提成总比例不变，公司不增加支出

### 实际算账（假设月业绩10万，提成2%=2000元）
- 店长：底薪不变，提成667→800(**+133**)，合计**+133/月**
- 半天班员工：底薪2200→2500(**+300**)，提成667→600(-67)，合计**+233/月**
- 三个人月收入都涨了，公司只多出底薪1800元/月

## 五、成本汇总

1. 半天班底薪上调：+1,800元/月（三店×2人×300元）
2. 全天班底薪：不变
3. 提成支出：不变（仅内部分配调整）
4. <font color="info">**固定成本净增：+1,800元/月（+21,600元/年）**</font>

## 六、核心价值

- **法律合规**：底薪2500>连云港最低工资2430，消除处罚风险
- **客流覆盖**：店长10:00-20:00覆盖午晚双高峰，晚高峰1人变2人
- **成本可控**：三店合计仅增加1800元/月固定成本
- **激励对齐**：店长提成40%，业绩越好拿得越多
- **加班治理**：8h封顶+说明理由，杜绝无效加班
- **员工稳定**：半天班涨薪+合规保障，减少流失`;

async function main() {
  const targetNames = ['麻建平', '姚海霞'];
  const corpId = process.env.WECHAT_CORP_ID;
  const secret = process.env.WECHAT_SECRET;
  const agentId = process.env.WECHAT_AGENT_ID;

  if (!corpId || !secret || !agentId) {
    console.error('缺少环境变量: WECHAT_CORP_ID / WECHAT_SECRET / WECHAT_AGENT_ID');
    process.exit(1);
  }

  console.log('获取 access_token...');
  const token = await getToken(corpId, secret);
  console.log('已获取\n');

  for (const name of targetNames) {
    const user = await prisma.user.findFirst({
      where: { name, wechatUserId: { not: null } },
      select: { name: true, wechatUserId: true },
    });

    if (!user || !user.wechatUserId) {
      console.log(`${name}: 未绑定企微，跳过`);
      continue;
    }

    try {
      await sendMarkdown(token, agentId, user.wechatUserId, PROPOSAL);
      console.log(`${name} (${user.wechatUserId}): 发送成功 ✓`);
    } catch (err: any) {
      console.log(`${name} (${user.wechatUserId}): 失败 - ${err.message}`);
    }
  }

  await prisma.$disconnect();
}

main();
