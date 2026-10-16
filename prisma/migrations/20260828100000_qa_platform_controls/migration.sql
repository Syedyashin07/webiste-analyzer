-- AlterEnum
ALTER TYPE "ScanStatus" ADD VALUE 'PAUSED';

-- AlterEnum
ALTER TYPE "ReportFormat" ADD VALUE 'CSV';

-- AlterTable
ALTER TABLE "ScanConfiguration" ADD COLUMN "testMode" TEXT NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "ScanConfiguration" ADD COLUMN "browserEngine" TEXT NOT NULL DEFAULT 'chromium';

-- AlterTable
ALTER TABLE "PageElement" ADD COLUMN "risk" TEXT;
