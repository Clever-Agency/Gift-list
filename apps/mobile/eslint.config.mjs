import { defineConfig } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";

const shared = Array.isArray(expoConfig) ? expoConfig : [expoConfig];

export default defineConfig([
  ...shared,
  {
    ignores: ["dist/**", "dist-*/**", ".expo/**", ".spa-export/**", "node_modules/**"],
  },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    // CLE-64: компоненты — только именованные функции (см. AGENTS.md)
    rules: {
      "react/display-name": "error",
      "react/function-component-definition": [
        "error",
        {
          namedComponents: "function-declaration",
          unnamedComponents: "function-expression",
        },
      ],
    },
  },
]);
