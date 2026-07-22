import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPwd = await bcrypt.hash('admin123', 10);
  const accountantPwd = await bcrypt.hash('accountant123', 10);

  await prisma.tagUser.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash: adminPwd, role: 'ADMIN' },
  });

  await prisma.tagUser.upsert({
    where: { username: '会计' },
    update: {},
    create: { username: '会计', passwordHash: accountantPwd, role: 'ACCOUNTANT' },
  });

  console.log('Seed done: admin + 会计');
  await prisma.$disconnect();
}

main().catch(console.error).finally(() => prisma.$disconnect());
