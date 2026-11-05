import type { ReactNode } from "react";
import { TamaguiProvider } from "tamagui/provider";
import type { GiftListConfig } from "./config";

export type GiftListProviderProps = {
  /** From `createGiftListConfig(fonts)`, created once per bundle (module scope). */
  config: GiftListConfig;
  children: ReactNode;
};

/**
 * The root provider: the theme (`light` only, UX-A8), the media queries and the
 * portal host that `Dialog` and `BottomSheet` mount into. Put it once at the root of
 * the Expo app (`app/_layout.tsx`) and of the Next layout.
 */
export function GiftListProvider({ config, children }: GiftListProviderProps) {
  return (
    <TamaguiProvider config={config} defaultTheme="light">
      {children}
    </TamaguiProvider>
  );
}

GiftListProvider.displayName = "GiftListProvider";
