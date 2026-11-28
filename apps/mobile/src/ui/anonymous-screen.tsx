import {
  AppShell,
  Column,
  Heading,
  PageContainer,
  PageScroll,
  SafeArea,
  Screen,
  Text,
  YStack,
} from "@gift-list/ui";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { getBrandName } from "@/config/env";
import { SiteFooter } from "@/ui/site-footer";

/**
 * The frame of the anonymous screens (`app/(auth)`): вход, регистрация,
 * восстановление.
 * `AppShell` without navigation gives the page the same `main#main-content` and
 * skip link as the signed-in screens (`DESIGN.md` → Порядок Tab); the screen title
 * is the one `h1`, while the brand stays a plain decorated line above it.
 */
export function AnonymousScreen({ title, children }: { title: string; children?: ReactNode }) {
  const t = useTranslations("common");

  return (
    <Screen>
      <SafeArea>
        <AppShell skipLabel={t("skipToContent")} testID="anonymous-shell">
          <PageScroll testID="anonymous-page" keyboardShouldPersistTaps="handled">
            <PageContainer>
              {/* The gutter follows the window, not JS: the same `pageGutter` values
                  (16 compact, 24 from `bp-medium`) as Tamagui media clauses. */}
              <Column
                size="form"
                flexGrow={1}
                paddingHorizontal="$page-gutter medium:$page-gutter-lg"
                paddingTop="$page-gutter"
              >
                <Text kind="display-sm" tone="primary" textAlign="center">
                  {t("brandName", { brand: getBrandName() })}
                </Text>
                <YStack width="100%" marginTop="$section-gap" gap="$grid-gap">
                  <Heading level={1}>{title}</Heading>
                  {children}
                </YStack>
                <YStack flex={1} />
                <SiteFooter />
              </Column>
            </PageContainer>
          </PageScroll>
        </AppShell>
      </SafeArea>
    </Screen>
  );
}

AnonymousScreen.displayName = "AnonymousScreen";
