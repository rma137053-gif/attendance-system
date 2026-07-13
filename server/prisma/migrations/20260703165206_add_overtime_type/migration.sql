-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OvertimeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "hours" REAL NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'VOLUNTARY',
    "coveredUserId" TEXT,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OvertimeRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OvertimeRecord_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OvertimeRecord_coveredUserId_fkey" FOREIGN KEY ("coveredUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OvertimeRecord" ("createdAt", "date", "endTime", "hours", "id", "reason", "startTime", "storeId", "updatedAt", "userId") SELECT "createdAt", "date", "endTime", "hours", "id", "reason", "startTime", "storeId", "updatedAt", "userId" FROM "OvertimeRecord";
DROP TABLE "OvertimeRecord";
ALTER TABLE "new_OvertimeRecord" RENAME TO "OvertimeRecord";
CREATE INDEX "OvertimeRecord_storeId_date_idx" ON "OvertimeRecord"("storeId", "date");
CREATE INDEX "OvertimeRecord_userId_date_idx" ON "OvertimeRecord"("userId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
