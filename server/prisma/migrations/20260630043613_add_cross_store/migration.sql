-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "crossStore" BOOLEAN NOT NULL DEFAULT false,
    "pin" TEXT,
    "storeId" TEXT,
    "wechatUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "passwordHash", "pin", "role", "status", "storeId", "updatedAt", "wechatUserId") SELECT "createdAt", "email", "id", "name", "passwordHash", "pin", "role", "status", "storeId", "updatedAt", "wechatUserId" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_wechatUserId_idx" ON "User"("wechatUserId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
