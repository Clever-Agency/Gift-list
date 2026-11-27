import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getSession,
  findUser,
  findList,
  findGifts,
  findDates,
  relationsBetween,
  profileRelationship,
  profileSubscription,
} = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUser: vi.fn(),
  findList: vi.fn(),
  findGifts: vi.fn(),
  findDates: vi.fn(),
  relationsBetween: vi.fn(),
  profileRelationship: vi.fn(),
  profileSubscription: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({
  prisma: {
    user: { findUnique: findUser },
    list: { findUnique: findList },
    gift: { findMany: findGifts, count: () => Promise.resolve(0) },
    userDate: { findMany: findDates },
    $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
  },
}));
vi.mock("@/lib/relationships", async function relationships(importOriginal) {
  const actual = await importOriginal<typeof import("@/lib/relationships")>();
  return {
    ...actual,
    relationshipReader: { relationsBetween },
    readProfileRelationship: profileRelationship,
    readProfileInviteCooldown: async () => null,
    readProfileSubscription: profileSubscription,
  };
});

import type { ActionResult, ListData } from "@gift-list/contracts";
import { getProfileByNick } from "@/actions/profile";

const OWNER = "u1";
const VIEWER = "u9";
const headers = new Headers({ "accept-language": "ru-RU,ru;q=0.9" });

const owner = {
  id: OWNER,
  name: "Анна",
  nick: "Anna",
  birthDay: null,
  birthMonth: null,
  gender: null,
  country: null,
  about: null,
  profileVisibleToFriends: true,
};

/** Four rows: every visibility pair the profile policy has to tell apart. */
const dates = [
  {
    id: "d-only",
    kind: "CUSTOM",
    title: "Только я",
    day: 1,
    month: 1,
    year: 1990,
    visibility: "ONLY_ME",
    yearVisibility: "EVERYONE",
  },
  {
    id: "d-friends",
    kind: "CUSTOM",
    title: "Для друзей",
    day: 2,
    month: 2,
    year: 2001,
    visibility: "FRIENDS",
    yearVisibility: "ONLY_ME",
  },
  {
    id: "d-every",
    kind: "CUSTOM",
    title: "Для всех",
    day: 3,
    month: 3,
    year: 1985,
    visibility: "EVERYONE",
    yearVisibility: "ONLY_ME",
  },
  {
    id: "d-year",
    kind: "CUSTOM",
    title: "Для всех с годом",
    day: 4,
    month: 4,
    year: 1985,
    visibility: "EVERYONE",
    yearVisibility: "EVERYONE",
  },
];

function openProfile(actor: string | null = VIEWER): Promise<ActionResult<ListData>> {
  getSession.mockResolvedValue(
    actor === null ? null : { user: { id: actor }, session: { token: "t" } },
  );
  return getProfileByNick("Anna", headers);
}

function expectOk(result: ActionResult<ListData>): ListData {
  if (!result.ok) throw new Error(`unexpected error: ${result.code}`);
  return result.data;
}

beforeEach(() => {
  getSession.mockReset();
  findUser.mockReset();
  findList.mockReset();
  findGifts.mockReset();
  findDates.mockReset();
  relationsBetween.mockReset();
  profileRelationship.mockReset();
  profileSubscription.mockReset();

  findUser.mockResolvedValue(owner);
  findList.mockResolvedValue({
    id: "l1",
    ownerId: OWNER,
    publicToken: "tok",
    owner: { name: "Анна", nick: "Anna" },
  });
  findGifts.mockResolvedValue([]);
  findDates.mockResolvedValue(dates);
  relationsBetween.mockResolvedValue({
    blocked: false,
    friend: false,
    subscriber: false,
    contactMatch: false,
  });
  profileRelationship.mockResolvedValue("NONE");
  profileSubscription.mockResolvedValue(false);
});

describe("AD-23 — личные даты в профиле /u/:nick", () => {
  it("владелец видит все свои даты и все годы", async () => {
    const data = expectOk(await openProfile(OWNER));

    expect(data.dates?.map((date) => date.id)).toEqual([
      "d-only",
      "d-friends",
      "d-every",
      "d-year",
    ]);
    expect(data.dates?.map((date) => date.year)).toEqual([1990, 2001, 1985, 1985]);
    // The visibility switches are the owner's own settings of `/me/dates`.
    expect(JSON.stringify(data.dates)).not.toContain("visibility");
  });

  it("друг видит FRIENDS и EVERYONE, но закрытый год приходит null", async () => {
    relationsBetween.mockResolvedValue({
      blocked: false,
      friend: true,
      subscriber: false,
      contactMatch: false,
    });
    profileRelationship.mockResolvedValue("FRIENDS");

    const data = expectOk(await openProfile());

    expect(data.dates?.map((date) => date.id)).toEqual(["d-friends", "d-every", "d-year"]);
    expect(data.dates?.find((date) => date.id === "d-friends")?.year).toBeNull();
    expect(data.dates?.find((date) => date.id === "d-year")?.year).toBe(1985);
    expect(JSON.stringify(data)).not.toContain("Только я");
  });

  it("подписчик видит только EVERYONE и только открытый год", async () => {
    relationsBetween.mockResolvedValue({
      blocked: false,
      friend: false,
      subscriber: true,
      contactMatch: false,
    });
    profileSubscription.mockResolvedValue(true);

    const data = expectOk(await openProfile());

    expect(data.dates?.map((date) => date.id)).toEqual(["d-every", "d-year"]);
    expect(data.dates?.map((date) => date.year)).toEqual([null, 1985]);
    expect(JSON.stringify(data)).not.toContain("Для друзей");
    expect(JSON.stringify(data)).not.toContain("Только я");
  });

  it("не отдаёт пустой ключ dates, когда зрителю не видно ни одной даты", async () => {
    relationsBetween.mockResolvedValue({
      blocked: false,
      friend: false,
      subscriber: true,
      contactMatch: false,
    });
    profileSubscription.mockResolvedValue(true);
    findDates.mockResolvedValue(dates.filter((date) => date.visibility !== "EVERYONE"));

    const data = expectOk(await openProfile());

    expect(data).not.toHaveProperty("dates");
  });

  it("Block в любую сторону — тот же закрытый 404, даты даже не читаются", async () => {
    relationsBetween.mockResolvedValue({
      blocked: true,
      friend: false,
      subscriber: false,
      contactMatch: false,
    });

    const result = await openProfile();

    expect(result).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
    expect(findDates).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("Годовщина");
  });

  it("аноним получает UNAUTHENTICATED: /u/:nick остаётся только для вошедших (AD-6)", async () => {
    const result = await openProfile(null);

    expect(result).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    expect(findDates).not.toHaveBeenCalled();
  });
});
