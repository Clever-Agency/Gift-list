import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-native-web-vite";

/** Absolute paths keep the config independent of the process working directory. */
function fromRoot(path: string): string {
  return fileURLToPath(new URL(`../${path}`, import.meta.url));
}

/**
 * Visual catalog of the shared UI (AD-2, Story 1.10).
 *
 * Two sections: `UI/*` — every component of `packages/ui`; `App/*` — the
 * app-level composites of `apps/mobile/src/ui` (cards, form, dialogs, screens)
 * that wrap those components with the catalogue texts and the app wiring.
 *
 * Dev-only: stories sit next to the components, but neither `packages/ui/src/index.ts`
 * nor the apps import them, so they never reach the Next or Expo bundles. The
 * catalog lives at the repository root because it serves the whole design system,
 * not one app.
 */
const config: StorybookConfig = {
  stories: [
    "../packages/ui/src/**/*.stories.tsx",
    "../apps/mobile/src/**/*.stories.tsx",
  ],
  // Viewport and backgrounds are part of Storybook 10 core; a11y is the one addon:
  // it shows axe-core violations next to every story (`parameters.a11y.test`).
  addons: ["@storybook/addon-a11y"],
  framework: {
    name: "@storybook/react-native-web-vite",
    options: {
      // `@gift-list/ui` ships TS sources and is transpiled by Vite from outside
      // node_modules; only the React Native packages need the Babel pass here.
      modulesToTranspile: ["@gift-list/ui"],
    },
  },
  // The app fonts (the same subsets Next and Expo load), served at `/fonts`.
  staticDirs: [{ from: "../apps/web/src/app/fonts", to: "/fonts" }],
  core: {
    disableTelemetry: true,
  },
  async viteFinal(viteConfig) {
    const existing = Array.isArray(viteConfig.resolve?.alias) ? viteConfig.resolve.alias : [];

    viteConfig.resolve = {
      ...viteConfig.resolve,
      alias: [
        // The app modules are read through the same `@/…` alias as in
        // `apps/mobile/tsconfig.json` (the root has no tsconfig, so the
        // framework's `vite-tsconfig-paths` cannot find it).
        //
        // `apps/mobile` reads `process.env` only in `src/config/env.ts`, which a
        // browser bundle cannot evaluate; the catalog swaps that one module for a
        // mock. The narrower entry must come before the `@` prefix.
        { find: /^@\/config\/env$/, replacement: fromRoot(".storybook/mocks/config-env.ts") },
        { find: /^@\//, replacement: `${fromRoot("apps/mobile/src")}/` },
        // Native and router modules the app-level components pull in. Mocks live
        // outside `apps/mobile` on purpose: `scripts/check-boundaries.mjs` walks
        // that tree, and Storybook wiring is not app code.
        { find: /^expo-router$/, replacement: fromRoot(".storybook/mocks/expo-router.tsx") },
        { find: /^expo-symbols$/, replacement: fromRoot(".storybook/mocks/expo-symbols.tsx") },
        { find: /^expo-linking$/, replacement: fromRoot(".storybook/mocks/expo-linking.ts") },
        {
          find: /^react-native-safe-area-context$/,
          replacement: fromRoot(".storybook/mocks/react-native-safe-area-context.tsx"),
        },
        ...existing,
      ],
    };

    return viteConfig;
  },
};

export default config;
