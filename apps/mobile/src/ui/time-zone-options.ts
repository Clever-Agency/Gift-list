import type { PickerOption } from "./option-field";

/**
 * Story 7.2 (FR-37): the IANA zones a person can choose for the reminders and
 * the reservation deadline. The list is the runtime's own (`Intl`), so no zone
 * table and no new dependency ships with the app. `UTC` is always offered.
 */
function supportedZones(): readonly string[] | null {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  if (typeof intl.supportedValuesOf !== "function") return null;
  try {
    const zones = intl.supportedValuesOf("timeZone");
    return Array.isArray(zones) ? zones : null;
  } catch {
    return null;
  }
}

/** «UTC+3» for a zone right now; the hour offset follows the current DST rule. */
export function timeZoneOffset(zone: string, now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    }).formatToParts(now);
    const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
    // `shortOffset` writes «GMT+3»; the interface and the story use «UTC+3».
    return name.replace("GMT", "UTC");
  } catch {
    return "";
  }
}

/** The visible row of one zone: the IANA name and its current offset. */
export function timeZoneLabel(zone: string, now: Date = new Date()): string {
  if (zone === "UTC") return "UTC";
  const offset = timeZoneOffset(zone, now);
  return offset === "" ? zone : `${zone} (${offset})`;
}

/**
 * The zones of the picker, sorted by name. The current zone is kept even when the
 * runtime does not list it (an old alias), so the chosen value is always shown.
 * Without `Intl.supportedValuesOf` the list shrinks to the current zone and UTC —
 * the short fallback the story asks for.
 */
export function timeZoneOptions(
  current: string | null,
  zones: readonly string[] | null = supportedZones(),
  now: Date = new Date(),
): PickerOption[] {
  const fallback = [current ?? "UTC", "UTC"];
  const source = zones ?? fallback;
  const values = new Set(source.filter((zone) => zone.length > 0));
  if (current) values.add(current);
  values.add("UTC");

  return [...values]
    .map(function makeOption(zone) {
      return { value: zone, label: timeZoneLabel(zone, now) };
    })
    .sort(function compareLabels(left, right) {
      return left.label.localeCompare(right.label, "en");
    });
}
