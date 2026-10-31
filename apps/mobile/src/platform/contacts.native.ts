import * as Contacts from "expo-contacts";

/** Presence check only. Permission is not requested (Story 1.3). */
export function contactsAvailable(): boolean {
  return typeof Contacts.getContactsAsync === "function";
}
