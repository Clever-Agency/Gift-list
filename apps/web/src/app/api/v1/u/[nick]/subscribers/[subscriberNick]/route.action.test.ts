import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUser, createSubscription, deleteSubscription, hasBlockBetween } =
  vi.hoisted(() => ({
    getSession: vi.fn(),
    findUser: vi.fn(),
    createSubscription: vi.fn(),
    deleteSubscription: vi.fn(),
    hasBlockBetween: vi.fn(),
  }));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { user: { findUnique: findUser } } }));
vi.mock("@/lib/subscription-store", () => ({
  subscriptionStore: { createSubscription, deleteSubscription, hasBlockBetween },
}));

/** The session user is `owner` (u9); `anna` (u1) subscribes to the owner. */
const userIds: Record<string, string> = { anna: "u1", owner: "u9" };
const session = { user: { id: "u9" }, session: {} };

async function removeSubscriber(
  nick: string,
  subscriberNick: string,
): Promise<{ res: Response; body: unknown }> {
  const { DELETE } = await import("./route");
  const res = await DELETE(
    new Request(
      `http://x/api/v1/u/${encodeURIComponent(nick)}/subscribers/${encodeURIComponent(subscriberNick)}`,
      { method: "DELETE" },
    ),
    { params: Promise.resolve({ nick, subscriberNick }) },
  );
  return { res, body: await res.json() };
}

beforeEach(() => {
  getSession.mockReset();
  findUser.mockReset();
  createSubscription.mockReset();
  deleteSubscription.mockReset();
  hasBlockBetween.mockReset();

  getSession.mockResolvedValue(session);
  findUser.mockImplementation(({ where }: { where: { nickNormalized: string } }) => {
    const id = userIds[where.nickNormalized];
    return Promise.resolve(id === undefined ? null : { id });
  });
  createSubscription.mockResolvedValue(true);
  deleteSubscription.mockResolvedValue(true);
  hasBlockBetween.mockResolvedValue(false);
});

describe("DELETE /api/v1/u/:nick/subscribers/:subscriberNick through the use-case", () => {
  it("lets the profile owner remove the subscriber's directed row", async () => {
    const { res, body } = await removeSubscriber("Owner", "AnNa");

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { outcome: "UNSUBSCRIBED" } });
    expect(deleteSubscription).toHaveBeenCalledWith("u1", "u9");
    expect(createSubscription).not.toHaveBeenCalled();
  });

  it("returns a repeat as the successful no-op NOT_SUBSCRIBED", async () => {
    deleteSubscription.mockResolvedValue(false);

    const { res, body } = await removeSubscriber("owner", "anna");

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, data: { outcome: "NOT_SUBSCRIBED" } });
  });

  it("refuses a stranger with 403 and resolves only the path nick", async () => {
    const { res, body } = await removeSubscriber("anna", "owner");

    expect(res.status).toBe(403);
    expect(body).toEqual({ ok: false, code: "FORBIDDEN", message: "Forbidden" });
    expect(findUser).toHaveBeenCalledTimes(1);
    expect(deleteSubscription).not.toHaveBeenCalled();
  });

  it("answers unknown profile and subscriber nicks with the same 404", async () => {
    const unknownProfile = await removeSubscriber("no-such-nick", "anna");
    expect(unknownProfile.res.status).toBe(404);
    expect(unknownProfile.body).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });

    const unknownSubscriber = await removeSubscriber("owner", "no-such-nick");
    expect(unknownSubscriber.res.status).toBe(404);
    expect(unknownSubscriber.body).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });

    expect(deleteSubscription).not.toHaveBeenCalled();
  });

  it("answers UNAUTHENTICATED without a lookup or a write", async () => {
    getSession.mockResolvedValue(null);

    const { res, body } = await removeSubscriber("owner", "anna");

    expect(res.status).toBe(401);
    expect(body).toEqual({ ok: false, code: "UNAUTHENTICATED", message: "Authentication required" });
    expect(findUser).not.toHaveBeenCalled();
    expect(deleteSubscription).not.toHaveBeenCalled();
  });
});
