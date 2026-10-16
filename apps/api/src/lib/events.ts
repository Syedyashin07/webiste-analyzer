import type Redis from "ioredis";
import { Prisma } from "@prisma/client";
import { REDIS_CHANNELS, type ScanEventType } from "@qa-scanner/shared";
import { prisma } from "./prisma.js";

export async function emitScanEvent(
  redis: Redis,
  scanId: string,
  type: ScanEventType,
  message: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const event = await prisma.scanEvent.create({
    data: { scanId, type, message, payload: payload as Prisma.InputJsonValue },
  });
  await redis.publish(
    REDIS_CHANNELS.scanEvents(scanId),
    JSON.stringify({
      id: event.id,
      scanId,
      type,
      message,
      payload,
      createdAt: event.createdAt.toISOString(),
    }),
  );
}

export async function isCancelled(redis: Redis, scanId: string): Promise<boolean> {
  const flag = await redis.get(REDIS_CHANNELS.scanCancel(scanId));
  if (flag) return true;
  const scan = await prisma.scan.findUnique({ where: { id: scanId }, select: { status: true } });
  return scan?.status === "CANCELLED";
}

export async function markCancelled(redis: Redis, scanId: string): Promise<void> {
  await redis.set(REDIS_CHANNELS.scanCancel(scanId), "1", "EX", 60 * 60);
}

export async function isPaused(redis: Redis, scanId: string): Promise<boolean> {
  const flag = await redis.get(REDIS_CHANNELS.scanPause(scanId));
  return Boolean(flag);
}

export async function markPaused(redis: Redis, scanId: string, phase: string): Promise<void> {
  await redis.set(REDIS_CHANNELS.scanPause(scanId), "1", "EX", 60 * 60 * 6);
  await redis.set(REDIS_CHANNELS.scanResumePhase(scanId), phase, "EX", 60 * 60 * 6);
}

export async function markResumed(redis: Redis, scanId: string): Promise<string | null> {
  const phase = await redis.get(REDIS_CHANNELS.scanResumePhase(scanId));
  await redis.del(REDIS_CHANNELS.scanPause(scanId));
  return phase;
}

export interface ScanLiveState {
  url?: string;
  action?: string;
  paused?: boolean;
  elements?: number;
  bugs?: number;
}

export async function setScanLiveState(redis: Redis, scanId: string, state: ScanLiveState): Promise<void> {
  await redis.set(REDIS_CHANNELS.scanLive(scanId), JSON.stringify(state), "EX", 60 * 60 * 6);
}

export async function getScanLiveState(redis: Redis, scanId: string): Promise<ScanLiveState | null> {
  const raw = await redis.get(REDIS_CHANNELS.scanLive(scanId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ScanLiveState;
  } catch {
    return null;
  }
}
