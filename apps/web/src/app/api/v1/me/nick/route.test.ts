import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUnique, findFirst, update } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { user: { findUnique, findFirst, update } } }));
vi.mock("@/db/generated/client", () => ({
  Prisma: { PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {} },
}));

import { GET, PUT } from "./route";

const user = {
  id: "u1",
  email: "a@example.com",
  name: "Анна",
  nick: "anna",
  nickNormalized: "anna",
  timeZone: null as string | null,
};

function put(body: string) {
  return new Request("http://x/api/v1/me/nick", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body,
  });
}

beforeEach(() => {
  getSession.mockReset();
  findUnique.mockReset();
  findFirst.mockReset();
  update.mockReset();
  getSession.mockResolvedValue({ user: { id: "u1" }, session: { token: "t" } });
  findUnique.mockResolvedValue(user);
  findFirst.mockResolvedValue(null);
  update.mockResolvedValue({});
});

describe("PUT /api/v1/me/nick", () => {
  it("changes the nick and answers the updated user in the AD-12 envelope", async () => {
    const res = await PUT(put(JSON.stringify({ nick: "newnick" })));

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({
      ok: true,
      data: {
        id: "u1",
        email: "a@example.com",
        name: "Анна",
        nick: "newnick",
        timeZone: null,
      },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { nick: "newnick", nickNormalized: "newnick" },
    });
  });

  it("answers 400 VALIDATION with field nick for a short nick", async () => {
    const res = await PUT(put(JSON.stringify({ nick: "ab" })));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "nick",
    });
    expect(getSession).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("accepts a nick at the cap and rejects one character more", async () => {
    const atCap = await PUT(put(JSON.stringify({ nick: "a".repeat(24) })));
    expect(atCap.status).toBe(200);

    const overCap = await PUT(put(JSON.stringify({ nick: "a".repeat(25) })));
    expect(overCap.status).toBe(400);
    expect(await overCap.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "nick",
    });
  });

  it("answers 400 for broken JSON without calling the use-case", async () => {
    const res = await PUT(put("{not json"));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
    });
    expect(getSession).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("answers 413 with the size reason before the session or the database", async () => {
    const res = await PUT(put(JSON.stringify({ nick: "a".repeat(40_000) })));

    expect(res.status).toBe(413);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Payload too large",
      reason: "PAYLOAD_TOO_LARGE",
    });
    expect(getSession).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("answers a taken nick with 400 and NICK_TAKEN", async () => {
    findFirst.mockResolvedValue({ id: "u2" });
    const res = await PUT(put(JSON.stringify({ nick: "newnick" })));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Nick is taken",
      field: "nick",
      reason: "NICK_TAKEN",
    });
    expect(update).not.toHaveBeenCalled();
  });
});

describe("other methods on /api/v1/me/nick", () => {
  it("GET is a NOT_FOUND envelope", async () => {
    const res = await GET(new Request("http://x/api/v1/me/nick"));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
  });
});
