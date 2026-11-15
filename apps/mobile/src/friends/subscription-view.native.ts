import * as SecureStore from "expo-secure-store";
import {
  isSubscriptionView,
  subscriptionViewKey,
  type SubscriptionView,
} from "./subscription-view.types";

/**
 * The remembered «Я подписан · Мои подписчики» switch of one person on a phone
 * (Story 4.3, EXPERIENCE «Followers»). There is no web storage in React Native,
 * so the small preference uses the key-value store the app already ships with.
 * A missing value, an unknown one and a failed read all fall back to the default.
 */
export async function readSubscriptionView(nick: string): Promise<SubscriptionView | null> {
  try {
    const value = await SecureStore.getItemAsync(subscriptionViewKey(nick));
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
    await SecureStore.setItemAsync(subscriptionViewKey(nick), view);
  } catch {
    // A failed write only means the switch is not remembered; the tab still works.
  }
}
