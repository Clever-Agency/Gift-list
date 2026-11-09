import {
  Column,
  Heading,
  PageContainer,
  PageScroll,
  Screen,
  Text,
  YStack,
} from "@gift-list/ui";
import { Stack } from "expo-router";
import { useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { getBrandName } from "@/config/env";
import { pageGutter } from "@/ui/card-grid";
import { NavLink } from "@/ui/nav-link";

/**
 * UI6: the one 404 page of the app. It answers an unknown or malformed route —
 * never a wishlist that exists but is closed. That state has its own neutral
 * copy on `/wishlist/:token`, because a hidden wishlist must be indistinguishable
 * from a missing one.
 */
export function NotFoundScreen({ testID = "not-found-page" }: { testID?: string }) {
  const t = useTranslations("common");
  const { width } = useWindowDimensions();
  const gutter = pageGutter(width);

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <Stack.Screen options={{ title: t("notFound.title") }} />
        <PageScroll testID={testID}>
          <PageContainer>
            <Column
              size="form"
              flexGrow={1}
              paddingHorizontal={gutter}
              paddingVertical="$page-gutter"
              gap="$2"
            >
              <Text kind="display-sm" tone="primary" textAlign="center">
                {t("brandName", { brand: getBrandName() })}
              </Text>
              <Heading level={1}>{t("notFound.title")}</Heading>
              <YStack
                flexGrow={1}
                marginTop="$section-gap"
                alignItems="center"
                gap="$grid-gap"
              >
                <Text tone="muted" textAlign="center">
                  {t("notFound.body")}
                </Text>
                <NavLink href="/">{t("notFound.toHome")}</NavLink>
              </YStack>
            </Column>
          </PageContainer>
        </PageScroll>
      </SafeAreaView>
    </Screen>
  );
}

NotFoundScreen.displayName = "NotFoundScreen";
