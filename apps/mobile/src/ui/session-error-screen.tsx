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
import { useTranslations } from "use-intl";
import { PrimaryButton } from "@/ui/primary-button";
import { SiteFooter } from "@/ui/site-footer";

export type SessionErrorScreenProps = {
  /** A form reads best narrow; a list uses the wide page column. */
  size?: "form" | "wide";
  /** A stable hook for tests; defaults to the one shared session error id. */
  testID?: string;
  /** Rereads `/api/v1/me`; the caller owns the auth context retry. */
  onRetry: () => void;
};

/**
 * What a guarded route shows when the session read failed for a reason that is
 * not `UNAUTHENTICATED`: no network, a timeout or a broken answer. Before this
 * screen every such failure became `anonymous`, so the user was sent to login
 * even though the stored session might still be perfectly valid.
 *
 * The page keeps the usual frame — one `PageScroll`, one `PageContainer` — and
 * the text comes from the catalogue (`common.sessionError`). The region is a
 * live `alert`, because it replaces the page the user expected to see.
 */
export function SessionErrorScreen({
  size = "wide",
  testID = "session-error",
  onRetry,
}: SessionErrorScreenProps) {
  const t = useTranslations("common");

  return (
    <Screen>
      <SafeArea>
        <PageScroll testID={`${testID}-page`}>
          <PageContainer>
            {/* The gutter follows the window, not JS: the same `pageGutter` values
                (16 compact, 24 from `bp-medium`) as Tamagui media clauses, for both
                the form and the wide column. */}
            <Column
              size={size}
              flexGrow={1}
              paddingHorizontal="$page-gutter medium:$page-gutter-lg"
              paddingTop="$page-gutter"
              gap="$2"
            >
              <YStack
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
                  {t("sessionError.title")}
                </Heading>
                <Text tone="muted" textAlign="center">
                  {t("sessionError.body")}
                </Text>
                <PrimaryButton label={t("sessionError.retry")} onPress={onRetry} />
              </YStack>
              <SiteFooter />
            </Column>
          </PageContainer>
        </PageScroll>
      </SafeArea>
    </Screen>
  );
}

SessionErrorScreen.displayName = "SessionErrorScreen";
