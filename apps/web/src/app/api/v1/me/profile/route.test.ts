import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUnique, update } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { user: { findUnique, update } } }));

import { GET, PATCH } from "./route";

const row = {
  id: "u1",
  email: "a@example.com",
  name: "Аня",
  nick: "anya",
  timeZone: null as string | null,
  hideFromSearch: false,
  birthDay: null as number | null,
  birthMonth: null as number | null,
  gender: null as "MALE" | "FEMALE" | null,
  country: null as string | null,
  about: null as string | null,
  profileVisibleToFriends: true,
};

function patch(body: string) {
  return new Request("http://x/api/v1/me/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body,
  });
}

beforeEach(() => {
  getSession.mockReset();
  findUnique.mockReset();
  update.mockReset();
  getSession.mockResolvedValue({ user: { id: "u1" }, session: { token: "t" } });
  findUnique.mockResolvedValue(row);
  update.mockResolvedValue({});
});

describe("GET /api/v1/me/profile", () => {
  it("answers the owner with every profile field, even when they are empty", async () => {
    const res = await GET(new Request("http://x/api/v1/me/profile"));

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({
      ok: true,
      data: {
        id: "u1",
        email: "a@example.com",
        name: "Аня",
        nick: "anya",
        timeZone: null,
        hideFromSearch: false,
        birthDay: null,
        birthMonth: null,
        gender: null,
        country: null,
        about: null,
        profileVisibleToFriends: true,
      },
    });
  });

  it("answers 401 UNAUTHENTICATED without a session", async () => {
    getSession.mockResolvedValue(null);

    const res = await GET(new Request("http://x/api/v1/me/profile"));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
  });
});

describe("PATCH /api/v1/me/profile", () => {
  it("writes the fields and answers the updated profile", async () => {
    const res = await PATCH(
      patch(
        JSON.stringify({
          birthDay: 29,
          birthMonth: 2,
          gender: "FEMALE",
          country: "by",
          about: "  Люблю книги.  ",
          profileVisibleToFriends: false,
        }),
      ),
    );

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: {
        birthDay: 29,
        birthMonth: 2,
        gender: "FEMALE",
        country: "BY",
        about: "Люблю книги.",
        profileVisibleToFriends: false,
      },
    });
    expect(await res.json()).toEqual({
      ok: true,
      data: {
        id: "u1",
        email: "a@example.com",
        name: "Аня",
        nick: "anya",
        timeZone: null,
        hideFromSearch: false,
        birthDay: 29,
        birthMonth: 2,
        gender: "FEMALE",
        country: "BY",
        about: "Люблю книги.",
        profileVisibleToFriends: false,
      },
    });
  });

  it("clears the profile with explicit nulls", async () => {
    findUnique.mockResolvedValue({
      ...row,
      birthDay: 1,
      birthMonth: 5,
      gender: "MALE",
      country: "BY",
      about: "Текст",
      profileVisibleToFriends: false,
    });

    const res = await PATCH(
      patch(
        JSON.stringify({
          birthDay: null,
          birthMonth: null,
          gender: null,
          country: null,
          about: null,
          profileVisibleToFriends: true,
        }),
      ),
    );

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: {
        birthDay: null,
        birthMonth: null,
        gender: null,
        country: null,
        about: null,
        profileVisibleToFriends: true,
      },
    });
    expect((await res.json()).data).toMatchObject({
      birthDay: null,
      birthMonth: null,
      gender: null,
      country: null,
      about: null,
      profileVisibleToFriends: true,
    });
  });

  it("is a no-op for an empty body and writes no row", async () => {
    const res = await PATCH(patch("{}"));

    expect(res.status).toBe(200);
    expect(update).not.toHaveBeenCalled();
    expect((await res.json()).data).toMatchObject({ id: "u1", profileVisibleToFriends: true });
  });

  it("answers 400 VALIDATION on birthDay for 30 February and writes nothing", async () => {
    const res = await PATCH(patch(JSON.stringify({ birthDay: 30, birthMonth: 2 })));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "birthDay",
    });
    expect(getSession).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("answers 400 VALIDATION on birthDay for half a birthday", async () => {
    const res = await PATCH(patch(JSON.stringify({ birthMonth: 5 })));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "birthDay",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("answers 400 with the offending field for a bad country, gender, about or switch", async () => {
    const country = await PATCH(patch(JSON.stringify({ country: "XX" })));
    expect(country.status).toBe(400);
    expect(await country.json()).toMatchObject({ code: "VALIDATION", field: "country" });

    const gender = await PATCH(patch(JSON.stringify({ gender: "OTHER" })));
    expect(gender.status).toBe(400);
    expect(await gender.json()).toMatchObject({ code: "VALIDATION", field: "gender" });

    const about = await PATCH(patch(JSON.stringify({ about: "я".repeat(501) })));
    expect(about.status).toBe(400);
    expect(await about.json()).toMatchObject({ code: "VALIDATION", field: "about" });

    const visible = await PATCH(patch(JSON.stringify({ profileVisibleToFriends: "true" })));
    expect(visible.status).toBe(400);
    expect(await visible.json()).toMatchObject({ code: "VALIDATION" });
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses a birth year as an unknown key", async () => {
    const res = await PATCH(patch(JSON.stringify({ birthYear: 1990 })));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "VALIDATION" });
    expect(update).not.toHaveBeenCalled();
  });

  it("answers 400 for broken JSON without calling the use-case", async () => {
    const res = await PATCH(patch("{not json"));

    expect(res.status).toBe(400);
    expect(getSession).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("other methods on /api/v1/me/profile", () => {
  it("POST is a NOT_FOUND envelope", async () => {
    const { POST } = await import("./route");
    const res = await POST();

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
  });
});
