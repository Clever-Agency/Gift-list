const zones = new Set<string>(
  typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [],
);
zones.add("UTC");

/** IANA zone from the closed runtime list, otherwise `UTC`. */
export function canonicalTimeZone(input: unknown): string {
  if (typeof input === "string" && zones.has(input)) return input;
  return "UTC";
}

/** `null` and blank mean the client has not reported a zone yet. */
export function storedTimeZone(value: string | null | undefined): string | null {
  if (value == null || value.trim() === "") return null;
  return value;
}
