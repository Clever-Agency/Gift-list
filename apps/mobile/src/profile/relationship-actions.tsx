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
   * Story 4.4: the profile shows «Удалить из друзей» next to the «Друзья» chip.
   * A search row passes nothing, so the action stays on `/u/:nick` alone.
   */
  onRemoveFriend?: () => void;
  /**
   * Story 4.5: «Заблокировать» stands next to the other buttons on the profile
   * and the search row; a circle list keeps it in its ⋮ menu instead. The own
   * card passes nothing: «Это вы» has no menu and no action.
   */
  onBlock?: () => void;
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
 *
 * Story 4.4: `onRemoveFriend` adds «Удалить из друзей» next to the «Друзья»
 * chip. Only the profile passes it; a search row keeps the chip alone.
 *
 * Story 4.5: `onBlock` adds the ghost «Заблокировать» — the profile and the
 * search row pass it, a circle list keeps the action in its ⋮ menu.
 */
export function RelationshipActions({
  relationship,
  inviteCooldown,
  ownProfile,
  busy,
  onAction,
  onRemoveFriend,
  onBlock,
  testIDPrefix = "profile",
}: RelationshipActionsProps) {
  const profile = useTranslations("app.profile");
  const friends = useTranslations("app.friends");

  function acceptInvite() {
    onAction("accept");
  }

  function rejectInvite() {
    onAction("reject");
  }

  function addFriend() {
    onAction("add");
  }

  function removeFriend() {
    if (onRemoveFriend !== undefined) onRemoveFriend();
  }

  function block() {
    if (onBlock !== undefined) onBlock();
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
        <>
          <RelationshipChip
            label={profile("relationship.chips.FRIENDS")}
            testID={`${testIDPrefix}-relationship-chip`}
          />
          {onRemoveFriend === undefined ? null : (
            <Button
              label={profile("relationship.removeFriend")}
              variant="ghost"
              onPress={removeFriend}
              busy={busy}
              testID={`${testIDPrefix}-remove-friend`}
            />
          )}
        </>
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
      {onBlock === undefined ? null : (
        <Button
          label={friends("menu.block")}
          variant="ghost"
          onPress={block}
          testID={`${testIDPrefix}-block`}
        />
      )}
    </XStack>
  );
}

RelationshipActions.displayName = "RelationshipActions";
