-- CreateTable
CREATE TABLE "WeeklyRest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "restDate" DATETIME NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WeeklyRest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WeeklyRest_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WeeklyRest_storeId_weekStart_idx" ON "WeeklyRest"("storeId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyRest_userId_weekStart_key" ON "WeeklyRest"("userId", "weekStart");
