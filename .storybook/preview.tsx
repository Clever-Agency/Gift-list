import type { Decorator, Preview } from "@storybook/react-native-web-vite";
import type { ReactNode } from "react";
import { IntlProvider } from "use-intl";
import { getMessages } from "@gift-list/contracts";
import { colors, createGiftListConfig, GiftListProvider } from "@gift-list/ui";

// One config per bundle, at module scope, exactly as in `apps/mobile/app/_layout.tsx`
// and `apps/web/src/app/tamagui-registry.tsx`. The families are the ones the app
// loads: Next hands `next/font` variables to `createGiftListConfig`, Expo hands the
// expo-font face names; the catalog hands the `@font-face` names of the same woff2
// files (`.storybook/preview-head.html` + `staticDirs` in `main.ts`).
const config = createGiftListConfig({ body: "Manrope", heading: "Lora" });

// The app's own copy, not literals: the `App/*` section shows `apps/mobile/src/ui`
// composites that translate their labels with `use-intl`, so every story needs the
// catalogue the app ships (AD-24, D-46). `packages/ui` components take their text
// as props, so the provider changes nothing for the `UI/*` section.
const messages = getMessages("ru");

/** The page the catalog draws on: the app background, outside the theme. */
function CatalogSurface({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        boxSizing: "border-box",
        minHeight: "100vh",
        padding: 24,
        backgroundColor: colors.background,
        color: colors.foreground,
      }}
    >
      {children}
    </div>
  );
}

CatalogSurface.displayName = "CatalogSurface";

/**
 * The full-height frame of the screen stories (`parameters.screenFrame: true`).
 *
 * A screen draws the app page itself, and its chain `Screen` → `SafeArea` →
 * `PageScroll` is a column of `flex: 1` children: it fills a parent that has a
 * height and resolves to 0 in one that does not. `CatalogSurface` is a block box
 * with `min-height`, so in it the whole chain collapsed to 0 and the scroll area
 * clipped the page — the story looked empty even though the DOM had the content.
 *
 * This frame is the viewport column instead, full bleed (the app page paints its
 * own background, so the catalog's padding and surface would only fake a border).
 * `height: 100vh` is a definite height for the flex chain, and the page scroll then
 * gets the window height and scrolls when the content is taller than it.
 */
function ScreenFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        minWidth: 0,
        backgroundColor: colors.background,
        color: colors.foreground,
      }}
    >
      {children}
    </div>
  );
}

ScreenFrame.displayName = "ScreenFrame";

/**
 * The surface every story gets: the padded canvas of the catalog, or the full-height
 * frame the screen stories ask for with `parameters.screenFrame`. A component story
 * never sets the flag, so its canvas does not change.
 */
const withStorySurface: Decorator = function withStorySurface(Story, context) {
  if (context.parameters.screenFrame === true) {
    return (
      <ScreenFrame>
        <Story />
      </ScreenFrame>
    );
  }
  return (
    <CatalogSurface>
      <Story />
    </CatalogSurface>
  );
};

/** The provider and the catalogue every story gets, like the root of each app. */
const withGiftListProvider: Decorator = function withGiftListProvider(Story) {
  return (
    <GiftListProvider config={config}>
      <IntlProvider locale="ru" messages={messages}>
        <Story />
      </IntlProvider>
    </GiftListProvider>
  );
};

const preview: Preview = {
  // The surface is the outermost decorator, so the screen frame is the page itself.
  decorators: [withStorySurface, withGiftListProvider],
  parameters: {
    layout: "centered",
    // The catalog is the light theme only (UX-A8); a dark variant would show colors
    // the app never paints.
    backgrounds: { disable: true },
    // The window widths `DESIGN.md` → Точки перехода reasons about: 360/390/412 are
    // phones, 768 the tablet portrait (medium), 1280 the wide desktop. The built-in
    // Storybook 10 viewport drives real media queries in the iframe, so a preset
    // story is the same code path as a resized browser window.
    viewport: {
      options: {
        w360: {
          name: "Phone 360 (compact)",
          styles: { width: "360px", height: "780px" },
          type: "mobile",
        },
        w390: {
          name: "Phone 390 (compact)",
          styles: { width: "390px", height: "844px" },
          type: "mobile",
        },
        w412: {
          name: "Phone 412 (compact)",
          styles: { width: "412px", height: "915px" },
          type: "mobile",
        },
        w768: {
          name: "Tablet 768 (medium)",
          styles: { width: "768px", height: "1024px" },
          type: "tablet",
        },
        w1280: {
          name: "Desktop 1280 (wide)",
          styles: { width: "1280px", height: "800px" },
          type: "desktop",
        },
      },
    },
    // axe-core runs on every story; `todo` reports violations in the panel without
    // failing the build (failing the build is W12's job, after the known defects).
    a11y: { test: "todo" },
  },
  // Start in the tool's responsive mode; component stories pin a preset via
  // `globals: { viewport: { value: "w360" } }` where the narrow width is the point.
  initialGlobals: {
    viewport: { value: "responsive" },
  },
};

export default preview;
