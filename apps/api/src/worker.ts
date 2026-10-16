import "@qa-scanner/browser/playwright-env";
import { Worker, UnrecoverableError } from "bullmq";
import { QUEUE_NAMES, createLogger } from "@qa-scanner/shared";
import { missingPlaywrightChromiumMessage } from "@qa-scanner/browser";
import { env } from "./config.js";
import { prisma } from "./lib/prisma.js";
import { createScanQueue } from "./lib/queue.js";
import { recoverScanQueue } from "./lib/queue-health.js";
import { createRedis, assertRedis } from "./lib/redis.js";
import { emitScanEvent } from "./lib/events.js";
import { mapScanJobError } from "./lib/scan-error.js";
import { runScanPipeline } from "./workers/pipeline.js";

const log = createLogger("worker");

async function main() {
  const redis = createRedis("worker");
  await assertRedis(redis);
  const queue = createScanQueue();
  await recoverScanQueue(queue);
  const playwrightMissing = missingPlaywrightChromiumMessage();
  if (playwrightMissing) {
    log.error({ hint: playwrightMissing }, "Playwright browser is not installed");
  }

  const worker = new Worker(
    QUEUE_NAMES.SCANS,
    async (job) => {
      const scanId = job.data.scanId as string;
      log.info({ scanId }, "job started");
      try {
        if (playwrightMissing) {
          throw new UnrecoverableError(playwrightMissing);
        }
        await runScanPipeline(scanId, redis, {
          loginUsername: job.data.loginUsername,
          loginPassword: job.data.loginPassword,
          loginUrl: job.data.loginUrl,
        });
      } catch (error) {
        const mapped = mapScanJobError(error);
        const cancelled = mapped.name === "CancelledError";
        if (cancelled) {
          await prisma.scan.updateMany({
            where: { id: scanId },
            data: { status: "CANCELLED", cancelledAt: new Date() },
          });
          await emitScanEvent(redis, scanId, "scan.cancelled", "Scan cancelled");
          return;
        }
        await prisma.scan.updateMany({
          where: { id: scanId },
          data: { status: "FAILED", errorMessage: mapped.message, completedAt: new Date() },
        });
        await emitScanEvent(redis, scanId, "scan.failed", mapped.message);
        log.error({ scanId, error: mapped.message }, "scan failed");
        throw mapped;
      }
    },
    {
      connection: { url: env.REDIS_URL },
      concurrency: 2,
      lockDuration: 30_000,
      lockRenewTime: 10_000,
      stalledInterval: 15_000,
      maxStalledCount: 2,
    },
  );

  worker.on("completed", (job) => {
    log.info({ scanId: job.data?.scanId }, "job completed");
  });
  worker.on("failed", (job, error) => {
    log.error({ scanId: job?.data?.scanId, error: error.message }, "job failed");
  });
  worker.on("stalled", (jobId) => {
    log.warn({ jobId }, "job stalled; worker will retry");
  });

  const shutdown = async () => {
    await worker.close(true);
    await queue.close();
    redis.disconnect();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  log.info("Worker ready");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
