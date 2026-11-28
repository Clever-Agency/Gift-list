import { describe, expect, it } from "vitest";
import { profileFieldsForWrite } from "./profile";

describe("profileFieldsForWrite (CLE-129/T8.1, D-58, AD-29)", () => {
  it("keeps only the keys the body carries", () => {
    expect(profileFieldsForWrite({})).toEqual({ ok: true, data: {} });
    expect(profileFieldsForWrite({ gender: "MALE" })).toEqual({
      ok: true,
      data: { gender: "MALE" },
    });
  });

  it("writes a real birthday pair and allows 29 February", () => {
    expect(profileFieldsForWrite({ birthDay: 29, birthMonth: 2 })).toEqual({
      ok: true,
      data: { birthDay: 29, birthMonth: 2 },
    });
    expect(profileFieldsForWrite({ birthDay: 31, birthMonth: 12 })).toEqual({
      ok: true,
      data: { birthDay: 31, birthMonth: 12 },
    });
  });

  it("refuses 30 February, 31 April and a day out of range on birthDay", () => {
    expect(profileFieldsForWrite({ birthDay: 30, birthMonth: 2 })).toEqual({
      ok: false,
      field: "birthDay",
    });
    expect(profileFieldsForWrite({ birthDay: 31, birthMonth: 4 })).toEqual({
      ok: false,
      field: "birthDay",
    });
    expect(profileFieldsForWrite({ birthDay: 32, birthMonth: 1 })).toEqual({
      ok: false,
      field: "birthDay",
    });
    expect(profileFieldsForWrite({ birthDay: 0, birthMonth: 1 })).toEqual({
      ok: false,
      field: "birthDay",
    });
  });

  it("refuses half a birthday and clears the whole pair together", () => {
    expect(profileFieldsForWrite({ birthDay: 5 })).toEqual({ ok: false, field: "birthDay" });
    expect(profileFieldsForWrite({ birthMonth: 5 })).toEqual({ ok: false, field: "birthDay" });
    expect(profileFieldsForWrite({ birthDay: 5, birthMonth: null })).toEqual({
      ok: false,
      field: "birthDay",
    });
    expect(profileFieldsForWrite({ birthDay: null, birthMonth: null })).toEqual({
      ok: true,
      data: { birthDay: null, birthMonth: null },
    });
  });

  it("normalizes the country and refuses a code outside ISO 3166-1", () => {
    expect(profileFieldsForWrite({ country: " by " })).toEqual({ ok: true, data: { country: "BY" } });
    expect(profileFieldsForWrite({ country: null })).toEqual({ ok: true, data: { country: null } });
    expect(profileFieldsForWrite({ country: "XX" })).toEqual({ ok: false, field: "country" });
  });

  it("trims «Обо мне», clears a blank text and caps it at 500 characters", () => {
    expect(profileFieldsForWrite({ about: "  Привет  " })).toEqual({
      ok: true,
      data: { about: "Привет" },
    });
    expect(profileFieldsForWrite({ about: "   " })).toEqual({ ok: true, data: { about: null } });
    expect(profileFieldsForWrite({ about: null })).toEqual({ ok: true, data: { about: null } });
    expect(profileFieldsForWrite({ about: "я".repeat(500) }).ok).toBe(true);
    expect(profileFieldsForWrite({ about: `  ${"я".repeat(500)}  ` }).ok).toBe(true);
    expect(profileFieldsForWrite({ about: "я".repeat(501) })).toEqual({
      ok: false,
      field: "about",
    });
  });

  it("passes the visibility switch through", () => {
    expect(profileFieldsForWrite({ profileVisibleToFriends: false })).toEqual({
      ok: true,
      data: { profileVisibleToFriends: false },
    });
  });
});
