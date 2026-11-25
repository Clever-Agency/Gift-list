import { Pressable, Switch, Text, XStack, YStack } from "@gift-list/ui";
import { useTranslations } from "use-intl";

export type ReservationVisibilityValues = {
  holderVisibleToOthers: boolean;
};

export type ReservationVisibilityProps = {
  /** The block is collapsed by default: the switch is not in the tree until opened. */
  expanded: boolean;
  onToggle: () => void;
  values: ReservationVisibilityValues;
  /** A request of this card is in flight: the switch shows the stored value only. */
  busy?: boolean;
  /** The value travels with one `visibility` action owned by the screen. */
  onChange: (next: ReservationVisibilityValues) => void;
  testID?: string;
};

/**
 * «Кто видит, что это я» (Story 5.5, `DESIGN.md` → ReservationCard,
 * `EXPERIENCE.md` → Reservation actions): the holder's visibility switch,
 * collapsed under a button with `aria-expanded`. CLE-124/D-49 removed the
 * «Показать владельцу» switch: the owner never learns about a reservation, so
 * only «Показать другим, кто берёт» is left. Its value travels in the
 * `visibility` action, and the screen stays the one place that decides what is
 * sent.
 */
export function ReservationVisibility({
  expanded,
  onToggle,
  values,
  busy,
  onChange,
  testID,
}: ReservationVisibilityProps) {
  const t = useTranslations("app.reservations.visibility");

  function changeOthers(next: boolean) {
    onChange({ holderVisibleToOthers: next });
  }

  return (
    <YStack gap="$1" width="100%" testID={testID}>
      <Pressable
        aria-expanded={expanded}
        onPress={onToggle}
        minHeight="$touch-target"
        justifyContent="center"
        testID={testID ? `${testID}-toggle` : undefined}
      >
        <XStack alignItems="center" gap="$1">
          {/* The chevron is the visible state of `aria-expanded`, not a second name. */}
          <Text kind="body" aria-hidden>
            {expanded ? "▾" : "▸"}
          </Text>
          <Text kind="button" tone="primary" flexShrink={1}>
            {t("title")}
          </Text>
        </XStack>
      </Pressable>
      {expanded ? (
        <YStack gap="$1" testID={testID ? `${testID}-options` : undefined}>
          <Switch
            label={t("others")}
            checked={values.holderVisibleToOthers}
            disabled={busy}
            onChange={changeOthers}
            testID={testID ? `${testID}-others` : undefined}
          />
        </YStack>
      ) : null}
    </YStack>
  );
}

ReservationVisibility.displayName = "ReservationVisibility";
