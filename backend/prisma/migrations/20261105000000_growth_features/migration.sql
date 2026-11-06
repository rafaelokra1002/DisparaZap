-- AlterTable
ALTER TABLE "User" ADD COLUMN     "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoReplyMessage" TEXT,
ADD COLUMN     "lastWeeklyReportAt" TIMESTAMP(3),
ADD COLUMN     "smartGroupsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weeklyReportEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Ad" ADD COLUMN     "textVariants" JSONB;

-- AlterTable
ALTER TABLE "SendLog" ADD COLUMN     "trackingCode" TEXT,
ADD COLUMN     "variantIndex" INTEGER;

-- AlterTable
ALTER TABLE "Click" ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "sendLogId" TEXT,
ADD COLUMN     "variantIndex" INTEGER;

-- CreateTable
CREATE TABLE "PrivateContact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "name" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReplyAt" TIMESTAMP(3),

    CONSTRAINT "PrivateContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrivateContact_userId_contactId_key" ON "PrivateContact"("userId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "SendLog_trackingCode_key" ON "SendLog"("trackingCode");

-- CreateIndex
CREATE INDEX "SendLog_groupId_idx" ON "SendLog"("groupId");

-- CreateIndex
CREATE INDEX "Click_groupId_idx" ON "Click"("groupId");

-- AddForeignKey
ALTER TABLE "Click" ADD CONSTRAINT "Click_sendLogId_fkey" FOREIGN KEY ("sendLogId") REFERENCES "SendLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateContact" ADD CONSTRAINT "PrivateContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

