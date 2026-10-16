-- AlterTable
ALTER TABLE "ScanConfiguration" ADD COLUMN "dataSeed" INTEGER;
ALTER TABLE "ScanConfiguration" ADD COLUMN "authorizedTest" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "selector" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "expected" TEXT,
    "observed" TEXT,
    "redactedInput" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowDatum" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowDatum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowGraph" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowGraph_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowStep_scanId_idx" ON "WorkflowStep"("scanId");
CREATE INDEX "WorkflowStep_status_idx" ON "WorkflowStep"("status");
CREATE UNIQUE INDEX "WorkflowStep_scanId_fingerprint_key" ON "WorkflowStep"("scanId", "fingerprint");
CREATE INDEX "WorkflowDatum_scanId_idx" ON "WorkflowDatum"("scanId");
CREATE UNIQUE INDEX "WorkflowDatum_scanId_entityKey_fieldKey_key" ON "WorkflowDatum"("scanId", "entityKey", "fieldKey");
CREATE UNIQUE INDEX "WorkflowGraph_scanId_key" ON "WorkflowGraph"("scanId");

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowDatum" ADD CONSTRAINT "WorkflowDatum_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowGraph" ADD CONSTRAINT "WorkflowGraph_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
