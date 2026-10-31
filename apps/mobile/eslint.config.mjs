import { defineConfig } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";

const shared = Array.isArray(expoConfig) ? expoConfig : [expoConfig];

export default defineConfig([
  ...shared,
  {
    ignores: ["dist/**", "dist-*/**", ".expo/**", ".spa-export/**", "node_modules/**"],
  },
]);
