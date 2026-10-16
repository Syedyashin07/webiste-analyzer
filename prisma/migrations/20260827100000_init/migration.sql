-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('QUEUED', 'INITIALIZING', 'CRAWLING', 'SCANNING', 'ANALYZING', 'VERIFYING', 'GENERATING_REPORT', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ViewportMode" AS ENUM ('DESKTOP', 'TABLET', 'MOBILE', 'ALL');

-- CreateEnum
CREATE TYPE "PageStatus" AS ENUM ('DISCOVERED', 'QUEUED', 'SCANNING', 'SCANNED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('P0', 'P1', 'P2', 'P3');

-- CreateEnum
CREATE TYPE "BugStatus" AS ENUM ('OPEN', 'CONFIRMED', 'FALSE_POSITIVE', 'RESOLVED', 'IGNORED', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "BugCategory" AS ENUM ('FUNCTIONAL', 'VISUAL', 'ACCESSIBILITY', 'SEO', 'PERFORMANCE', 'SECURITY', 'TECHNICAL', 'BROKEN_LINK', 'BROKEN_IMAGE', 'JAVASCRIPT', 'NETWORK');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('HTML', 'PDF', 'XLSX', 'JSON');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultMaxPages" INTEGER NOT NULL DEFAULT 100,
    "defaultMaxDepth" INTEGER NOT NULL DEFAULT 5,
    "timeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "browser" TEXT NOT NULL DEFAULT 'chromium',
    "viewport" TEXT NOT NULL DEFAULT 'DESKTOP',
    "screenshotEnabled" BOOLEAN NOT NULL DEFAULT true,
    "videoEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "concurrency" INTEGER NOT NULL DEFAULT 3,
    "crawlDelayMs" INTEGER NOT NULL DEFAULT 250,
    "maxScanDurationMs" INTEGER NOT NULL DEFAULT 1800000,
    "maxScreenshotBytes" INTEGER NOT NULL DEFAULT 10485760,
    "respectRobotsTxt" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'QUEUED',
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "pagesDiscovered" INTEGER NOT NULL DEFAULT 0,
    "pagesScanned" INTEGER NOT NULL DEFAULT 0,
    "pagesFailed" INTEGER NOT NULL DEFAULT 0,
    "issuesFound" INTEGER NOT NULL DEFAULT 0,
    "confirmedBugs" INTEGER NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "overallScore" INTEGER,
    "performanceScore" INTEGER,
    "accessibilityScore" INTEGER,
    "seoScore" INTEGER,
    "securityScore" INTEGER,
    "functionalScore" INTEGER,
    "visualScore" INTEGER,
    "technicalScore" INTEGER,
    "scoreBreakdown" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanConfiguration" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "maxPages" INTEGER NOT NULL DEFAULT 100,
    "maxDepth" INTEGER NOT NULL DEFAULT 5,
    "viewport" "ViewportMode" NOT NULL DEFAULT 'DESKTOP',
    "captureScreenshots" BOOLEAN NOT NULL DEFAULT true,
    "recordVideos" BOOLEAN NOT NULL DEFAULT true,
    "aiAnalysis" BOOLEAN NOT NULL DEFAULT true,
    "runFunctionalTests" BOOLEAN NOT NULL DEFAULT true,
    "runAccessibility" BOOLEAN NOT NULL DEFAULT true,
    "runPerformance" BOOLEAN NOT NULL DEFAULT true,
    "runSeo" BOOLEAN NOT NULL DEFAULT true,
    "runSecurity" BOOLEAN NOT NULL DEFAULT true,
    "timeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "crawlDelayMs" INTEGER NOT NULL DEFAULT 250,
    "concurrency" INTEGER NOT NULL DEFAULT 3,
    "respectRobotsTxt" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ScanConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "parentUrl" TEXT,
    "status" "PageStatus" NOT NULL DEFAULT 'DISCOVERED',
    "httpStatus" INTEGER,
    "responseTimeMs" INTEGER,
    "title" TEXT,
    "metaDescription" TEXT,
    "canonical" TEXT,
    "robotsMeta" TEXT,
    "language" TEXT,
    "htmlSize" INTEGER,
    "resourceCount" INTEGER,
    "viewport" TEXT,
    "redirectedFrom" TEXT,
    "headingsJson" JSONB,
    "cookiesJson" JSONB,
    "localStorageOk" BOOLEAN,
    "errorMessage" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scannedAt" TIMESTAMP(3),

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageLink" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "text" TEXT,
    "isInternal" BOOLEAN NOT NULL,
    "statusCode" INTEGER,
    "error" TEXT,
    "isBroken" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PageLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageImage" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "src" TEXT NOT NULL,
    "alt" TEXT,
    "statusCode" INTEGER,
    "naturalWidth" INTEGER,
    "naturalHeight" INTEGER,
    "isBroken" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,

    CONSTRAINT "PageImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageForm" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "action" TEXT,
    "method" TEXT,
    "fieldCount" INTEGER NOT NULL DEFAULT 0,
    "fieldsJson" JSONB NOT NULL,
    "hasSubmit" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PageForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageElement" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "selector" TEXT,
    "text" TEXT,
    "name" TEXT,
    "role" TEXT,
    "href" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "bounds" JSONB,

    CONSTRAINT "PageElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsoleError" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "pageId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsoleError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkError" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "pageId" TEXT,
    "requestUrl" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER,
    "resourceType" TEXT,
    "initiator" TEXT,
    "error" TEXT,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceMetric" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "ttfbMs" INTEGER,
    "domContentLoadedMs" INTEGER,
    "loadEventMs" INTEGER,
    "fcpMs" DOUBLE PRECISION,
    "lcpMs" DOUBLE PRECISION,
    "cls" DOUBLE PRECISION,
    "requestCount" INTEGER,
    "transferSize" INTEGER,
    "jsSize" INTEGER,
    "cssSize" INTEGER,
    "imageSize" INTEGER,
    "longTaskCount" INTEGER,
    "score" INTEGER,

    CONSTRAINT "PerformanceMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessibilityIssue" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "selector" TEXT,
    "fingerprint" TEXT NOT NULL,

    CONSTRAINT "AccessibilityIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SEOIssue" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,

    CONSTRAINT "SEOIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityIssue" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,

    CONSTRAINT "SecurityIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bug" (
    "id" TEXT NOT NULL,
    "bugNumber" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "BugCategory" NOT NULL,
    "severity" "Severity" NOT NULL,
    "priority" "Priority" NOT NULL,
    "status" "BugStatus" NOT NULL DEFAULT 'OPEN',
    "url" TEXT NOT NULL,
    "pageUrl" TEXT,
    "expected" TEXT,
    "actual" TEXT,
    "stepsToReproduce" TEXT,
    "rootCause" TEXT,
    "technicalDetails" JSONB,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "affectedUrls" JSONB NOT NULL,
    "browser" TEXT,
    "viewport" TEXT,
    "fingerprint" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "aiAnalysis" TEXT,
    "recommendedAction" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'rule',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bug_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BugEvidence" (
    "id" TEXT NOT NULL,
    "bugId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT,
    "mimeType" TEXT,
    "metadata" JSONB,
    "screenshotId" TEXT,
    "videoId" TEXT,
    "traceId" TEXT,

    CONSTRAINT "BugEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Screenshot" (
    "id" TEXT NOT NULL,
    "pageId" TEXT,
    "kind" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/png',
    "width" INTEGER,
    "height" INTEGER,
    "viewport" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Screenshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'video/webm',
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trace" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "format" "ReportFormat" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanEvent" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_userId_key" ON "AppSettings"("userId");

-- CreateIndex
CREATE INDEX "Scan_projectId_idx" ON "Scan"("projectId");

-- CreateIndex
CREATE INDEX "Scan_status_idx" ON "Scan"("status");

-- CreateIndex
CREATE INDEX "Scan_createdAt_idx" ON "Scan"("createdAt");

-- CreateIndex
CREATE INDEX "Scan_url_idx" ON "Scan"("url");

-- CreateIndex
CREATE INDEX "Scan_host_idx" ON "Scan"("host");

-- CreateIndex
CREATE UNIQUE INDEX "ScanConfiguration_scanId_key" ON "ScanConfiguration"("scanId");

-- CreateIndex
CREATE INDEX "Page_scanId_idx" ON "Page"("scanId");

-- CreateIndex
CREATE INDEX "Page_url_idx" ON "Page"("url");

-- CreateIndex
CREATE INDEX "Page_status_idx" ON "Page"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Page_scanId_normalizedUrl_key" ON "Page"("scanId", "normalizedUrl");

-- CreateIndex
CREATE INDEX "PageLink_pageId_idx" ON "PageLink"("pageId");

-- CreateIndex
CREATE INDEX "PageLink_isBroken_idx" ON "PageLink"("isBroken");

-- CreateIndex
CREATE INDEX "PageImage_pageId_idx" ON "PageImage"("pageId");

-- CreateIndex
CREATE INDEX "PageImage_isBroken_idx" ON "PageImage"("isBroken");

-- CreateIndex
CREATE INDEX "PageForm_pageId_idx" ON "PageForm"("pageId");

-- CreateIndex
CREATE INDEX "PageElement_pageId_idx" ON "PageElement"("pageId");

-- CreateIndex
CREATE INDEX "ConsoleError_scanId_idx" ON "ConsoleError"("scanId");

-- CreateIndex
CREATE INDEX "ConsoleError_pageId_idx" ON "ConsoleError"("pageId");

-- CreateIndex
CREATE INDEX "ConsoleError_fingerprint_idx" ON "ConsoleError"("fingerprint");

-- CreateIndex
CREATE INDEX "NetworkError_scanId_idx" ON "NetworkError"("scanId");

-- CreateIndex
CREATE INDEX "NetworkError_pageId_idx" ON "NetworkError"("pageId");

-- CreateIndex
CREATE INDEX "NetworkError_fingerprint_idx" ON "NetworkError"("fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceMetric_pageId_key" ON "PerformanceMetric"("pageId");

-- CreateIndex
CREATE INDEX "AccessibilityIssue_pageId_idx" ON "AccessibilityIssue"("pageId");

-- CreateIndex
CREATE INDEX "AccessibilityIssue_fingerprint_idx" ON "AccessibilityIssue"("fingerprint");

-- CreateIndex
CREATE INDEX "SEOIssue_pageId_idx" ON "SEOIssue"("pageId");

-- CreateIndex
CREATE INDEX "SEOIssue_fingerprint_idx" ON "SEOIssue"("fingerprint");

-- CreateIndex
CREATE INDEX "SecurityIssue_pageId_idx" ON "SecurityIssue"("pageId");

-- CreateIndex
CREATE INDEX "SecurityIssue_fingerprint_idx" ON "SecurityIssue"("fingerprint");

-- CreateIndex
CREATE INDEX "Bug_scanId_idx" ON "Bug"("scanId");

-- CreateIndex
CREATE INDEX "Bug_fingerprint_idx" ON "Bug"("fingerprint");

-- CreateIndex
CREATE INDEX "Bug_status_idx" ON "Bug"("status");

-- CreateIndex
CREATE INDEX "Bug_severity_idx" ON "Bug"("severity");

-- CreateIndex
CREATE INDEX "Bug_category_idx" ON "Bug"("category");

-- CreateIndex
CREATE INDEX "Bug_url_idx" ON "Bug"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Bug_scanId_fingerprint_key" ON "Bug"("scanId", "fingerprint");

-- CreateIndex
CREATE INDEX "BugEvidence_bugId_idx" ON "BugEvidence"("bugId");

-- CreateIndex
CREATE INDEX "Screenshot_pageId_idx" ON "Screenshot"("pageId");

-- CreateIndex
CREATE INDEX "Report_scanId_idx" ON "Report"("scanId");

-- CreateIndex
CREATE INDEX "ScanEvent_scanId_idx" ON "ScanEvent"("scanId");

-- CreateIndex
CREATE INDEX "ScanEvent_createdAt_idx" ON "ScanEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppSettings" ADD CONSTRAINT "AppSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanConfiguration" ADD CONSTRAINT "ScanConfiguration_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageLink" ADD CONSTRAINT "PageLink_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageImage" ADD CONSTRAINT "PageImage_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageForm" ADD CONSTRAINT "PageForm_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageElement" ADD CONSTRAINT "PageElement_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsoleError" ADD CONSTRAINT "ConsoleError_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsoleError" ADD CONSTRAINT "ConsoleError_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkError" ADD CONSTRAINT "NetworkError_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkError" ADD CONSTRAINT "NetworkError_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceMetric" ADD CONSTRAINT "PerformanceMetric_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessibilityIssue" ADD CONSTRAINT "AccessibilityIssue_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SEOIssue" ADD CONSTRAINT "SEOIssue_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityIssue" ADD CONSTRAINT "SecurityIssue_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bug" ADD CONSTRAINT "Bug_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugEvidence" ADD CONSTRAINT "BugEvidence_bugId_fkey" FOREIGN KEY ("bugId") REFERENCES "Bug"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugEvidence" ADD CONSTRAINT "BugEvidence_screenshotId_fkey" FOREIGN KEY ("screenshotId") REFERENCES "Screenshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugEvidence" ADD CONSTRAINT "BugEvidence_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugEvidence" ADD CONSTRAINT "BugEvidence_traceId_fkey" FOREIGN KEY ("traceId") REFERENCES "Trace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Screenshot" ADD CONSTRAINT "Screenshot_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanEvent" ADD CONSTRAINT "ScanEvent_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

