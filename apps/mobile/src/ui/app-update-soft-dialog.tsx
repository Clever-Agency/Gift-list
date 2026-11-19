import { Button, Close, Dialog, spacing, useThemeColor } from "@gift-list/ui";
import { useTranslations } from "use-intl";

export type AppUpdateSoftDialogProps = {
  /** A closed dialog renders nothing: the gate keeps the offer until `onDismiss`. */
  visible: boolean;
  /**
   * The store link of the answered policy. `null` (the default policy until the
   * stores are published) leaves only «Закрыть»: no URL is invented.
   */
  storeUrl: string | null;
  /**
   * Opens `storeUrl`. The gate owns `Linking.openURL` and swallows a failed open,
   * so the dialog never breaks when no store is installed.
   */
  onOpenStore: () => void;
  /**
   * The offer was closed: the cross, Esc, the system «назад» on Android, a scrim
   * press or the «Закрыть» button. The gate remembers the `latestVersion`.
   */
  onDismiss: () => void;
  /** A stable handle for tests; defaults to the shared soft-offer id. */
  testID?: string;
};

/**
 * CLE-86: the dismissible «Доступно обновление» offer (`Dialog` of
 * `@gift-list/ui`).
 *
 * It is shown when the build is below `latestVersion` but still supported: the
 * person may keep using the app, and every closing path (cross, Esc, Android
 * back, scrim, «Закрыть») reports the same `onDismiss`, so the offer is not
 * pushed again for the same `latestVersion`.
 *
 * The copy is the catalogue's `app.appVersion.soft.*`, the store action appears
 * only when the server sent a `storeUrl`. Nothing is destructive here, so the
 * layer is a regular `dialog` and focus lands on the title.
 */
export function AppUpdateSoftDialog({
  visible,
  storeUrl,
  onOpenStore,
  onDismiss,
  testID = "app-update-soft",
}: AppUpdateSoftDialogProps) {
  const t = useTranslations("app.appVersion.soft");
  const iconColor = useThemeColor("foreground");
  const hasStore = storeUrl !== null;

  return (
    <Dialog
      open={visible}
      title={t("title")}
      description={t("body")}
      onClose={onDismiss}
      testID={testID}
      closeAction={{
        label: t("close"),
        icon: <Close size={spacing["icon-nav"]} color={iconColor} testID={`${testID}-cross`} />,
      }}
      actions={
        <>
          {hasStore ? <Button label={t("update")} onPress={onOpenStore} /> : null}
          {/* The only action without a store link: it carries the primary weight. */}
          <Button
            label={t("close")}
            onPress={onDismiss}
            variant={hasStore ? "ghost" : "primary"}
          />
        </>
      }
    />
  );
}

AppUpdateSoftDialog.displayName = "AppUpdateSoftDialog";
