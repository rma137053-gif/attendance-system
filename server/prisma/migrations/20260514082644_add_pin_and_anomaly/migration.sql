-- AlterTable
ALTER TABLE "User" ADD COLUMN "pin" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ClockRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "photoKey" TEXT,
    "isAnomalous" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClockRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ClockRecord" ("createdAt", "id", "photoKey", "type", "userId") SELECT "createdAt", "id", "photoKey", "type", "userId" FROM "ClockRecord";
DROP TABLE "ClockRecord";
ALTER TABLE "new_ClockRecord" RENAME TO "ClockRecord";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
