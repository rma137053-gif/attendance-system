-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HandoverNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rosterId" TEXT NOT NULL,
    "authorId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HandoverNote_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HandoverNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_HandoverNote" ("authorId", "content", "createdAt", "id", "rosterId") SELECT "authorId", "content", "createdAt", "id", "rosterId" FROM "HandoverNote";
DROP TABLE "HandoverNote";
ALTER TABLE "new_HandoverNote" RENAME TO "HandoverNote";
CREATE INDEX "HandoverNote_rosterId_idx" ON "HandoverNote"("rosterId");
CREATE TABLE "new_PushLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "rosterId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMsg" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PushLog_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PushLog" ("createdAt", "errorMsg", "id", "rosterId", "status", "type", "userId") SELECT "createdAt", "errorMsg", "id", "rosterId", "status", "type", "userId" FROM "PushLog";
DROP TABLE "PushLog";
ALTER TABLE "new_PushLog" RENAME TO "PushLog";
CREATE INDEX "PushLog_userId_createdAt_idx" ON "PushLog"("userId", "createdAt");
CREATE INDEX "PushLog_rosterId_idx" ON "PushLog"("rosterId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
