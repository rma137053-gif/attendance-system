import path from 'path';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  uploadDir: path.resolve(process.env.UPLOAD_DIR || './uploads/photos'),
  storageType: (process.env.STORAGE_TYPE || 'local') as 'local' | 's3',
  s3: {
    endpoint: process.env.S3_ENDPOINT || '',
    bucket: process.env.S3_BUCKET || '',
    region: process.env.S3_REGION || '',
    accessKey: process.env.S3_ACCESS_KEY || '',
    secretKey: process.env.S3_SECRET_KEY || '',
  },
  wechat: {
    webhookUrl: process.env.WECHAT_WEBHOOK_URL || '',
    enabled: process.env.WECHAT_PUSH_ENABLED === 'true',
    corpId: process.env.WECHAT_CORP_ID || '',
    agentId: process.env.WECHAT_AGENT_ID || '',
    secret: process.env.WECHAT_SECRET || '',
    token: process.env.WECHAT_TOKEN || '',
    encodingAESKey: process.env.WECHAT_ENCODING_AESKEY || '',
  },
};
