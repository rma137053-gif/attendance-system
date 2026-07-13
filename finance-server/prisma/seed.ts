import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding finance-system database...');

  // ── 门店 ──
  const store1 = await prisma.store.upsert({
    where: { id: 'store-01' },
    update: { name: '通灌路瑞伦' },
    create: { id: 'store-01', name: '通灌路瑞伦' },
  });
  const store2 = await prisma.store.upsert({
    where: { id: 'store-02' },
    update: { name: '海昌路瑞伦' },
    create: { id: 'store-02', name: '海昌路瑞伦' },
  });
  const store3 = await prisma.store.upsert({
    where: { id: 'store-03' },
    update: { name: '墟沟瑞伦' },
    create: { id: 'store-03', name: '墟沟瑞伦' },
  });
  console.log(`Stores: ${store1.name}, ${store2.name}, ${store3.name}`);

  // ── 管理员 ──
  const passwordHash = await bcrypt.hash('password123', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash,
      name: '管理员',
      role: 'ADMIN',
      status: 'ACTIVE',
      storeId: null,
    },
  });
  console.log(`Admin: ${admin.username} / password123`);

  // ── 系统分类 ──
  const categories: { name: string; type: string; sortOrder: number; icon: string }[] = [
    // 收入分类
    { name: '日营业收入', type: 'INCOME', sortOrder: 1, icon: '💰' },
    { name: '押金收入', type: 'INCOME', sortOrder: 2, icon: '🔒' },
    { name: '退款收入', type: 'INCOME', sortOrder: 3, icon: '↩️' },
    { name: '其他收入', type: 'INCOME', sortOrder: 99, icon: '📥' },

    // 支出分类
    { name: '房租', type: 'EXPENSE', sortOrder: 1, icon: '🏠' },
    { name: '水电费', type: 'EXPENSE', sortOrder: 2, icon: '💡' },
    { name: '工资', type: 'EXPENSE', sortOrder: 3, icon: '💼' },
    { name: '物料采购', type: 'EXPENSE', sortOrder: 4, icon: '📦' },
    { name: '库存采购', type: 'EXPENSE', sortOrder: 5, icon: '👗' },
    { name: '维修费', type: 'EXPENSE', sortOrder: 6, icon: '🔧' },
    { name: '运费', type: 'EXPENSE', sortOrder: 7, icon: '🚚' },
    { name: '税费', type: 'EXPENSE', sortOrder: 8, icon: '📋' },
    { name: '其他支出', type: 'EXPENSE', sortOrder: 99, icon: '📤' },
  ];

  for (const cat of categories) {
    await prisma.financeCategory.upsert({
      where: {
        id: `sys-${cat.type}-${cat.name}`,
      },
      update: { name: cat.name, sortOrder: cat.sortOrder, icon: cat.icon },
      create: {
        id: `sys-${cat.type}-${cat.name}`,
        name: cat.name,
        type: cat.type,
        icon: cat.icon,
        sortOrder: cat.sortOrder,
        isSystem: true,
        storeId: null, // shared across all stores
      },
    });
  }
  console.log(`Categories: ${categories.length} pre-seeded`);

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
