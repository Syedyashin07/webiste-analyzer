import type { Queue } from "bullmq";
import { prisma } from "./prisma.js";
import { createLogger } from "@qa-scanner/shared";

const log = createLogger("queue-health");

const IN_FLIGHT = [
  "INITIALIZING",
  "CRAWLING",
  "SCANNING",
  "ANALYZING",
  "VERIFYING",
  "GENERATING_REPORT",
] as const;

async function failWaitingJob(queue: Queue, scanId: string, message: string): Promise<void> {
  await prisma.scan.update({
    where: { id: scanId },
    data: { status: "FAILED", errorMessage: message, completedAt: new Date() },
  });
  const job = await queue.getJob(scanId);
  if (job) {
    const state = await job.getState();
    if (state === "waiting" || state === "delayed" || state === "paused") {
      await job.remove();
    }
  }
}

export async function queuedWaitMessage(
  queue: Queue,
  scanId: string,
  status: string,
): Promise<string | null> {
  if (status !== "QUEUED") return null;
  const [waiting, active] = await Promise.all([queue.getWaiting(0, 200), queue.getActive()]);
  const index = waiting.findIndex((job) => String(job.id) === scanId);
  const running = active.length;
  if (running > 0 && index <= 0) {
    return `Waiting behind ${running} running scan${running === 1 ? "" : "s"}`;
  }
  if (index > 0) {
    return `Waiting in queue (${index} scan${index === 1 ? "" : "s"} ahead)`;
  }
  return "Queued — waiting for the worker to start this scan";
}

export async function recoverScanQueue(queue: Queue): Promise<void> {
  const staleActive = await queue.getActive();
  for (const job of staleActive) {
    try {
      await job.moveToWait();
      log.info({ jobId: job.id }, "moved stale active job back to wait");
    } catch (error) {
      log.warn(
        { jobId: job.id, error: error instanceof Error ? error.message : error },
        "could not unstick active job",
      );
    }
  }

  const [active, waiting, delayed] = await Promise.all([
    queue.getActive(),
    queue.getWaiting(0, 500),
    queue.getDelayed(0, 500),
  ]);
  const activeIds = new Set(active.map((job) => String(job.id)));
  const waitingIds = new Set(
    [...waiting, ...delayed].map((job) => String(job.id)),
  );

  const liveScans = await prisma.scan.findMany({
    where: { status: { in: [...IN_FLIGHT, "QUEUED"] } },
    select: { id: true, url: true, status: true, createdAt: true, pagesScanned: true, progress: true },
  });

  for (const scan of liveScans) {
    const hasActive = activeIds.has(scan.id);
    const hasWaiting = waitingIds.has(scan.id);
    if ((IN_FLIGHT as readonly string[]).includes(scan.status) && !hasActive) {
      if (hasWaiting) {
        await prisma.scan.update({ where: { id: scan.id }, data: { status: "QUEUED" } });
        log.info({ scanId: scan.id }, "reset interrupted scan back to QUEUED");
      } else {
        await prisma.scan.update({
          where: { id: scan.id },
          data: {
            status: "FAILED",
            errorMessage: "Scan stopped because the worker restarted. Start a new scan.",
            completedAt: new Date(),
          },
        });
        log.info({ scanId: scan.id }, "failed orphaned in-progress scan");
      }
    }
    if (scan.status === "QUEUED" && !hasActive && !hasWaiting) {
      await prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: "FAILED",
          errorMessage: "This scan was lost from the queue. Start a new scan.",
          completedAt: new Date(),
        },
      });
      log.info({ scanId: scan.id }, "failed queued scan missing from Redis");
    }
  }

  const activeUrls = new Set(
    liveScans.filter((scan) => activeIds.has(scan.id)).map((scan) => scan.url),
  );

  for (const scan of liveScans) {
    if (!waitingIds.has(scan.id)) continue;
    if (activeUrls.has(scan.url)) {
      await failWaitingJob(
        queue,
        scan.id,
        "A scan of this website is already running. Open that scan instead of starting another.",
      );
      waitingIds.delete(scan.id);
      log.info({ scanId: scan.id, url: scan.url }, "dropped duplicate waiting scan");
    }
  }

  const waitingByUrl = new Map<string, typeof liveScans>();
  for (const scan of liveScans) {
    if (!waitingIds.has(scan.id)) continue;
    const list = waitingByUrl.get(scan.url) ?? [];
    list.push(scan);
    waitingByUrl.set(scan.url, list);
  }
  for (const [url, scans] of waitingByUrl) {
    if (scans.length < 2) continue;
    const sorted = [...scans].sort((a, b) => {
      const score = (scan: (typeof scans)[number]) => scan.pagesScanned * 1000 + scan.progress;
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    for (const extra of sorted.slice(1)) {
      await failWaitingJob(
        queue,
        extra.id,
        "Another scan of this website is already queued, so this duplicate was stopped.",
      );
      log.info({ scanId: extra.id, url }, "dropped older duplicate waiting scan");
    }
  }
}
