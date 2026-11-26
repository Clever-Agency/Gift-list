// AD-15 (14) (D-63): the owner's page `/gifts/{id}` is built from one read,
// `GET /api/v1/me/gifts/:id`. The answer must not carry a single reservation
// fact — no `reservedBy`, no `reservation`, no `RESERVED` status, no deadline and
// no phase — and the read itself must not even ask the database for the booking.
// A reserved wish reads exactly like the same open wish, so the page cannot tell
// the owner their gift has been booked (D-49).
//
// The canonical per-piece tests stay where they are: `actions/gifts.test.ts`
// (the owner card) and `invariants/ad15/card-privacy.test.ts` (the list card and
// the exact key set). This case is the one-gift read of the page.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getSession, findFirst } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma: { gift: { findFirst } } }));
vi.mock("@/db/generated/client", () => ({
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
}));
vi.mock("@/lib/relationships", () => ({
  relationshipReader: { relationsBetween: vi.fn() },
}));

import { giftCardSchema } from "@gift-list/contracts";
import { getGift } from "@/actions/gifts";
import { toOwnerGiftCard } from "@/domain/owner-gift-card";

const OWNER = "owner";
const HOLDER = "holder";
const HEADERS = new Headers({ "accept-language": "ru-RU,ru;q=0.9" });

/** Exactly the owner branch of the shared `GiftCard` (AD-7, AD-12). */
const OWNER_CARD_KEYS = [
  "archivedAt",
  "description",
  "expiresOn",
  "id",
  "linkUrl",
  "ownerAction",
  "priceAmount",
  "priceCurrency",
  "quantity",
  "reservationLabel",
  "reservedBy",
  "status",
  "tags",
  "title",
  "undoUntil",
  "visibility",
];

/** Columns the page may read; the booking columns are not among them. */
const BOOKING_COLUMNS = [
  "reservedBy",
  "reservationPhase",
  "reservationDueAt",
  "reservationTimeZone",
  "reservationBought",
  "holderVisibleToOwner",
  "holderVisibleToOthers",
  "reservedById",
];

/** An owner row: the example wish, live and with a price and a shop link. */
function openRow() {
  return {
    id: "g1",
    title: "Наушники",
    description: "Беспроводные",
    priceAmount: 19900,
    priceCurrency: "BYN" as const,
    linkUrl: "https://shop.example/headphones",
    visibility: "FRIENDS" as const,
    quantity: "SINGLE" as const,
    expiresOn: null,
    archivedAt: null,
    status: "OPEN" as const,
    closedAt: null,
    tags: [],
    list: { ownerId: OWNER },
  };
}

/**
 * The same row booked by somebody else — a live holder, a bought mark and a
 * phase, the exact facts the owner must never learn.
 */
function reservedRow() {
  return {
    ...openRow(),
    status: "RESERVED" as const,
    reservedById: HOLDER,
    reservedBy: { id: HOLDER, nick: "daria", name: "Дарья" },
    reservationPhase: "ACTIVE" as const,
    reservationDueAt: new Date("2026-12-10T00:00:00.000Z"),
    reservationTimeZone: "UTC",
    reservationBought: true,
    holderVisibleToOwner: true,
    holderVisibleToOthers: true,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ user: { id: OWNER }, session: { token: "t" } });
  findFirst.mockResolvedValue(openRow());
});

describe("AD-15 (14) — страница владельца /gifts/{id} без признаков брони", () => {
  it("читает только свои поля: ни держателя, ни брони, ни срока", async () => {
    const answer = await getGift(HEADERS, "g1");
    if (!answer.ok) throw new Error(`unexpected error: ${answer.code}`);

    const select = (findFirst.mock.calls[0]![0] as { select: Record<string, unknown> }).select;
    for (const column of BOOKING_COLUMNS) {
      expect(select).not.toHaveProperty(column);
    }
    // Ownership rides in the read: a foreign id can never be read by this page.
    expect(findFirst.mock.calls[0]![0]).toMatchObject({
      where: { id: "g1", archivedAt: null, list: { ownerId: OWNER } },
    });

    expect(giftCardSchema.safeParse(answer.data).success).toBe(true);
    expect(Object.keys(answer.data).sort()).toEqual(OWNER_CARD_KEYS);
  });

  it("отвечает на забронированное желание так же, как на открытое", async () => {
    findFirst.mockResolvedValue(reservedRow());

    const answer = await getGift(HEADERS, "g1");
    if (!answer.ok) throw new Error(`unexpected error: ${answer.code}`);

    // The row really has a holder, a purchase mark and a running phase…
    expect(reservedRow()).toMatchObject({
      status: "RESERVED",
      reservedById: HOLDER,
      reservationBought: true,
      reservationPhase: "ACTIVE",
    });

    // …while the page's card looks exactly like the open wish and carries no
    // key of the reservation at all (D-49).
    expect(answer.data).toEqual(toOwnerGiftCard(openRow()));
    expect(answer.data.status).toBe("OPEN");
    expect(answer.data).not.toHaveProperty("reservation");
    expect(answer.data.reservedBy).toBeNull();
    expect(answer.data.reservationLabel).toBeNull();
    expect(answer.data.ownerAction).toBeNull();

    const body = JSON.stringify(answer.data);
    expect(body).not.toContain("Дарья");
    expect(body).not.toContain("daria");
    expect(body).not.toContain("RESERVED");
    expect(body).not.toContain('"bought"');
    expect(body).not.toContain('"dueAt"');
    expect(body).not.toContain('"reservation":');
    expect(body).not.toContain("holderVisible");
  });
});
