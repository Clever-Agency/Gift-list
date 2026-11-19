import type { ReactNode } from "react";
import { TamaguiProvider } from "tamagui/provider";
import type { GiftListConfig } from "./config";
import type { ThemeName } from "./tokens";

export type GiftListProviderProps = {
  /** From `createGiftListConfig(fonts)`, created once per bundle (module scope). */
  config: GiftListConfig;
  /**
   * `light` (default) or `dark` (`DESIGN.md` → v8). The two themes share one set of
   * keys, so the app only has to choose the name; there is no in-app switch yet.
   */
  theme?: ThemeName;
  children: ReactNode;
};

/**
 * The root provider: the theme (v8: light and dark, light by default), the media
 * queries and the portal host that `Dialog` and `BottomSheet` mount into. Put it once
 * at the root of the Expo app (`app/_layout.tsx`) and of the Next layout.
 */
export function GiftListProvider({ config, theme = "light", children }: GiftListProviderProps) {
  return (
    <TamaguiProvider config={config} defaultTheme={theme}>
      {children}
    </TamaguiProvider>
  );
}

GiftListProvider.displayName = "GiftListProvider";
