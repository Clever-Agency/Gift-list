import {
  Button,
  Column,
  Heading,
  PageContainer,
  PageScroll,
  SafeArea,
  Screen,
  Text,
  YStack,
} from "@gift-list/ui";
import { useEffect, useRef } from "react";
import { useTranslations } from "use-intl";

export type AppUpdateBlockScreenProps = {
  /**
   * The store link of the answered policy. `null` (the default policy until the
   * stores are published) hides the action and shows `bodyNoStore`: no URL is
   * invented.
   */
  storeUrl: string | null;
  /**
   * Opens `storeUrl`. The gate owns `Linking.openURL` and swallows a failed open,
   * so a missing store leaves the screen as it is instead of crashing it.
   */
  onOpenStore: () => void;
  /** A stable handle for tests; defaults to the shared blocking id. */
  testID?: string;
};

/**
 * CLE-86: the blocking «Обновите приложение» page.
 *
 * It replaces the whole tree — the gate renders this screen instead of
 * `children` — so there is no navigation under it and nothing to close: it is a
 * plain screen (`Screen` → `SafeArea` → `PageScroll`), deliberately not a
 * `Dialog`, which would yield to Esc, «назад» and a scrim press and would leave
 * the app's navigation alive underneath.
 *
 * The copy is the catalogue's `app.appVersion.block.*`. The region is a live
 * `alert` and the title is the page's level-1 heading; when the screen replaces
 * the app, the browser moves focus into that region, so a screen reader starts
 * from the reason. The store action exists only when the server sent a
 * `storeUrl`.
 */
export function AppUpdateBlockScreen({
  storeUrl,
  onOpenStore,
  testID = "app-update-block",
}: AppUpdateBlockScreenProps) {
  const t = useTranslations("app.appVersion.block");
  const regionRef = useRef<{ focus?: () => void } | null>(null);

  useEffect(function focusRegion() {
    const region = regionRef.current;
    // The browser moves the reader into the page that replaced the app; a phone's
    // view has no `focus`, and the live region does the announcement there.
    if (typeof region?.focus === "function") region.focus();
  }, []);

  return (
    <Screen>
      <SafeArea>
        <PageScroll testID={`${testID}-page`}>
          <PageContainer>
            <Column
              size="form"
              flexGrow={1}
              paddingHorizontal="$page-gutter medium:$page-gutter-lg"
              paddingTop="$page-gutter"
              gap="$2"
            >
              <YStack
                ref={regionRef as never}
                tabIndex={-1}
                outlineWidth={0}
                testID={testID}
                role="alert"
                aria-live="assertive"
                flexGrow={1}
                width="100%"
                maxWidth="$max-form"
                alignSelf="center"
                justifyContent="center"
                paddingVertical="$section-gap"
                gap="$grid-gap"
              >
                <Heading level={1} textAlign="center">
                  {t("title")}
                </Heading>
                <Text tone="muted" textAlign="center">
                  {storeUrl === null ? t("bodyNoStore") : t("body")}
                </Text>
                {storeUrl === null ? null : (
                  <Button label={t("openStore")} onPress={onOpenStore} />
                )}
              </YStack>
            </Column>
          </PageContainer>
        </PageScroll>
      </SafeArea>
    </Screen>
  );
}

AppUpdateBlockScreen.displayName = "AppUpdateBlockScreen";
