import { Router } from 'express';
import crypto from 'crypto';
import { authMiddleware } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import {
  listDepartmentUsers,
  matchWechatUsers,
  decryptCallbackMsg,
  encryptCallbackMsg,
} from '../services/wechat.service';
import { handleBotMessage } from '../services/chatbot.service';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';

const router = Router();
const prisma = new PrismaClient();

function sha1(data: string): string {
  return crypto.createHash('sha1').update(data, 'utf8').digest('hex');
}

/** 解密企业微信回调的 echostr */
function decryptEchostr(encodingAESKey: string, encrypted: string): string {
  // EncodingAESKey = base64(AESKey) — 43 chars → 32 bytes
  const aesKey = Buffer.from(encodingAESKey + '=', 'base64');
  const iv = aesKey.subarray(0, 16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
  decipher.setAutoPadding(false);
  const encryptedBuf = Buffer.from(encrypted, 'base64');
  let decrypted = Buffer.concat([decipher.update(encryptedBuf), decipher.final()]);
  // 格式: 16 bytes random + 4 bytes msg_len(big-endian) + message + CorpID
  const msgLen = decrypted.readUInt32BE(16);
  return decrypted.subarray(20, 20 + msgLen).toString('utf8');
}

/**
 * GET /api/wechat/users
 * 获取企业微信通讯录成员列表（用于手动绑定）
 */
router.get('/users', authMiddleware, requireAdmin, async (_req, res, next) => {
  try {
    if (!config.wechat.enabled) {
      return res.status(400).json({ error: '企业微信推送未启用' });
    }
    const users = await listDepartmentUsers();
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/wechat/sync
 * 按姓名自动匹配：企业微信用户 <-> 系统用户
 */
router.post('/sync', authMiddleware, requireAdmin, async (_req, res, next) => {
  try {
    if (!config.wechat.enabled) {
      return res.status(400).json({ error: '企业微信推送未启用' });
    }
    const result = await matchWechatUsers();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/wechat/callback
 * 企业微信回调 URL 验证（设置接收消息服务器时调用）
 */
router.get('/callback', (req, res) => {
  const { msg_signature, timestamp, nonce, echostr } = req.query;
  const token = config.wechat.token;

  if (!token || !config.wechat.encodingAESKey) {
    return res.status(500).send('企业微信未配置 Token/AESKey');
  }

  if (!msg_signature || !timestamp || !nonce || !echostr) {
    return res.status(400).send('缺少参数');
  }

  // 1. 校验签名: SHA1(sort(token, timestamp, nonce, echostr))
  const tmpArr = [token, timestamp as string, nonce as string, echostr as string].sort();
  const signature = sha1(tmpArr.join(''));

  if (signature !== msg_signature) {
    console.log('[WeChat] 回调签名验证失败');
    return res.status(403).send('签名验证失败');
  }

  // 2. 解密 echostr
  try {
    const decrypted = decryptEchostr(config.wechat.encodingAESKey, echostr as string);
    console.log('[WeChat] 回调 URL 验证成功');
    res.send(decrypted);
  } catch (err: any) {
    console.error('[WeChat] 解密 echostr 失败:', err.message);
    res.status(500).send('解密失败');
  }
});

/**
 * POST /api/wechat/callback
 * 接收企业微信消息回调（用户发消息 → 自动回复本周排班）
 */
router.post('/callback', async (req, res) => {
  const { msg_signature, timestamp, nonce } = req.query;
  const token = config.wechat.token;
  const aesKey = config.wechat.encodingAESKey;
  const corpId = config.wechat.corpId;

  if (!token || !aesKey || !corpId) {
    console.error('[WeChat] 企业微信未完整配置');
    return res.status(500).send('配置不完整');
  }

  if (!msg_signature || !timestamp || !nonce) {
    return res.status(400).send('缺少参数');
  }

  const xmlBody = req.body as string;
  if (!xmlBody) {
    return res.status(400).send('缺少消息体');
  }

  // 1. 提取 Encrypt 字段
  const encMatch = xmlBody.match(/<Encrypt>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/Encrypt>/);
  if (!encMatch) {
    console.error('[WeChat] XML 中未找到 Encrypt 字段:', xmlBody.substring(0, 200));
    return res.status(400).send('无效的消息格式');
  }
  const encrypt = encMatch[1];

  // 2. 校验签名: SHA1(sort(token, timestamp, nonce, encrypt))
  const tmpArr = [token, timestamp as string, nonce as string, encrypt].sort();
  const signature = sha1(tmpArr.join(''));

  if (signature !== msg_signature) {
    console.log('[WeChat] 消息签名验证失败');
    return res.status(403).send('签名验证失败');
  }

  // 3. 解密消息
  let decryptedXml: string;
  try {
    decryptedXml = decryptCallbackMsg(aesKey, encrypt);
  } catch (err: any) {
    console.error('[WeChat] 消息解密失败:', err.message);
    return res.status(500).send('解密失败');
  }

  console.log('[WeChat] 收到消息:', decryptedXml.substring(0, 300));

  // 4. 提取 FromUserName（发送者）和 Content
  const fromMatch = decryptedXml.match(/<FromUserName>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/FromUserName>/);
  const contentMatch = decryptedXml.match(/<Content>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/Content>/);
  const msgTypeMatch = decryptedXml.match(/<MsgType>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/MsgType>/);

  const fromUser = fromMatch?.[1] || '';
  const content = contentMatch?.[1] || '';
  const msgType = msgTypeMatch?.[1] || 'text';

  // 5. 仅处理文本消息
  if (msgType !== 'text' || !fromUser) {
    console.log(`[WeChat] 忽略非文本消息: msgType=${msgType}`);
    res.send('success'); // 返回 success 让企业微信不重试
    return;
  }

  console.log(`[WeChat] 用户 ${fromUser} 发送: ${content}`);

  // 6. 交给对话机器人处理
  const replyContent = await handleBotMessage(fromUser, content);

  // 7. 构造回复 XML
  const replyXml = [
    '<xml>',
    `<ToUserName><![CDATA[${fromUser}]]></ToUserName>`,
    `<FromUserName><![CDATA[${corpId}]]></FromUserName>`,
    `<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>`,
    '<MsgType><![CDATA[text]]></MsgType>',
    `<Content><![CDATA[${replyContent}]]></Content>`,
    '</xml>',
  ].join('');

  // 8. 加密回复
  const replyEncrypt = encryptCallbackMsg(aesKey, replyXml, corpId);
  const replyNonce = crypto.randomBytes(8).toString('hex');
  const replyTs = String(Math.floor(Date.now() / 1000));
  const replySigArr = [token, replyTs, replyNonce, replyEncrypt].sort();
  const replySig = sha1(replySigArr.join(''));

  // 9. 返回加密 XML
  const replyBody = [
    '<xml>',
    `<Encrypt><![CDATA[${replyEncrypt}]]></Encrypt>`,
    `<MsgSignature><![CDATA[${replySig}]]></MsgSignature>`,
    `<TimeStamp>${replyTs}</TimeStamp>`,
    `<Nonce><![CDATA[${replyNonce}]]></Nonce>`,
    '</xml>',
  ].join('');

  console.log(`[WeChat] 已回复排班 -> ${fromUser}`);
  res.type('application/xml').send(replyBody);
});

export default router;
