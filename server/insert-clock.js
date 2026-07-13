const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();
const uuid = () => crypto.randomUUID();

const records = [
  { userId: '53b0bc48-8b5d-4ce3-bb64-eff261527f11', storeId: 'a83d69b4-d2e3-4916-bd71-1c320745087c', type: 'CLOCK_IN',  time: '2026-07-01T00:55:00.000Z', name: '刘静' },
  { userId: '53b0bc48-8b5d-4ce3-bb64-eff261527f11', storeId: 'a83d69b4-d2e3-4916-bd71-1c320745087c', type: 'CLOCK_OUT', time: '2026-07-01T11:30:00.000Z', name: '刘静' },
  { userId: '22dcf1e4-4a84-436e-8948-b9538dc22619', storeId: 'f6a13053-ddcd-4857-8859-3a6faa2648d2', type: 'CLOCK_IN',  time: '2026-07-01T00:55:00.000Z', name: '蒋艳滨' },
  { userId: '22dcf1e4-4a84-436e-8948-b9538dc22619', storeId: 'f6a13053-ddcd-4857-8859-3a6faa2648d2', type: 'CLOCK_OUT', time: '2026-07-01T11:30:00.000Z', name: '蒋艳滨' },
  { userId: 'bd420982-7571-4d8f-97a9-5f6843cd88fd', storeId: 'a83d69b4-d2e3-4916-bd71-1c320745087c', type: 'CLOCK_IN',  time: '2026-07-01T00:10:00.000Z', name: '田加美' },
  { userId: 'bd420982-7571-4d8f-97a9-5f6843cd88fd', storeId: 'a83d69b4-d2e3-4916-bd71-1c320745087c', type: 'CLOCK_OUT', time: '2026-07-01T04:30:00.000Z', name: '田加美' },
  { userId: 'ac7c90fd-ccb9-4261-8891-2effbc77cdb3', storeId: '35b9110b-a892-4af1-812c-637bc11c03a5', type: 'CLOCK_IN',  time: '2026-07-01T00:10:00.000Z', name: '夏淑利' },
  { userId: 'ac7c90fd-ccb9-4261-8891-2effbc77cdb3', storeId: '35b9110b-a892-4af1-812c-637bc11c03a5', type: 'CLOCK_OUT', time: '2026-07-01T04:30:00.000Z', name: '夏淑利' },
  { userId: '071f0d92-d3ab-4889-bc5a-eb35ddf638b7', storeId: 'f6a13053-ddcd-4857-8859-3a6faa2648d2', type: 'CLOCK_IN',  time: '2026-07-01T00:10:00.000Z', name: '穆雪琴' },
  { userId: '071f0d92-d3ab-4889-bc5a-eb35ddf638b7', storeId: 'f6a13053-ddcd-4857-8859-3a6faa2648d2', type: 'CLOCK_OUT', time: '2026-07-01T04:30:00.000Z', name: '穆雪琴' },
  { userId: '90a2dffc-3676-427c-8a0a-06bd8432ac19', storeId: 'a83d69b4-d2e3-4916-bd71-1c320745087c', type: 'CLOCK_IN',  time: '2026-07-01T04:25:00.000Z', name: '王海云' },
  { userId: '90a2dffc-3676-427c-8a0a-06bd8432ac19', storeId: 'a83d69b4-d2e3-4916-bd71-1c320745087c', type: 'CLOCK_OUT', time: '2026-07-01T13:00:00.000Z', name: '王海云' },
  { userId: '0e8a3953-0c4a-4a96-8641-6df6bb568ace', storeId: '35b9110b-a892-4af1-812c-637bc11c03a5', type: 'CLOCK_IN',  time: '2026-07-01T04:25:00.000Z', name: '邬灵芝' },
  { userId: '0e8a3953-0c4a-4a96-8641-6df6bb568ace', storeId: '35b9110b-a892-4af1-812c-637bc11c03a5', type: 'CLOCK_OUT', time: '2026-07-01T13:00:00.000Z', name: '邬灵芝' },
  { userId: '8f86ca91-779c-4505-8354-36d2fdc6b2dd', storeId: 'f6a13053-ddcd-4857-8859-3a6faa2648d2', type: 'CLOCK_IN',  time: '2026-07-01T04:25:00.000Z', name: '董金艳' },
  { userId: '8f86ca91-779c-4505-8354-36d2fdc6b2dd', storeId: 'f6a13053-ddcd-4857-8859-3a6faa2648d2', type: 'CLOCK_OUT', time: '2026-07-01T13:00:00.000Z', name: '董金艳' },
];

async function main() {
  let count = 0;
  for (const r of records) {
    await prisma.clockRecord.create({
      data: {
        id: uuid(),
        userId: r.userId,
        storeId: r.storeId,
        type: r.type,
        isAnomalous: false,
        lateMinutes: 0,
        createdAt: new Date(r.time),
      },
    });
    count++;
  }
  console.log('Created ' + count + ' records');
  await prisma.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
