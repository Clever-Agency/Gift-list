import { Column, Heading, PageContainer, PageScroll, Screen, Text, YStack } from "@gift-list/ui";
import type { ReactNode } from "react";
import { useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { getBrandName } from "@/config/env";
import { AuthorLink } from "@/ui/author-link";
import { pageGutter } from "@/ui/card-grid";

export function AnonymousScreen({ title, children }: { title: string; children?: ReactNode }) {
  const t = useTranslations("common");
  const { width } = useWindowDimensions();
  const gutter = pageGutter(width);

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <PageScroll testID="anonymous-page" keyboardShouldPersistTaps="handled">
          <PageContainer>
            <Column
              size="form"
              flexGrow={1}
              paddingHorizontal={gutter}
              paddingVertical="$page-gutter"
            >
              <Heading level={1} kind="display-sm" tone="primary" textAlign="center">
                {t("brandName", { brand: getBrandName() })}
              </Heading>
              <YStack width="100%" marginTop="$section-gap" gap="$grid-gap">
                <Text kind="heading">{title}</Text>
                {children}
              </YStack>
              <YStack flex={1} />
              <AuthorLink />
            </Column>
          </PageContainer>
        </PageScroll>
      </SafeAreaView>
    </Screen>
  );
}

AnonymousScreen.displayName = "AnonymousScreen";
