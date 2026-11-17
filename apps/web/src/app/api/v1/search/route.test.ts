import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findMany, readProfileRelations } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findMany: vi.fn(),
  readProfileRelations: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { user: { findMany } } }));
vi.mock("@/lib/relationships", () => ({ readProfileRelations }));

import { USER_SEARCH_QUERY_MAX, normalizeForSearch } from "@gift-list/contracts";

import { GET, POST } from "./route";

const anna = {
  id: "u1",
  name: "Алёна",
  nick: "alena",
  nameNormalized: normalizeForSearch("Алёна"),
  nickNormalized: "alena",
  hideFromSearch: false,
};

type FindManyArgs = {
  where: {
    hideFromSearch: boolean;
    nickNormalized?: { startsWith: string };
    nameNormalized?: { contains: string };
  };
};

function request(query?: string) {
  const suffix = query === undefined ? "" : `?q=${encodeURIComponent(query)}`;
  return new Request(`http://x/api/v1/search${suffix}`);
}

beforeEach(() => {
  getSession.mockReset();
  findMany.mockReset();
  readProfileRelations.mockReset();
  getSession.mockResolvedValue({ user: { id: "viewer" }, session: { token: "t" } });
  readProfileRelations.mockResolvedValue(
    new Map([["u1", { relationship: "NONE", subscribed: false }]]),
  );
  findMany.mockImplementation(function findPeople(args: FindManyArgs) {
    if (args.where.hideFromSearch !== false) return [];
    const nickQuery = args.where.nickNormalized?.startsWith;
    const nameQuery = args.where.nameNormalized?.contains;
    if (nickQuery !== undefined) return anna.nickNormalized.startsWith(nickQuery) ? [anna] : [];
    return anna.nameNormalized.includes(nameQuery ?? "") ? [anna] : [];
  });
});

describe("GET /api/v1/search", () => {
  it("answers the person cards in the AD-12 envelope", async () => {
    const res = await GET(request("Алена"));

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({
      ok: true,
      data: {
        users: [
          { displayName: "Алёна", nick: "alena", relationship: "NONE", subscribed: false },
        ],
      },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ hideFromSearch: false }),
      }),
    );
    expect(readProfileRelations).toHaveBeenCalledWith("viewer", ["u1"]);
  });

  it("fills each card with the relation and subscription the batch reader answers", async () => {
    readProfileRelations.mockResolvedValue(
      new Map([["u1", { relationship: "OUTGOING_PENDING", subscribed: true }]]),
    );

    const res = await GET(request("alena"));

    expect(await res.json()).toEqual({
      ok: true,
      data: {
        users: [
          {
            displayName: "Алёна",
            nick: "alena",
            relationship: "OUTGOING_PENDING",
            subscribed: true,
          },
        ],
      },
    });
  });

  it("treats a missing query as a successful empty list", async () => {
    const res = await GET(request());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { users: [] } });
    expect(getSession).toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("answers 401 UNAUTHENTICATED without a session", async () => {
    getSession.mockResolvedValue(null);

    const res = await GET(request("Алена"));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("answers 400 VALIDATION with field q for an oversized query", async () => {
    const res = await GET(request("а".repeat(USER_SEARCH_QUERY_MAX + 1)));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "q",
    });
    expect(getSession).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("answers 404 NOT_FOUND for POST", async () => {
    const res = await POST(new Request("http://x/api/v1/search", { method: "POST" }));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND", message: "Not found" });
  });
});
