-- AlterTable
ALTER TABLE "User" ADD COLUMN "wechatUserId" TEXT;

-- CreateTable
CREATE TABLE "Roster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shiftDate" DATETIME NOT NULL,
    "shiftType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Roster_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Roster_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HandoverNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rosterId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HandoverNote_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HandoverNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PushLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "rosterId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMsg" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PushLog_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ClockRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "photoKey" TEXT,
    "isAnomalous" BOOLEAN NOT NULL DEFAULT false,
    "rosterId" TEXT,
    "lateMinutes" INTEGER,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClockRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClockRecord_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ClockRecord" ("createdAt", "id", "isAnomalous", "photoKey", "type", "userId") SELECT "createdAt", "id", "isAnomalous", "photoKey", "type", "userId" FROM "ClockRecord";
DROP TABLE "ClockRecord";
ALTER TABLE "new_ClockRecord" RENAME TO "ClockRecord";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Roster_storeId_shiftDate_idx" ON "Roster"("storeId", "shiftDate");

-- CreateIndex
CREATE INDEX "Roster_userId_idx" ON "Roster"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Roster_userId_shiftDate_key" ON "Roster"("userId", "shiftDate");

-- CreateIndex
CREATE INDEX "HandoverNote_rosterId_idx" ON "HandoverNote"("rosterId");

-- CreateIndex
CREATE INDEX "PushLog_userId_createdAt_idx" ON "PushLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PushLog_rosterId_idx" ON "PushLog"("rosterId");
