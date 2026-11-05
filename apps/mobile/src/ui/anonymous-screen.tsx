import { Column, Heading, Screen, ScrollView, Text, YStack } from "@gift-list/ui";
import type { ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { getBrandName } from "@/config/env";
import { AuthorLink } from "@/ui/author-link";

export function AnonymousScreen({ title, children }: { title: string; children?: ReactNode }) {
  const t = useTranslations("common");

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <Column size="form" flexGrow={1} paddingVertical="$page-gutter">
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
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

AnonymousScreen.displayName = "AnonymousScreen";
