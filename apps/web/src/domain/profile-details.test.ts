// CLE-129/T8.2 (AD-7 ред. 2026-11-26, AD-29): who gets somebody's profile fields.
import { describe, expect, it } from "vitest";
import {
  canSeeProfileDetails,
  profileDetailsFor,
  toVisibleProfileDetails,
  type ProfileDetailsRow,
} from "./profile-details";

const ANNA = { id: "u1", profileVisibleToFriends: true } as const;
const ANNA_CLOSED = { id: "u1", profileVisibleToFriends: false } as const;
const VIEWER = { id: "u9" } as const;

const ROW: ProfileDetailsRow = {
  birthDay: 14,
  birthMonth: 6,
  gender: "FEMALE",
  country: "BY",
  about: "Люблю походы и книги.",
};

const DETAIL_KEYS = ["about", "birthDay", "birthMonth", "country", "gender"];
const OWN_KEYS = [...DETAIL_KEYS, "profileVisibleToFriends"].sort();

describe("ProfileDetailsPolicy — кто видит поля профиля (AD-7/AD-29)", () => {
  it("self: видит всегда, в том числе при выключенном переключателе", () => {
    for (const owner of [ANNA, ANNA_CLOSED]) {
      expect(canSeeProfileDetails(owner, owner, { friend: false })).toBe(true);
    }
  });

  it("друг при включённом переключателе видит поля", () => {
    expect(canSeeProfileDetails(VIEWER, ANNA, { friend: true })).toBe(true);
  });

  it("друг при выключенном переключателе не видит полей", () => {
    expect(canSeeProfileDetails(VIEWER, ANNA_CLOSED, { friend: true })).toBe(false);
  });

  it("подписчик без дружбы не видит полей", () => {
    expect(canSeeProfileDetails(VIEWER, ANNA, { friend: false })).toBe(false);
  });

  it("не-друг не видит полей", () => {
    expect(canSeeProfileDetails(VIEWER, ANNA, { friend: false })).toBe(false);
  });

  it("аноним не видит полей даже как «друг»", () => {
    expect(canSeeProfileDetails(null, ANNA, { friend: true })).toBe(false);
    expect(canSeeProfileDetails(null, ANNA_CLOSED, { friend: true })).toBe(false);
  });

  it("Block — это закрытый 404 до этой политики, поэтому факта block у неё нет", () => {
    // The type carries one fact on purpose; an impossible state cannot be passed.
    expect(Object.keys({ friend: false })).toEqual(["friend"]);
    expect(canSeeProfileDetails(VIEWER, ANNA, { friend: false })).toBe(false);
  });
});

describe("profileDetailsFor — маппер блока details", () => {
  it("другу отдаёт ровно пять полей и никогда переключатель", () => {
    const details = profileDetailsFor(VIEWER, ANNA, { friend: true }, ROW);

    expect(details).toEqual(ROW);
    expect(Object.keys(details ?? {}).sort()).toEqual(DETAIL_KEYS);
    expect(details).not.toHaveProperty("profileVisibleToFriends");
  });

  it("себе отдаёт поля вместе с переключателем", () => {
    const details = profileDetailsFor(ANNA, ANNA, { friend: false }, ROW);

    expect(details).toEqual({ ...ROW, profileVisibleToFriends: true });
    expect(Object.keys(details ?? {}).sort()).toEqual(OWN_KEYS);

    const closed = profileDetailsFor(ANNA_CLOSED, ANNA_CLOSED, { friend: false }, ROW);
    expect(closed?.profileVisibleToFriends).toBe(false);
  });

  it("остальным не отдаёт блок вообще — ключа details нет, а не null", () => {
    expect(profileDetailsFor(VIEWER, ANNA, { friend: false }, ROW)).toBeUndefined();
    expect(profileDetailsFor(VIEWER, ANNA_CLOSED, { friend: true }, ROW)).toBeUndefined();
    expect(profileDetailsFor(null, ANNA, { friend: true }, ROW)).toBeUndefined();
  });

  it("не подменяет «не задано» отсутствием ключа внутри блока", () => {
    const empty = toVisibleProfileDetails({
      birthDay: null,
      birthMonth: null,
      gender: null,
      country: null,
      about: null,
    });

    expect(Object.keys(empty).sort()).toEqual(DETAIL_KEYS);
    expect(empty).toEqual({
      birthDay: null,
      birthMonth: null,
      gender: null,
      country: null,
      about: null,
    });
  });
});
