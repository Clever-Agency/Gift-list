import { Button } from "@gift-list/ui";
import { useTranslations } from "use-intl";
import type { SubscriptionAction } from "./subscription-action";

export type SubscriptionActionsProps = {
  /** The server's viewer-to-owner fact: `true` shows «Отписаться». */
  subscribed: boolean;
  /** A subscription press is in flight. */
  busy: boolean;
  onAction: (kind: SubscriptionAction) => void;
  /** The id namespace, so the profile and a future list row never share ids. */
  testIDPrefix?: string;
};

/**
 * Story 4.6 (FR-46, AD-19): the one-way subscription switch of a profile. The
 * label is the current fact, not a direction: «Подписаться» while the viewer
 * has no edge, «Отписаться» once the server reports one. A subscription is not
 * a friendship, so the button sits next to the friend action instead of
 * replacing it. The screen hides it for the viewer's own profile and for a
 * friend, who already sees more than a subscriber (EXPERIENCE «Профиль»).
 */
export function SubscriptionActions({
  subscribed,
  busy,
  onAction,
  testIDPrefix = "profile",
}: SubscriptionActionsProps) {
  const profile = useTranslations("app.profile");

  function toggleSubscription() {
    onAction(subscribed ? "unsubscribe" : "subscribe");
  }

  return (
    <Button
      label={profile(subscribed ? "subscription.unsubscribe" : "subscription.subscribe")}
      variant="ghost"
      onPress={toggleSubscription}
      busy={busy}
      testID={`${testIDPrefix}-subscription`}
    />
  );
}

SubscriptionActions.displayName = "SubscriptionActions";
