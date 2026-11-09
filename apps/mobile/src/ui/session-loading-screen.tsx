import {
  Column,
  LoadingCards,
  PageContainer,
  PageScroll,
  Screen,
  spacing,
  YStack,
} from "@gift-list/ui";
import { useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { cardGrid, pageGutter } from "@/ui/card-grid";

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
 */
export function SessionLoadingScreen({ size = "wide", testID = "session-loading" }: SessionLoadingScreenProps) {
  const t = useTranslations("common");
  const { width } = useWindowDimensions();
  const gutter = pageGutter(width);
  const cardWidth =
    size === "form"
      ? Math.max(0, Math.min(width, spacing["max-form"]) - gutter * 2)
      : cardGrid(width).cardWidth;

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <PageScroll testID={`${testID}-page`}>
          <PageContainer>
            <Column
              size={size}
              flexGrow={1}
              paddingHorizontal={gutter}
              paddingTop="$page-gutter"
              gap="$2"
            >
              <YStack
                flexGrow={1}
                paddingTop={spacing["grid-gap"] / 2}
                paddingBottom={spacing["section-gap"]}
                gap={spacing["grid-gap"]}
              >
                <LoadingCards
                  testID={testID}
                  label={t("loading")}
                  width={cardWidth}
                  count={size === "form" ? 1 : 3}
                />
              </YStack>
            </Column>
          </PageContainer>
        </PageScroll>
      </SafeAreaView>
    </Screen>
  );
}

SessionLoadingScreen.displayName = "SessionLoadingScreen";
