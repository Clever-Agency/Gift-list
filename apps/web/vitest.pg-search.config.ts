import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/db/disposable-pg/search.pgtest.ts"],
    testTimeout: 60_000,
    hookTimeout: 240_000,
  },
});
