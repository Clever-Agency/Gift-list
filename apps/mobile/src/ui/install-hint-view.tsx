import {
  Close,
  IconButton,
  Info,
  LinkText,
  Text,
  useThemeColor,
  XStack,
  YStack,
} from "@gift-list/ui";
import { Link } from "expo-router";
import { useTranslations } from "use-intl";

export type InstallHintViewProps = {
  /** «Google Play»; `""` hides the link (no configured address). */
  androidUrl?: string;
  /** «App Store»; shown only together with {@link iosPublished}. */
  iosUrl?: string;
  /** `IOS_APP_PUBLISHED`: the App Store listing exists. */
  iosPublished?: boolean;
  /** The cross «Закрыть подсказку». */
  onClose: () => void;
  testID?: string;
};

/**
 * The install hint of `DESIGN.md` → Широкий экран (UX-DR11): one sentence, a
 * «Google Play» link (and «App Store» after the iOS release), and a 44 × 44 cross.
 * Presentational only: the screen owns the browser-only visibility and the
 * remembered choice, the store addresses come from `config/env`, and the right
 * column of a wide root screen supplies its own `complementary` landmark.
 */
export function InstallHintView({
  androidUrl = "",
  iosUrl = "",
  iosPublished = false,
  onClose,
  testID = "install-hint",
}: InstallHintViewProps) {
  const t = useTranslations("app.installHint");
  const iconColor = useThemeColor("primary");
  const showIos = iosPublished && iosUrl !== "";
  const showLinks = androidUrl !== "" || showIos;

  return (
    <YStack
      testID={testID}
      width="100%"
      backgroundColor="$surface"
      borderWidth={1}
      borderColor="$border"
      borderRadius="$lg"
      paddingHorizontal="$4"
      paddingVertical="$3"
      gap="$2"
    >
      <XStack gap="$2" alignItems="flex-start">
        <Info size={20} color={iconColor} />
        <Text kind="body" flex={1}>
          {t("text")}
        </Text>
        <IconButton
          label={t("close")}
          variant="plain"
          onPress={onClose}
          testID={`${testID}-close`}
          icon={<Close size={20} color={iconColor} />}
        />
      </XStack>
      {showLinks ? (
        <XStack gap="$4" flexWrap="wrap">
          {androidUrl === "" ? null : (
            <Link href={androidUrl} asChild>
              <LinkText render="a" role="link" testID={`${testID}-android`}>
                {t("googlePlay")}
              </LinkText>
            </Link>
          )}
          {showIos ? (
            <Link href={iosUrl} asChild>
              <LinkText render="a" role="link" testID={`${testID}-ios`}>
                {t("appStore")}
              </LinkText>
            </Link>
          ) : null}
        </XStack>
      ) : null}
    </YStack>
  );
}

InstallHintView.displayName = "InstallHintView";
