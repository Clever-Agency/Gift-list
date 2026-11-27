import { describe, expect, it } from "vitest";
import { isWishExpirySoon, wishExpirySoonDay } from "./wish-expiry";

describe("Story 6.6: the «срок желания скоро» day", () => {
  it("counts three calendar days back across month and year ends", () => {
    expect(wishExpirySoonDay("2026-11-28")).toBe("2026-11-25");
    expect(wishExpirySoonDay("2026-03-01")).toBe("2026-02-26");
    expect(wishExpirySoonDay("2028-03-01")).toBe("2028-02-27");
    expect(wishExpirySoonDay("2026-01-02")).toBe("2025-12-30");
  });

  it("fires on the holder's day from 10:00 local time", () => {
    const expiresOn = "2026-11-28";
    const zone = "Europe/Minsk";

    // 10:00 and 10:01 in Minsk (UTC+3).
    expect(isWishExpirySoon(expiresOn, new Date("2026-11-25T07:00:00.000Z"), zone)).toBe(true);
    expect(isWishExpirySoon(expiresOn, new Date("2026-11-25T07:01:00.000Z"), zone)).toBe(true);
    // A later run on the same local day still sends it.
    expect(isWishExpirySoon(expiresOn, new Date("2026-11-25T20:59:00.000Z"), zone)).toBe(true);
    // 09:59 is too early.
    expect(isWishExpirySoon(expiresOn, new Date("2026-11-25T06:59:00.000Z"), zone)).toBe(false);
  });

  it("does not send the notice before or after that day", () => {
    const expiresOn = "2026-11-28";
    const zone = "Europe/Minsk";

    expect(isWishExpirySoon(expiresOn, new Date("2026-11-24T07:00:00.000Z"), zone)).toBe(false);
    expect(isWishExpirySoon(expiresOn, new Date("2026-11-26T07:00:00.000Z"), zone)).toBe(false);
    // Midnight after the soon day already belongs to the next day.
    expect(isWishExpirySoon(expiresOn, new Date("2026-11-25T21:00:00.000Z"), zone)).toBe(false);
  });

  it("uses UTC when the holder's zone is missing or unknown", () => {
    const expiresOn = "2026-01-02";

    expect(isWishExpirySoon(expiresOn, new Date("2025-12-30T10:00:00.000Z"), null)).toBe(true);
    expect(isWishExpirySoon(expiresOn, new Date("2025-12-30T09:59:00.000Z"), null)).toBe(false);
    expect(isWishExpirySoon(expiresOn, new Date("2025-12-30T10:00:00.000Z"), "Not/AZone")).toBe(true);
  });
});
