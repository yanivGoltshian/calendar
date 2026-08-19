-- AlterEnum
ALTER TYPE "CampaignStatus" ADD VALUE 'SCHEDULED';

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "scheduledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MessageLog" ADD COLUMN     "address" TEXT,
ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'sms',
ALTER COLUMN "phone" DROP NOT NULL;
