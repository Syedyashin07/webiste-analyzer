import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "tests/**/*.test.ts", "apps/api/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "tests/e2e/**", "apps/web/**"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
