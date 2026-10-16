import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { parseEnv } from "@qa-scanner/shared";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
dotenv.config({ path: path.join(repoRoot, ".env") });

export const env = parseEnv(process.env);
export const ROOT_DIR = repoRoot;
export const STORAGE_ROOT = env.STORAGE_DIR
  ? path.resolve(env.STORAGE_DIR)
  : path.join(repoRoot, "storage");
