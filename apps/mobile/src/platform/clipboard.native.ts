import * as Clipboard from "expo-clipboard";

/**
 * Story 2.4: writes one line of plain text to the system clipboard on the phone
 * (Android, iOS). `expo-clipboard` owns the platform call; the web sibling
 * `clipboard.ts` uses `navigator.clipboard` instead.
 *
 * A refused write (no permission, a platform quirk) is `false`: the caller shows
 * the failure toast instead of claiming the link is copied.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    return await Clipboard.setStringAsync(text);
  } catch {
    return false;
  }
}
