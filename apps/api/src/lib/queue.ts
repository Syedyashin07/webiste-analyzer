import { Queue } from "bullmq";
import { QUEUE_NAMES } from "@qa-scanner/shared";
import { env } from "../config.js";

export interface ScanJobData {
  scanId: string;
  loginUsername?: string;
  loginPassword?: string;
  loginUrl?: string;
}

export function createScanQueue(): Queue<ScanJobData> {
  return new Queue<ScanJobData>(QUEUE_NAMES.SCANS, {
    connection: { url: env.REDIS_URL },
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 50,
      removeOnFail: 50,
    },
  });
}
