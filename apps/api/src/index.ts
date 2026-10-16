import { env } from "./config.js";
import { buildApp } from "./app.js";
import { createScanQueue } from "./lib/queue.js";
import { assertRedis, createRedis } from "./lib/redis.js";
import { createLogger } from "@qa-scanner/shared";

const log = createLogger("api");

async function main() {
  const redis = createRedis("api");
  await assertRedis(redis);
  const queue = createScanQueue();
  const app = await buildApp(queue, redis);

  const shutdown = async () => {
    await app.close();
    await queue.close();
    redis.disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  log.info({ port: env.PORT }, "API listening");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
