import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * F5 / Q-04 only. Kept apart from `vitest.config.ts` so the disposable
 * PostgreSQL suite never joins the normal/CI run: this config matches the
 * `.pgtest.ts` file, which refuses to start without a safe `DISPOSABLE_*`
 * target instead of skipping.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/db/disposable-pg/verify.pgtest.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 300_000,
  },
});
