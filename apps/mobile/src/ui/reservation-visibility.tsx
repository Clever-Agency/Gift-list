import { Pressable, Switch, Text, XStack, YStack } from "@gift-list/ui";
import { useTranslations } from "use-intl";

export type ReservationVisibilityValues = {
  holderVisibleToOwner: boolean;
  holderVisibleToOthers: boolean;
};

export type ReservationVisibilityProps = {
  /** The block is collapsed by default: its switches are not in the tree until opened. */
  expanded: boolean;
  onToggle: () => void;
  values: ReservationVisibilityValues;
  /** A request of this card is in flight: the switches show the stored value only. */
  busy?: boolean;
  /** The whole pair travels with one action, so only the changed half is replaced. */
  onChange: (next: ReservationVisibilityValues) => void;
  testID?: string;
};

/**
 * «Кто видит, что это я» (Story 5.5, `DESIGN.md` → ReservationCard,
 * `EXPERIENCE.md` → Reservation actions): the two holder switches of one
 * reservation, collapsed under a button with `aria-expanded`. Both values travel
 * in one `visibility` action, so the component reports the whole pair and the
 * screen stays the one place that decides what is sent.
 *
 * The hint under «Показать владельцу, что это я» appears while the switch is on:
 * the owner learns the name at once, and turning it off later cannot unlearn it
 * (FR-31).
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

  function changeOwner(next: boolean) {
    onChange({ ...values, holderVisibleToOwner: next });
  }

  function changeOthers(next: boolean) {
    onChange({ ...values, holderVisibleToOthers: next });
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
            label={t("owner")}
            checked={values.holderVisibleToOwner}
            disabled={busy}
            onChange={changeOwner}
            testID={testID ? `${testID}-owner` : undefined}
          />
          {values.holderVisibleToOwner ? (
            <Text kind="caption" tone="muted">
              {t("hint")}
            </Text>
          ) : null}
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
