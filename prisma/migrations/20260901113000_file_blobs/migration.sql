-- Store screenshots, videos, traces, and reports as PostgreSQL BYTEA.
-- Existing disk files are imported on first download, then the disk copy can be removed.

CREATE TABLE "FileBlob" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileBlob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FileBlob_storageKey_key" ON "FileBlob"("storageKey");
