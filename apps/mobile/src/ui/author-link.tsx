import { Pressable, Text } from "@gift-list/ui";
import * as Linking from "expo-linking";
import { useTranslations } from "use-intl";
import { getAuthorUrl } from "@/config/env";

export function AuthorLink() {
  const t = useTranslations("common");
  const label = t("writeToAuthor");
  const url = getAuthorUrl();

  if (!url) {
    // NOTE FOR UX: адрес «Написать автору» не задан.
    return (
      <Text kind="button" tone="primary">
        {label}
      </Text>
    );
  }

  function handlePress() {
    void Linking.openURL(url).catch(function ignoreOpenError() {});
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
        {label}
      </Text>
    </Pressable>
  );
}

AuthorLink.displayName = "AuthorLink";
