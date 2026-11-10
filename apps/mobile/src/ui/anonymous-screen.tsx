import { Column, Heading, PageContainer, PageScroll, SafeArea, Screen, Text, YStack } from "@gift-list/ui";
import type { ReactNode } from "react";
import { useWindowDimensions } from "react-native";
import { useTranslations } from "use-intl";
import { getBrandName } from "@/config/env";
import { pageGutter } from "@/ui/card-grid";
import { SiteFooter } from "@/ui/site-footer";

export function AnonymousScreen({ title, children }: { title: string; children?: ReactNode }) {
  const t = useTranslations("common");
  const { width } = useWindowDimensions();
  const gutter = pageGutter(width);

  return (
    <Screen>
      <SafeArea>
        <PageScroll testID="anonymous-page" keyboardShouldPersistTaps="handled">
          <PageContainer>
            <Column
              size="form"
              flexGrow={1}
              paddingHorizontal={gutter}
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
