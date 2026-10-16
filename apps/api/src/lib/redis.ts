import Redis from "ioredis";
import { env } from "../config.js";

export function createRedis(name: string): Redis {
  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    connectionName: name,
  });
  redis.on("error", (error) => {
    console.error(`Redis (${name}) error:`, error.message);
  });
  return redis;
}

export async function assertRedis(redis: Redis): Promise<void> {
  try {
    await redis.ping();
  } catch {
    throw new Error(
      `Redis is unavailable at ${env.REDIS_URL}. Start Redis on localhost:6379 before running the API or worker.`,
    );
  }
}
