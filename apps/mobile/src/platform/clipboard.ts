/**
 * Story 2.4: writes one line of plain text to the clipboard of the browser.
 *
 * `navigator.clipboard` needs a secure context and a user gesture; where it is
 * missing (an embedded browser, an old one) the selection + `execCommand("copy")`
 * fallback is used, the same path `expo-clipboard` takes on the web. On the phone
 * the sibling `clipboard.native.ts` delegates to `expo-clipboard`.
 *
 * A refused write is `false`: the caller shows the failure toast instead of
 * claiming the link is copied.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // No permission or no secure context: try the legacy path below.
  }
  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  if (typeof document === "undefined") return false;
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}
