// AD-15 (10): a subscriber reads PUBLIC wishes only, and AD-23 keeps the same
// boundary for personal dates — a subscriber gets `EVERYONE` dates and never
// `FRIENDS` or `ONLY_ME`. The check goes through `getProfileByNick`, the one
// gate of `/u/:nick`, with only the database and the relation readers faked.
//
// Canonical pieces stay where they are: `domain/personal-dates.test.ts` owns the
// matrix (owner, friend, subscriber, anonymous, block, `/l/:token`) and the
// subscriber row of `README.md` points here for the use-case level.
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
const SUBSCRIBER = "u9";
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
    title: "Только друзьям",
    day: 2,
    month: 2,
    year: 2001,
    visibility: "FRIENDS",
    yearVisibility: "EVERYONE",
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

function openProfile(): Promise<ActionResult<ListData>> {
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

  getSession.mockResolvedValue({ user: { id: SUBSCRIBER }, session: { token: "t" } });
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
    subscriber: true,
    contactMatch: false,
  });
  profileRelationship.mockResolvedValue("NONE");
  profileSubscription.mockResolvedValue(true);
});

describe("AD-15 (10) — подписчик не получает даты FRIENDS и ONLY_ME", () => {
  it("отдаёт только EVERYONE и не называет скрытые даты", async () => {
    const data = expectOk(await openProfile());

    expect(relationsBetween).toHaveBeenCalledWith(SUBSCRIBER, OWNER);
    expect(data.dates?.map((date) => date.id)).toEqual(["d-every", "d-year"]);

    const body = JSON.stringify(data);
    expect(body).not.toContain("Только я");
    expect(body).not.toContain("Только друзьям");
  });

  it("не открывает год по «все» у самой даты: год решает yearVisibility", async () => {
    const data = expectOk(await openProfile());

    // `d-every` is an EVERYONE date whose year is ONLY_ME, so its year is null;
    // `d-year` opens the year to everyone as a separate switch.
    expect(data.dates?.find((date) => date.id === "d-every")?.year).toBeNull();
    expect(data.dates?.find((date) => date.id === "d-year")?.year).toBe(1985);
  });
});
