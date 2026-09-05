-- CreateTable
CREATE TABLE "DailySchedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startHour" INTEGER NOT NULL DEFAULT 8,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 120,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailySchedule_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DailySchedule" ADD CONSTRAINT "DailySchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySchedule" ADD CONSTRAINT "DailySchedule_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
