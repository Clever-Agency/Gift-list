import {
  Column,
  LoadingCards,
  PageContainer,
  PageScroll,
  SafeArea,
  Screen,
  YStack,
} from "@gift-list/ui";
import { useWindowDimensions } from "react-native";
import { useTranslations } from "use-intl";
import { cardGrid } from "@/ui/card-grid";
import { SiteFooter } from "@/ui/site-footer";

export type SessionLoadingScreenProps = {
  /** A form reads best narrow; a list uses the wide page column. */
  size?: "form" | "wide";
  /** A stable hook for tests; defaults to the one shared loading region id. */
  testID?: string;
};

/**
 * What every guarded route shows while the session is still `loading`. It replaces
 * a bare `return null`, which left a blank page until `/api/v1/me` answered (and
 * forever when it never did). The page keeps the usual frame — one `PageScroll`,
 * one `PageContainer` — and the card skeleton stays inside it.
 *
 * It is deliberately theme-only: the text and the region name come from the
 * catalogue (`common.loading`), so no screen adds its own loading copy.
 *
 * The gutter is the Tamagui media clause `$page-gutter medium:$page-gutter-lg`,
 * so it follows the window without JS. Only the wide grid still reads the window
 * width: its column count and card width come from `cardGrid` by design. A form
 * skeleton just fills the column content box (`max-form` minus the CSS gutter),
 * so its width does not depend on the window at all.
 */
export function SessionLoadingScreen({ size = "wide", testID = "session-loading" }: SessionLoadingScreenProps) {
  const t = useTranslations("common");
  // The hook is unconditional (rules of hooks) and is only consumed by the wide
  // grid below; the form passes a percentage, so the width never reaches it.
  const { width } = useWindowDimensions();
  const cardWidth = size === "form" ? "100%" : cardGrid(width).cardWidth;

  return (
    <Screen>
      <SafeArea>
        <PageScroll testID={`${testID}-page`}>
          <PageContainer>
            <Column
              size={size}
              flexGrow={1}
              paddingHorizontal="$page-gutter medium:$page-gutter-lg"
              paddingTop="$page-gutter"
              gap="$2"
            >
              <YStack
                flexGrow={1}
                paddingTop="$2"
                paddingBottom="$section-gap"
                gap="$grid-gap"
              >
                <LoadingCards
                  testID={testID}
                  label={t("loading")}
                  width={cardWidth}
                  count={size === "form" ? 1 : 3}
                />
              </YStack>
              <SiteFooter />
            </Column>
          </PageContainer>
        </PageScroll>
      </SafeArea>
    </Screen>
  );
}

SessionLoadingScreen.displayName = "SessionLoadingScreen";
