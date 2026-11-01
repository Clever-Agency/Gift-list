import * as SecureStore from "expo-secure-store";

const KEY = "giftlist.session-token";

export async function getSessionToken(): Promise<string | null> {
  // A read failure must surface: swallowing it would send the request without Bearer.
  return SecureStore.getItemAsync(KEY);
}

export async function setSessionToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearSessionToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Nothing to delete or store unavailable: the session is gone either way.
  }
}
