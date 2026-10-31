import * as SecureStore from "expo-secure-store";

export function secureStoreAvailable(): boolean {
  return typeof SecureStore.getItemAsync === "function";
}
