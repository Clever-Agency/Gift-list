import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findUnique, findMany, create, findFirst, update, PrismaClientKnownRequestError } =
  vi.hoisted(() => {
    class PrismaClientKnownRequestError extends Error {
      code: string;

      constructor(message: string, { code }: { code: string }) {
        super(message);
        this.code = code;
      }
    }

    return {
      getSession: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      PrismaClientKnownRequestError,
    };
  });

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({
  prisma: {
    list: { findUnique, findMany },
    gift: { create, findFirst, update, findMany },
  },
}));
vi.mock("@/db/generated/client", () => ({ Prisma: { PrismaClientKnownRequestError } }));

type Row = {
  id: string;
  title: string;
  description: string | null;
  priceAmount: number | null;
  priceCurrency: "USD" | "EUR" | "CNY" | "BYN" | "RUB" | null;
  linkUrl: string | null;
  visibility: "PUBLIC" | "FRIENDS" | "SECRET";
  quantity: "SINGLE" | "UNLIMITED";
  expiresOn: Date | null;
  archivedAt: Date | null;
  status: "OPEN" | "RESERVED" | "CLOSED";
  reservationPhase: "ACTIVE" | "AWAITING_GIVER" | "AWAITING_OWNER" | "GIVEN" | null;
  holderVisibleToOwner: boolean;
  reservedBy: { id: string; nick: string; name: string } | null;
  tags: { tagId: string | null; customText: string | null; tag: { slug: string; labels: unknown } | null }[];
};

function giftRow(overrides: Partial<Row> = {}): Row {
  return {
    id: "g1",
    title: "Книга",
    description: null,
    priceAmount: null,
    priceCurrency: null,
    linkUrl: null,
    visibility: "PUBLIC",
    quantity: "SINGLE",
    expiresOn: null,
    archivedAt: null,
    status: "OPEN",
    reservationPhase: null,
    holderVisibleToOwner: false,
    reservedBy: null,
    tags: [],
    ...overrides,
  };
}

function post(body: unknown) {
  return new Request("http://x/api/v1/me/gifts", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer t" },
    body: JSON.stringify(body),
  });
}

function patch(body: unknown) {
  return new Request("http://x/api/v1/me/gifts/g1", {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: "Bearer t" },
    body: JSON.stringify(body),
  });
}

function linkOfLength(length: number): string {
  const prefix = "https://example.com/";
  return `${prefix}${"a".repeat(length - prefix.length)}`;
}

function invalid(field: string) {
  return { ok: false, code: "VALIDATION", message: "Invalid input", field };
}

const context = { params: Promise.resolve({ id: "g1" }) };

beforeEach(() => {
  getSession.mockReset();
  findUnique.mockReset();
  findMany.mockReset();
  create.mockReset();
  findFirst.mockReset();
  update.mockReset();
  getSession.mockResolvedValue({ user: { id: "u1" }, session: { token: "t" } });
  findUnique.mockResolvedValue({ id: "l1" });
  findMany.mockResolvedValue([]);
  findFirst.mockResolvedValue(null);
  create.mockResolvedValue(giftRow());
  update.mockResolvedValue(giftRow());
});

/**
 * The server applies the gift caps itself (through `giftInputSchema` and
 * `giftUpdateSchema`), so a client that skips its own length check cannot store
 * more.
 */
describe("POST /api/v1/me/gifts caps", () => {
  it("stores a title of exactly 120 characters", async () => {
    const { POST } = await import("./route");
    const title = "я".repeat(120);
    const res = await POST(post({ title }));

    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title }) }),
    );
  });

  it("rejects a title of 121 characters with the field and writes nothing", async () => {
    const { POST } = await import("./route");
    const res = await POST(post({ title: "я".repeat(121) }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(invalid("title"));
    expect(create).not.toHaveBeenCalled();
  });

  it("counts an emoji title as one code point, as the clients' textLength does", async () => {
    const { POST } = await import("./route");
    const emoji = "😀";
    expect(emoji.repeat(120).length).toBe(240);

    const atCap = await POST(post({ title: emoji.repeat(120) }));
    expect(atCap.status).toBe(201);

    const overCap = await POST(post({ title: emoji.repeat(121) }));
    expect(overCap.status).toBe(400);
    expect(await overCap.json()).toEqual(invalid("title"));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("stores a description of exactly 2000 characters and rejects 2001", async () => {
    const { POST } = await import("./route");
    const atCap = await POST(post({ title: "Книга", description: "x".repeat(2000) }));
    expect(atCap.status).toBe(201);

    const overCap = await POST(post({ title: "Книга", description: "x".repeat(2001) }));
    expect(overCap.status).toBe(400);
    expect(await overCap.json()).toEqual(invalid("description"));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("stores a link of exactly 2048 characters and rejects 2049", async () => {
    const { POST } = await import("./route");
    const atCap = await POST(post({ title: "Книга", linkUrl: linkOfLength(2048) }));
    expect(atCap.status).toBe(201);

    const overCap = await POST(post({ title: "Книга", linkUrl: linkOfLength(2049) }));
    expect(overCap.status).toBe(400);
    expect(await overCap.json()).toEqual(invalid("linkUrl"));
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe("PATCH /api/v1/me/gifts/[id] with a stored value above a cap", () => {
  it("edits another field of a gift whose stored title is longer than the cap", async () => {
    findFirst.mockResolvedValue({
      priceAmount: null,
      status: "OPEN",
      visibility: "PUBLIC",
      quantity: "SINGLE",
    });
    // A row written before the cap (or outside the API) may hold any length;
    // the schema only sees the fields the body carries.
    update.mockResolvedValue(giftRow({ title: "я".repeat(5000), visibility: "SECRET" }));

    const { PATCH } = await import("./[id]/route");
    const res = await PATCH(patch({ visibility: "SECRET" }), context);

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, list: { ownerId: "u1" }, status: "OPEN" },
      data: { visibility: "SECRET" },
      select: expect.any(Object),
    });
    expect((await res.json()).data.title).toHaveLength(5000);
  });
});
