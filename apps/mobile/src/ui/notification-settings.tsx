import type { NotificationPreferences } from "@gift-list/contracts";
import { Button, Heading, Text, YStack } from "@gift-list/ui";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { fetchNotificationPreferences, saveNotificationPreferences } from "@/api/notifications";
import { useNotificationBadge } from "@/navigation/notification-badge";
import { NotificationSettingsFields } from "./notification-settings-fields";

export function NotificationSettings() {
  const t = useTranslations("notifications");
  const refresh = useNotificationBadge()?.refresh;
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);

  useEffect(function loadPreferences() {
    let live = true;
    void fetchNotificationPreferences().then(function loaded(data) {
      if (live) {
        setPreferences(data);
        setError(!data);
      }
    });
    return function ignoreLateAnswer() { live = false; };
  }, [attempt]);

  async function change(key: keyof NotificationPreferences, checked: boolean) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(false);
    const result = await saveNotificationPreferences({ [key]: checked });
    inFlight.current = false;
    setBusy(false);
    if (result?.success) {
      setPreferences(result.data);
      refresh?.();
    } else {
      setError(true);
    }
  }

  function retry() {
    setError(false);
    setAttempt(value => value + 1);
  }

  return (
    <YStack gap="$2" paddingTop="$grid-gap">
      <Heading level={2}>{t("settingsTitle")}</Heading>
      {preferences ? <NotificationSettingsFields preferences={preferences} disabled={busy} onChange={change} /> : null}
      {error ? <Text role="alert">{t("settingsError")}</Text> : null}
      {error && !preferences ? <Button label={t("retry")} variant="secondary" onPress={retry} /> : null}
    </YStack>
  );
}

NotificationSettings.displayName = "NotificationSettings";
