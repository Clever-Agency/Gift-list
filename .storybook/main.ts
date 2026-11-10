import type { StorybookConfig } from "@storybook/react-native-web-vite";

/**
 * Visual catalog of `packages/ui` on the web (Story 1.10, AD-2).
 *
 * Dev-only: stories sit next to the components, but neither `src/index.ts` nor the
 * apps import them, so they never reach the Next or Expo bundles. The catalog lives
 * at the repository root because it serves the whole design system, not one app.
 */
const config: StorybookConfig = {
  stories: ["../packages/ui/src/**/*.stories.tsx"],
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
};

export default config;
