"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPush = sendPush;
const client_1 = require("@prisma/client");
const config_1 = require("../config");
const prisma = new client_1.PrismaClient();
async function sendPush(msg) {
    console.log(`[Push] 用户 ${msg.userId} [${msg.type}] ${msg.title} - ${msg.body}`);
    // 防止重复推送：同一用户+排班+类型在同一天只推一次
    if (msg.rosterId) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const existing = await prisma.pushLog.findFirst({
            where: {
                userId: msg.userId,
                rosterId: msg.rosterId,
                type: msg.type,
                status: 'SENT',
                createdAt: { gte: todayStart },
            },
        });
        if (existing) {
            console.log(`[Push] 跳过重复推送: userId=${msg.userId}, type=${msg.type}`);
            return { success: true };
        }
    }
    // 如果启用了企业微信，则调用真实 API
    if (config_1.config.wechat.enabled && config_1.config.wechat.webhookUrl) {
        try {
            const response = await fetch(config_1.config.wechat.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    msgtype: 'markdown',
                    markdown: {
                        content: `## ${msg.title}\n${msg.body}`,
                    },
                }),
            });
            if (!response.ok) {
                throw new Error(`微信推送失败: ${response.status} ${await response.text()}`);
            }
        }
        catch (err) {
            // 记录失败日志
            await prisma.pushLog.create({
                data: {
                    userId: msg.userId,
                    rosterId: msg.rosterId,
                    type: msg.type,
                    status: 'FAILED',
                    errorMsg: err.message,
                },
            });
            return { success: false, error: err.message };
        }
    }
    // 记录推送日志
    await prisma.pushLog.create({
        data: {
            userId: msg.userId,
            rosterId: msg.rosterId,
            type: msg.type,
            status: 'SENT',
        },
    });
    return { success: true };
}
