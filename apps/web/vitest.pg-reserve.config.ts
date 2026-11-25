import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Stories 5.1 and 5.2. Kept out of `npm test` and CI: both pg-tests refuse to
 * start without a disposable loopback `DISPOSABLE_*` target.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: [
      "src/db/disposable-pg/reserve.pgtest.ts",
      "src/db/disposable-pg/release.pgtest.ts",
    ],
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 300_000,
  },
});
