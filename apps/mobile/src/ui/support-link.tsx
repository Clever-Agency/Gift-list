import { AUTHOR_MAILTO } from "@gift-list/contracts";
import { Pressable, Text } from "@gift-list/ui";
import * as Linking from "expo-linking";
import { useTranslations } from "use-intl";

/**
 * «Написать в техподдержку» of the shared footer and `/profile` (AD-24, D-53).
 * The address is the public constant `AUTHOR_EMAIL` in `packages/contracts`, so
 * the link is always active and no build configuration can leave it as plain
 * text. A missing mail client only rejects `openURL`, which is swallowed: the
 * footer never breaks.
 */
export function SupportLink() {
  const t = useTranslations("common");

  function handlePress() {
    void Linking.openURL(AUTHOR_MAILTO).catch(function ignoreOpenError() {});
  }

  return (
    <Pressable
      role="link"
      onPress={handlePress}
      minHeight="$touch-target"
      minWidth="$touch-target"
      justifyContent="center"
    >
      <Text kind="button" tone="primary">
        {t("writeToSupport")}
      </Text>
    </Pressable>
  );
}

SupportLink.displayName = "SupportLink";
