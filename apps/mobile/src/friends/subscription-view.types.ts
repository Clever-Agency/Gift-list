/**
 * Story 4.3 · EXPERIENCE «Followers»: the «Я подписан · Мои подписчики» switch
 * stays where the person left it. The choice is local to the device, not the
 * server: it is a view preference and never leaves the app.
 */
export const SUBSCRIPTION_VIEWS = ["subscribed", "subscribers"] as const;

export type SubscriptionView = (typeof SUBSCRIPTION_VIEWS)[number];

/** The view a person sees before they ever touch the switch. */
export const DEFAULT_SUBSCRIPTION_VIEW: SubscriptionView = "subscribed";

export function isSubscriptionView(value: unknown): value is SubscriptionView {
  return typeof value === "string" && (SUBSCRIPTION_VIEWS as readonly string[]).includes(value);
}

/**
 * One key per person: two accounts on one device do not share the switch, and a
 * renamed nick simply starts from the default again.
 */
export function subscriptionViewKey(nick: string): string {
  return `gift-list.friends.subscription-view.${nick.toLowerCase()}`;
}
