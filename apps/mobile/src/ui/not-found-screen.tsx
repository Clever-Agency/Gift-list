import {
  Column,
  Heading,
  PageContainer,
  PageScroll,
  SafeArea,
  Screen,
  Text,
  YStack,
} from "@gift-list/ui";
import { Stack } from "expo-router";
import { useTranslations } from "use-intl";
import { getBrandName } from "@/config/env";
import { NavLink } from "@/ui/nav-link";
import { SiteFooter } from "@/ui/site-footer";

/**
 * UI6: the one 404 page of the app. It answers an unknown or malformed route —
 * never a wishlist that exists but is closed. That state has its own neutral
 * copy on `/wishlist/:token`, because a hidden wishlist must be indistinguishable
 * from a missing one.
 */
export function NotFoundScreen({ testID = "not-found-page" }: { testID?: string }) {
  const t = useTranslations("common");

  return (
    <Screen>
      <SafeArea>
        <Stack.Screen options={{ title: t("notFound.title") }} />
        <PageScroll testID={testID}>
          <PageContainer>
            {/* The gutter follows the window, not JS: the same `pageGutter` values
                (16 compact, 24 from `bp-medium`) as Tamagui media clauses. */}
            <Column
              size="form"
              flexGrow={1}
              paddingHorizontal="$page-gutter medium:$page-gutter-lg"
              paddingTop="$page-gutter"
              gap="$2"
            >
              <Text kind="display-sm" tone="primary" textAlign="center">
                {t("brandName", { brand: getBrandName() })}
              </Text>
              <Heading level={1} textAlign="center">
                {t("notFound.title")}
              </Heading>
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
              <SiteFooter />
            </Column>
          </PageContainer>
        </PageScroll>
      </SafeArea>
    </Screen>
  );
}

NotFoundScreen.displayName = "NotFoundScreen";
