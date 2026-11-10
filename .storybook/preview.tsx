import type { Decorator, Preview } from "@storybook/react-native-web-vite";
import type { ReactNode } from "react";
import { colors, createGiftListConfig, GiftListProvider } from "@gift-list/ui";

// One config per bundle, at module scope, exactly as in `apps/mobile/app/_layout.tsx`
// and `apps/web/src/app/tamagui-registry.tsx`. The families are the ones the app
// loads: Next hands `next/font` variables to `createGiftListConfig`, Expo hands the
// expo-font face names; the catalog hands the `@font-face` names of the same woff2
// files (`.storybook/preview-head.html` + `staticDirs` in `main.ts`).
const config = createGiftListConfig({ body: "Manrope", heading: "Lora" });

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

/** The provider and the surface every story gets, like the root of each app. */
const withGiftListProvider: Decorator = function withGiftListProvider(Story) {
  return (
    <GiftListProvider config={config}>
      <CatalogSurface>
        <Story />
      </CatalogSurface>
    </GiftListProvider>
  );
};

const preview: Preview = {
  decorators: [withGiftListProvider],
  parameters: {
    layout: "centered",
    // The catalog is the light theme only (UX-A8); a dark variant would show colors
    // the app never paints.
    backgrounds: { disable: true },
  },
};

export default preview;
