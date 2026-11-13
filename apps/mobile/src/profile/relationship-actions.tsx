import type { ProfileInviteCooldown, ProfileRelationship } from "@gift-list/contracts";
import { Button, RelationshipChip, Text, XStack } from "@gift-list/ui";
import { useTranslations } from "use-intl";
import type { RelationshipAction } from "./relationship-action";

export type RelationshipActionsProps = {
  /** The viewer's closed relation, or `NONE`; `SELF` is told by `ownProfile`. */
  relationship: ProfileRelationship;
  /** The live rejection window, or `null` when the server sent none. */
  inviteCooldown: ProfileInviteCooldown | null;
  /** The row is the viewer's own card: `PROFILE_RELATIONSHIPS` has no `SELF`. */
  ownProfile: boolean;
  /** One of the node's actions is in flight. */
  busy: boolean;
  onAction: (kind: RelationshipAction) => void;
  /**
   * The id namespace: `profile` keeps the profile ids, and a list row passes its
   * own prefix so two rows never share `data-testid`.
   */
  testIDPrefix?: string;
};

/**
 * Story 4.1.3 / 4.2.3: the relation of a person and the actions the viewer can
 * take, one closed set for the profile and the search row. `SELF` is not a
 * contract value: the screen compares the nick with the session and passes
 * `ownProfile`. The rejection window always wins over the relationship: a
 * rejection leaves no edge and no pending invite.
 *
 * The block is a sibling of the profile link, never its child: a press on a
 * button must not open the profile. The labels are the profile catalogue keys,
 * so both places speak the same words.
 */
export function RelationshipActions({
  relationship,
  inviteCooldown,
  ownProfile,
  busy,
  onAction,
  testIDPrefix = "profile",
}: RelationshipActionsProps) {
  const profile = useTranslations("app.profile");

  function acceptInvite() {
    onAction("accept");
  }

  function rejectInvite() {
    onAction("reject");
  }

  function addFriend() {
    onAction("add");
  }

  return (
    <XStack testID={`${testIDPrefix}-relationship`} alignItems="center" flexWrap="wrap" gap="$2">
      {ownProfile ? (
        <RelationshipChip
          label={profile("relationship.chips.SELF")}
          testID={`${testIDPrefix}-relationship-chip`}
        />
      ) : inviteCooldown !== null ? (
        inviteCooldown.rejected ? (
          <RelationshipChip
            label={profile("relationship.chips.REJECTED")}
            testID={`${testIDPrefix}-relationship-chip`}
          />
        ) : (
          <>
            <Button
              label={profile("relationship.addFriend")}
              disabled
              focusableWhenDisabled
              testID={`${testIDPrefix}-add-friend`}
            />
            <Text kind="caption" tone="muted" testID={`${testIDPrefix}-invite-cooldown`}>
              {profile("relationship.cooldown", { hours: inviteCooldown.hours })}
            </Text>
          </>
        )
      ) : relationship === "FRIENDS" ? (
        <RelationshipChip
          label={profile("relationship.chips.FRIENDS")}
          testID={`${testIDPrefix}-relationship-chip`}
        />
      ) : relationship === "OUTGOING_PENDING" ? (
        <RelationshipChip
          label={profile("relationship.chips.OUTGOING_PENDING")}
          testID={`${testIDPrefix}-relationship-chip`}
        />
      ) : relationship === "INCOMING_PENDING" ? (
        <>
          <RelationshipChip
            label={profile("relationship.chips.INCOMING_PENDING")}
            emphasis
            testID={`${testIDPrefix}-relationship-chip`}
          />
          <Button
            label={profile("relationship.acceptInvite")}
            onPress={acceptInvite}
            busy={busy}
            testID={`${testIDPrefix}-accept-invite`}
          />
          <Button
            label={profile("relationship.rejectInvite")}
            variant="ghost"
            onPress={rejectInvite}
            busy={busy}
            testID={`${testIDPrefix}-reject-invite`}
          />
        </>
      ) : (
        <Button
          label={profile("relationship.addFriend")}
          onPress={addFriend}
          busy={busy}
          testID={`${testIDPrefix}-add-friend`}
        />
      )}
    </XStack>
  );
}

RelationshipActions.displayName = "RelationshipActions";
