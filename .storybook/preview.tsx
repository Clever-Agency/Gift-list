import { DocsContainer, type DocsContainerProps } from "@storybook/addon-docs/blocks";
import type { Decorator, Preview } from "@storybook/react-native-web-vite";
import { useEffect, useState, type PropsWithChildren, type ReactNode } from "react";
import { GLOBALS_UPDATED } from "storybook/internal/core-events";
import { create } from "storybook/theming/create";
import { IntlProvider } from "use-intl";
import { getMessages } from "@gift-list/contracts";
import { colors, colorsDark, createGiftListConfig, GiftListProvider, YStack } from "@gift-list/ui";

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

/**
 * The page the catalog draws on: the app background, outside the theme. `$` tokens,
 * not `colors.*`: the surface follows the active theme (v8: light and dark).
 *
 * The surface spans its whole parent — the docs story block or the canvas — so the
 * themed background never shrinks to the width of the sample inside it. The content
 * keeps its placement: centred in the default `layout: "centered"`, at the start in
 * `layout: "fullscreen"` (the gallery stories), so only the background grows.
 */
function CatalogSurface({ children, centered = true }: { children: ReactNode; centered?: boolean }) {
  return (
    <YStack
      width="100%"
      padding={24}
      alignItems={centered ? "center" : "flex-start"}
      backgroundColor="$background"
      color="$foreground"
    >
      {children}
    </YStack>
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
 * Colours are `$` tokens, so the frame follows the theme the provider is given.
 */
function ScreenFrame({ children }: { children: ReactNode }) {
  return (
    <YStack minWidth={0} backgroundColor="$background" color="$foreground">
      {children}
    </YStack>
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
    <CatalogSurface centered={(context.parameters.layout ?? "centered") !== "fullscreen"}>
      <Story />
    </CatalogSurface>
  );
};

/**
 * The iframe background: a fixed layer under the story, painted with the `$background`
 * of the active theme. Without it a dark story would still sit on the light page from
 * `preview-head.html` whenever the story is narrower than the window.
 */
function CanvasBackground() {
  return (
    <YStack
      aria-hidden
      data-testid="canvas-background"
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      backgroundColor="$background"
      pointerEvents="none"
      zIndex={-1}
    />
  );
}

CanvasBackground.displayName = "CanvasBackground";

/**
 * The provider and the catalogue every story gets, like the root of each app.
 * The toolbar theme is applied here too, so `$` tokens inside the story follow it.
 */
const withGiftListProvider: Decorator = function withGiftListProvider(Story, context) {
  // The toolbar switches the v8 theme; the light one is the app default.
  const theme = context.globals.theme === "dark" ? "dark" : "light";
  return (
    <GiftListProvider config={config} theme={theme}>
      <IntlProvider locale="ru" messages={messages}>
        <CanvasBackground />
        <Story />
      </IntlProvider>
    </GiftListProvider>
  );
};

/**
 * The docs theme of each v8 theme (`DESIGN.md` → v8). Docs pages draw their own
 * chrome, so passing a `ThemeVars` to Storybook's `DocsContainer` is the only way to
 * paint them with the catalog palette instead of the default light theme.
 */
const DOCS_THEMES = {
  light: create({
    base: "light",
    brandTitle: "Gift List · v8",
    colorPrimary: colors.primary,
    colorSecondary: colors.primary,
    appBg: colors.background,
    appContentBg: colors.surface,
    appPreviewBg: colors.background,
    appBorderColor: colors.border,
    appBorderRadius: 8,
    textColor: colors.foreground,
    textInverseColor: colors["primary-foreground"],
    barBg: colors.background,
    barTextColor: colors["muted-foreground"],
  }),
  dark: create({
    base: "dark",
    brandTitle: "Gift List · v8",
    colorPrimary: colorsDark.primary,
    colorSecondary: colorsDark.primary,
    appBg: colorsDark.background,
    appContentBg: colorsDark.surface,
    appPreviewBg: colorsDark.background,
    appBorderColor: colorsDark.border,
    appBorderRadius: 8,
    textColor: colorsDark.foreground,
    textInverseColor: colorsDark["primary-foreground"],
    barBg: colorsDark.background,
    barTextColor: colorsDark["muted-foreground"],
  }),
} as const;

/** The payload of `GLOBALS_UPDATED` at the level this file needs (`theme` is ours). */
type GlobalsUpdatedPayload = { globals: { theme?: string } };

/**
 * The theme a docs entry is drawn in: the globals the preview already holds for its
 * primary story. A docs container is not a decorator or a story function, so it must
 * not call preview hooks such as `useGlobals` — Storybook throws «preview hooks can
 * only be called inside decorators and story functions» and the whole page fails.
 */
export function docsThemeName(context: DocsContainerProps["context"]): "light" | "dark" {
  try {
    const { globals } = context.getStoryContext(context.storyById());
    return globals.theme === "dark" ? "dark" : "light";
  } catch {
    // An MDX-only docs entry has no primary story; it starts light and the channel
    // subscription below picks the toolbar theme up.
    return "light";
  }
}

/** Storybook's docs page in the theme the toolbar picked. */
function ThemedDocsContainer({ context, children }: PropsWithChildren<DocsContainerProps>) {
  const [themeName, setThemeName] = useState(() => docsThemeName(context));

  // The container is not a decorator, so it watches the preview channel instead of
  // calling `useGlobals`: the toolbar writes `GLOBALS_UPDATED` and the page repaints
  // without a navigation.
  useEffect(
    function subscribeToGlobals() {
      function handleGlobalsUpdated({ globals }: GlobalsUpdatedPayload) {
        setThemeName(globals.theme === "dark" ? "dark" : "light");
      }
      context.channel.on(GLOBALS_UPDATED, handleGlobalsUpdated);
      return function unsubscribeFromGlobals() {
        context.channel.off(GLOBALS_UPDATED, handleGlobalsUpdated);
      };
    },
    [context],
  );

  return (
    <DocsContainer context={context} theme={DOCS_THEMES[themeName]}>
      {children}
    </DocsContainer>
  );
}

ThemedDocsContainer.displayName = "ThemedDocsContainer";

const preview: Preview = {
  // A later entry wraps the earlier ones: `withGiftListProvider` is the outer
  // decorator and `withStorySurface` the inner one, so every story renders inside
  // both (DOM: `#storybook-root > span display:contents > ScreenFrame`).
  decorators: [withStorySurface, withGiftListProvider],
  // The toolbar theme of the catalog (`DESIGN.md` → v8: light and dark share one set
  // of tokens, so every story can be checked in both without a second story).
  globalTypes: {
    theme: {
      description: "Тема v8",
      toolbar: {
        title: "Тема",
        icon: "mirror",
        items: [
          { value: "light", title: "Светлая" },
          { value: "dark", title: "Тёмная" },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    layout: "centered",
    // Storybook's own background presets stay off so a story is painted by `$`
    // tokens of the active theme only.
    backgrounds: { disable: true },
    docs: {
      // The docs page follows the toolbar theme: same palette, same Lora/Manrope.
      container: ThemedDocsContainer,
    },
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
    theme: "light",
    viewport: { value: "responsive" },
  },
};

export default preview;
