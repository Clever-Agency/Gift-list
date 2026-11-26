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

const user = {
  id: "u1",
  email: "a@example.com",
  name: "Аня",
  nick: "anya",
  timeZone: null as string | null,
  hideFromSearch: false,
};

function patch(body: string) {
  return new Request("http://x/api/v1/me/name", {
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
  findUnique.mockResolvedValue(user);
  update.mockResolvedValue({});
});

describe("PATCH /api/v1/me/name", () => {
  it("changes the name and answers the updated user in the AD-12 envelope", async () => {
    const res = await PATCH(patch(JSON.stringify({ name: "  Анна  " })));

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({
      ok: true,
      data: {
        id: "u1",
        email: "a@example.com",
        name: "Анна",
        nick: "anya",
        timeZone: null,
        hideFromSearch: false,
      },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { name: "Анна", nameNormalized: "анна" },
    });
  });

  it("answers 400 VALIDATION with field name for a blank name", async () => {
    const res = await PATCH(patch(JSON.stringify({ name: "   " })));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "name",
    });
    expect(getSession).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("accepts a name at the cap and rejects one character more", async () => {
    const atCap = await PATCH(patch(JSON.stringify({ name: "я".repeat(50) })));
    expect(atCap.status).toBe(200);

    const overCap = await PATCH(patch(JSON.stringify({ name: "я".repeat(51) })));
    expect(overCap.status).toBe(400);
    expect(await overCap.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "name",
    });
  });

  it("answers 400 for broken JSON without calling the use-case", async () => {
    const res = await PATCH(patch("{not json"));

    expect(res.status).toBe(400);
    expect(getSession).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("answers 413 with the size reason before the session or the database", async () => {
    const res = await PATCH(patch(JSON.stringify({ name: "я".repeat(40_000) })));

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Payload too large",
      reason: "PAYLOAD_TOO_LARGE",
    });
    expect(getSession).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("other methods on /api/v1/me/name", () => {
  it("GET is a NOT_FOUND envelope", async () => {
    const res = await GET(new Request("http://x/api/v1/me/name"));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
  });
});
