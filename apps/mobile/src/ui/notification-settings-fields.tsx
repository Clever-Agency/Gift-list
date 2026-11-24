import type { NotificationPreferences } from "@gift-list/contracts";
import { Heading, Switch, YStack } from "@gift-list/ui";
import { useTranslations } from "use-intl";

const categories = [
  { label: "dates", inApp: "datesInApp", email: "datesEmail" },
  { label: "wishExpiry", inApp: "wishExpiryInApp", email: "wishExpiryEmail" },
] as const;

export function NotificationSettingsFields({
  preferences, disabled, onChange,
}: {
  preferences: NotificationPreferences;
  disabled?: boolean;
  onChange: (key: keyof NotificationPreferences, checked: boolean) => void;
}) {
  const t = useTranslations("notifications");
  return (
    <YStack gap="$3">
      {categories.map(function category({ label, inApp, email }) {
        return (
          <YStack key={label}>
            <Heading level={3}>{t(label)}</Heading>
            <Switch label={t("inApp")} hint={t(label)} checked={preferences[inApp]} disabled={disabled}
              onChange={function change(checked) { onChange(inApp, checked); }}
            />
            <Switch label={t("email")} hint={t(label)} checked={preferences[email]} disabled={disabled}
              onChange={function change(checked) { onChange(email, checked); }}
            />
          </YStack>
        );
      })}
    </YStack>
  );
}

NotificationSettingsFields.displayName = "NotificationSettingsFields";
