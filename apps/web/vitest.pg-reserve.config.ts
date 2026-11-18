import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Story 5.1 only. Kept out of `npm test` and CI: `reserve.pgtest.ts` refuses to
 * start without a disposable loopback `DISPOSABLE_*` target.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/db/disposable-pg/reserve.pgtest.ts"],
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 300_000,
  },
});
