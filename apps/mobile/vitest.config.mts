import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // expo-modules-core reads the identifier `__DEV__`. Metro defines it; Vitest does not.
  define: {
    __DEV__: "true",
  },
  resolve: {
    alias: {
      "@": path.join(root, "src"),
      // Tests run in the browser DOM: the web build of React Native, as the Expo web export uses.
      "react-native": "react-native-web",
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.tsx"],
    // `.mts` so Vite's config loader accepts the ESM config in a CommonJS package.
    // Inline deps so Tamagui and react-dom share one React on Windows.
    server: {
      deps: {
        inline: true,
      },
    },
  },
});
