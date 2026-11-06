import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Story 4.1.1 R1 only. Kept apart from `vitest.config.ts` and from the F5
 * harness so the friendship concurrency proof never joins the normal/CI run:
 * this config matches `friendship.pgtest.ts`, which refuses to start without a
 * safe `DISPOSABLE_*` target instead of skipping.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/db/disposable-pg/friendship.pgtest.ts"],
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 300_000,
  },
});
