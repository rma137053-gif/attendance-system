import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3003'),
  jwtSecret: process.env.JWT_SECRET || 'tag-system-secret-key-2026',
};
