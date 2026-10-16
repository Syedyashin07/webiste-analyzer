import fs from "node:fs/promises";
import path from "node:path";
import type { Queue } from "bullmq";
import type Redis from "ioredis";
import { prisma } from "../lib/prisma.js";
import { STORAGE_ROOT } from "../config.js";
import { markCancelled } from "../lib/events.js";
import type { ScanJobData } from "../lib/queue.js";

export async function resetProjectData(queue: Queue<ScanJobData>, redis: Redis): Promise<{ scansDeleted: number }> {
  const scans = await prisma.scan.findMany({ select: { id: true } });
  for (const scan of scans) {
    await markCancelled(redis, scan.id);
  }

  try {
    await queue.obliterate({ force: true });
  } catch {
    const jobs = await queue.getJobs(["active", "wait", "waiting", "delayed", "paused", "failed", "completed"]);
    await Promise.all(
      jobs.map(async (job) => {
        try {
          await job.remove();
        } catch {
          /* already gone */
        }
      }),
    );
  }

  const scansDeleted = scans.length;
  await prisma.scan.deleteMany({});
  await prisma.screenshot.deleteMany({});
  await prisma.video.deleteMany({});
  await prisma.trace.deleteMany({});
  await prisma.$executeRaw`DELETE FROM "FileBlob"`;

  const buckets = ["screenshots", "videos", "traces", "reports"];
  for (const bucket of buckets) {
    const dir = path.join(STORAGE_ROOT, bucket);
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.name === ".gitkeep") continue;
      await fs.rm(path.join(dir, entry.name), { recursive: true, force: true });
    }
  }

  await redis.flushdb();
  return { scansDeleted };
}
