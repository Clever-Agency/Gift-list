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
  tags: { tagId: string | null; customText: string | null; tag: { labels: unknown } | null }[];
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
  create.mockImplementation(({ data }: { data: { quantity: "SINGLE" | "UNLIMITED" } }) =>
    Promise.resolve(giftRow({ quantity: data.quantity })),
  );
  update.mockResolvedValue(giftRow());
});

describe("POST /api/v1/me/gifts quantity", () => {
  it("creates a SINGLE wish by default", async () => {
    const { POST } = await import("./route");
    const res = await POST(post({ title: "Книга" }));

    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quantity: "SINGLE" }) }),
    );
    expect((await res.json()).data.quantity).toBe("SINGLE");
  });

  it("creates an explicit UNLIMITED wish", async () => {
    const { POST } = await import("./route");
    const res = await POST(post({ title: "Книга", quantity: "UNLIMITED" }));

    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quantity: "UNLIMITED" }) }),
    );
    expect((await res.json()).data.quantity).toBe("UNLIMITED");
  });

  it("rejects an unknown quantity with VALIDATION and the field", async () => {
    const { POST } = await import("./route");
    const res = await POST(post({ title: "Книга", quantity: "MANY" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "quantity",
    });
    expect(create).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/v1/me/gifts/[id] quantity", () => {
  it("changes the quantity of an OPEN wish", async () => {
    findFirst.mockResolvedValue({
      priceAmount: null,
      status: "OPEN",
      visibility: "PUBLIC",
      quantity: "SINGLE",
    });
    update.mockResolvedValue(giftRow({ quantity: "UNLIMITED" }));

    const { PATCH } = await import("./[id]/route");
    const res = await PATCH(patch({ quantity: "UNLIMITED" }), context);

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, list: { ownerId: "u1" }, status: "OPEN" },
      data: { quantity: "UNLIMITED" },
      select: expect.any(Object),
    });
    expect((await res.json()).data.quantity).toBe("UNLIMITED");
  });

  it.each(["RESERVED", "CLOSED"] as const)(
    "rejects a quantity change on a %s wish",
    async (status) => {
      findFirst.mockResolvedValue({
        priceAmount: null,
        status,
        visibility: "PUBLIC",
        quantity: "SINGLE",
      });

      const { PATCH } = await import("./[id]/route");
      const res = await PATCH(patch({ quantity: "UNLIMITED" }), context);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        ok: false,
        code: "VALIDATION",
        message: "Invalid input",
        field: "quantity",
      });
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("lets a non-OPEN wish resend its stored quantity with another edit", async () => {
    findFirst.mockResolvedValue({
      priceAmount: null,
      status: "RESERVED",
      visibility: "PUBLIC",
      quantity: "UNLIMITED",
    });
    update.mockResolvedValue(
      giftRow({ title: "Новое название", status: "RESERVED", quantity: "UNLIMITED" }),
    );

    const { PATCH } = await import("./[id]/route");
    const res = await PATCH(patch({ title: "Новое название", quantity: "UNLIMITED" }), context);

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, list: { ownerId: "u1" } },
      data: { title: "Новое название" },
      select: expect.any(Object),
    });
  });

  it("keeps the visibility rule unchanged when quantity is sent too", async () => {
    findFirst.mockResolvedValue({
      priceAmount: null,
      status: "OPEN",
      visibility: "PUBLIC",
      quantity: "SINGLE",
    });
    update.mockResolvedValue(giftRow({ quantity: "UNLIMITED", visibility: "SECRET" }));

    const { PATCH } = await import("./[id]/route");
    const res = await PATCH(
      patch({ quantity: "UNLIMITED", visibility: "SECRET" }),
      context,
    );

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: "g1", archivedAt: null, list: { ownerId: "u1" }, status: "OPEN" },
      data: { quantity: "UNLIMITED", visibility: "SECRET" },
      select: expect.any(Object),
    });
  });
});
