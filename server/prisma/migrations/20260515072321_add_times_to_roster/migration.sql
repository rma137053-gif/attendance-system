/*
  Warnings:

  - You are about to drop the column `shiftType` on the `Roster` table. All the data in the column will be lost.
  - Added the required column `endTime` to the `Roster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTime` to the `Roster` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Roster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shiftDate" DATETIME NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Roster_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Roster_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Roster" ("createdAt", "id", "shiftDate", "storeId", "updatedAt", "userId") SELECT "createdAt", "id", "shiftDate", "storeId", "updatedAt", "userId" FROM "Roster";
DROP TABLE "Roster";
ALTER TABLE "new_Roster" RENAME TO "Roster";
CREATE INDEX "Roster_storeId_shiftDate_idx" ON "Roster"("storeId", "shiftDate");
CREATE INDEX "Roster_userId_idx" ON "Roster"("userId");
CREATE UNIQUE INDEX "Roster_userId_shiftDate_key" ON "Roster"("userId", "shiftDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
