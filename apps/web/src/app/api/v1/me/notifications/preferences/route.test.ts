import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUniqueOrThrow, update } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { user: { findUniqueOrThrow, update } } }));

import { GET, PATCH } from "./route";

const stored = {
  datesInApp: true,
  datesEmail: true,
  wishExpiryInApp: true,
  wishExpiryEmail: true,
  remindFriendDates: true,
  remindOwnList: true,
};

function patch(body: unknown) {
  return new Request("http://x/api/v1/me/notifications/preferences", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  getSession.mockReset();
  findUniqueOrThrow.mockReset();
  update.mockReset();
  getSession.mockResolvedValue({ user: { id: "u1" }, session: { token: "t" } });
  findUniqueOrThrow.mockResolvedValue(stored);
  update.mockImplementation(async function updateWith({ data }: { data: Record<string, boolean> }) {
    return { ...stored, ...data };
  });
});

describe("/api/v1/me/notifications/preferences", () => {
  it("reads the two reminder switches with the channels", async () => {
    const res = await GET(new Request("http://x/api/v1/me/notifications/preferences"));

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ ok: true, data: stored });
    expect(findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: expect.objectContaining({ remindFriendDates: true, remindOwnList: true }),
    });
  });

  it.each([
    [{ remindFriendDates: false }, { remindFriendDates: false }],
    [{ remindOwnList: false }, { remindOwnList: false }],
    [{ remindFriendDates: false, remindOwnList: false }, { remindFriendDates: false, remindOwnList: false }],
  ])("changes %j and answers the updated preferences", async (body, data) => {
    const res = await PATCH(patch(body));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { ...stored, ...data } });
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data,
      select: expect.objectContaining({ remindFriendDates: true, remindOwnList: true }),
    });
  });

  it("answers 401 without a session", async () => {
    getSession.mockResolvedValue(null);

    const res = await GET(new Request("http://x/api/v1/me/notifications/preferences"));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
  });

  it.each([
    ["remindFriendDates", "yes"],
    ["remindOwnList", 1],
    ["remindOwnList", null],
  ])("answers 400 VALIDATION on the %s field for %j", async (field, value) => {
    const res = await PATCH(patch({ [field]: value }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field,
    });
    expect(update).not.toHaveBeenCalled();
  });
});
