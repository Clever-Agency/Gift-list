import {
  isSubscriptionView,
  subscriptionViewKey,
  type SubscriptionView,
} from "./subscription-view.types";

/**
 * The remembered «Я подписан · Мои подписчики» switch of one person, kept in the
 * browser's local storage (Story 4.3, EXPERIENCE «Followers»). A missing value,
 * an unknown one and a blocked storage all fall back to the default, so a
 * private window never breaks the tab.
 */
export async function readSubscriptionView(nick: string): Promise<SubscriptionView | null> {
  try {
    const value = globalThis.localStorage?.getItem(subscriptionViewKey(nick));
    return isSubscriptionView(value) ? value : null;
  } catch {
    return null;
  }
}

export async function writeSubscriptionView(
  nick: string,
  view: SubscriptionView,
): Promise<void> {
  try {
    globalThis.localStorage?.setItem(subscriptionViewKey(nick), view);
  } catch {
    // A blocked storage only means the switch is not remembered; the tab still works.
  }
}
