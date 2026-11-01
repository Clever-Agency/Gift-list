import * as SecureStore from "expo-secure-store";

const KEY = "gift-list.auth.token";

export async function readSessionToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function writeSessionToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearSessionToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // A failed delete still continues; the next launch will retry.
  }
}
