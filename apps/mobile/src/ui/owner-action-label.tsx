import { Button, Text, XStack, YStack } from "@gift-list/ui";
import { useTranslations } from "use-intl";

export type OwnerActionLabelProps = {
  /**
   * The `ownerAction` of the owner card. Story 5.6 draws only the expired
   * reservation; `CONFIRM_GIVEN` is Story 5.7 and keeps the plain card line.
   */
  action: "EXPIRED_NO_REPLY";
  /** The keep request is in flight: both answers are blocked until it settles. */
  busy?: boolean;
  /** «Получил»: opens the existing close confirm of Story 5.3. */
  onReceived: () => void;
  /** «Не получал, оставить бронь»: the keep request of Story 5.6. */
  onKeep: () => void;
};

/**
 * `DESIGN.md` → OwnerActionLabel, `EXPERIENCE.md` → «Подписи брони» (Story 5.6):
 * the muted strip with a 3 px accent edge that replaces the reservation line when
 * the owner has to answer. The label spells the phase out; the two secondary
 * answers are ordinary buttons of their own (never nested in the card button), so
 * Tab reaches each one and a busy answer cannot be pressed twice.
 *
 * Texts come only from the i18n catalog: `app.gift.ownerAction.*` and the new
 * `app.gift.ownerRequest.received` / `.keep` of Story 5.6.
 */
export function OwnerActionLabel({
  action,
  busy = false,
  onReceived,
  onKeep,
}: OwnerActionLabelProps) {
  const tAction = useTranslations("app.gift.ownerAction");
  const tRequest = useTranslations("app.gift.ownerRequest");

  return (
    <YStack
      testID="owner-action-label"
      backgroundColor="$muted"
      borderLeftWidth={3}
      borderLeftColor="$accent-foreground"
      borderRadius="$md"
      paddingVertical="$2"
      paddingHorizontal="$3"
      gap="$2"
    >
      <Text kind="label">{tAction(action)}</Text>
      <XStack flexWrap="wrap" alignItems="flex-start" gap="$2">
        <Button
          label={tRequest("received")}
          variant="secondary"
          onPress={onReceived}
          busy={busy}
          testID="owner-action-received"
        />
        <Button
          label={tRequest("keep")}
          variant="secondary"
          onPress={onKeep}
          busy={busy}
          testID="owner-action-keep"
        />
      </XStack>
    </YStack>
  );
}

OwnerActionLabel.displayName = "OwnerActionLabel";
