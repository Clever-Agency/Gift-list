import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // Cold import of auth, Prisma and Next under a parallel run exceeds
    // Vitest's 5s test / 10s hook defaults on Windows (CLE-67). A passing
    // test still finishes as soon as it finishes; only a hang waits this long.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // One React for Tamagui and react-dom. `inline: true` also transforms
    // Next and Prisma, and the cold auth import then exceeds 30s. String
    // package names use path.join, so on Windows they miss Vite's
    // forward-slash ids; match both separators.
    server: {
      deps: {
        inline: [
          /[\\/]node_modules[\\/]@tamagui[\\/]/,
          /[\\/]node_modules[\\/]tamagui[\\/]/,
          /[\\/]node_modules[\\/]react[\\/]/,
          /[\\/]node_modules[\\/]react-dom[\\/]/,
          /[\\/]node_modules[\\/]scheduler[\\/]/,
        ],
      },
    },
  },
});
