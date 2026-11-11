import { Column, Heading, PageContainer, PageScroll, SafeArea, Screen, Text, YStack } from "@gift-list/ui";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { getBrandName } from "@/config/env";
import { SiteFooter } from "@/ui/site-footer";

export function AnonymousScreen({ title, children }: { title: string; children?: ReactNode }) {
  const t = useTranslations("common");

  return (
    <Screen>
      <SafeArea>
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
              <Heading level={1} kind="display-sm" tone="primary" textAlign="center">
                {t("brandName", { brand: getBrandName() })}
              </Heading>
              <YStack width="100%" marginTop="$section-gap" gap="$grid-gap">
                <Text kind="heading">{title}</Text>
                {children}
              </YStack>
              <YStack flex={1} />
              <SiteFooter />
            </Column>
          </PageContainer>
        </PageScroll>
      </SafeArea>
    </Screen>
  );
}

AnonymousScreen.displayName = "AnonymousScreen";
