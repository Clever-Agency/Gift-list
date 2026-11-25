// AD-15 (4) and (5): the holder's reservation card outlives an unfriend or a
// block, while the owner's gift card never learns the holder or the purchase
// facts. Both checks go through the use-cases (`readWishlist`,
// `getMyReservations`, `getMyGifts`) — the one gate of both adapters (AD-1) —
// and not only through the card mappers.
//
// The canonical per-piece tests stay where they are and are not repeated here:
// `actions/my-reservations.test.ts` (card after unfriend/block),
// `actions/wishlist-friendship.test.ts` (FRIENDS closed after unfriend),
// `actions/my-gifts.test.ts` and `domain/owner-gift-card.test.ts` (owner card).
// What none of them has is this one scenario: «вишлист закрыт, карточка жива».
//
// (5) is closed for the gift card only. Notification and the owner's email do
// not exist yet (`schema.prisma` has no `Notification`, there is no transport),
// so there is nothing to assert; that half waits for Story 6.1 — see README,
// «Отложено».
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Visibility = "PUBLIC" | "FRIENDS" | "SECRET";
type Phase = "ACTIVE" | "AWAITING_GIVER" | "AWAITING_OWNER" | "GIVEN" | null;
type TagRow = {
  tagId: string | null;
  customText: string | null;
  tag: { slug: string; labels: unknown } | null;
};
type Row = {
  id: string;
  listId: string;
  title: string;
  description: string | null;
  priceAmount: number | null;
  priceCurrency: "USD" | "EUR" | "CNY" | "BYN" | "RUB" | null;
  linkUrl: string | null;
  visibility: Visibility;
  quantity: "SINGLE" | "UNLIMITED";
  expiresOn: Date | null;
  archivedAt: Date | null;
  closedAt: Date | null;
  status: "OPEN" | "RESERVED" | "CLOSED";
  reservationPhase: Phase;
  reservationDueAt: Date | null;
  reservationTimeZone: string | null;
  reservationBought: boolean;
  holderVisibleToOwner: boolean;
  holderVisibleToOthers: boolean;
  reservedById: string | null;
  reservedBy: { id: string; nick: string; name: string } | null;
  titleSnapshotOnReserve: string | null;
  /** The `list` join of the reservation select; the owner nick rides on the card. */
  list: { ownerId: string; owner: { nick: string } };
  tags: TagRow[];
};
type ListRow = {
  id: string;
  ownerId: string;
  publicToken: string;
  owner: { name: string; nick: string };
};
type Relations = {
  blocked: boolean;
  friend: boolean;
  subscriber: boolean;
  contactMatch: boolean;
};
type GiftWhere = {
  listId?: string;
  archivedAt?: null;
  NOT?: { archivedAt: null };
  visibility?: { in: readonly Visibility[] };
  status?: Row["status"];
  reservedById?: string;
  reservationDueAt?: { not: null };
  reservationPhase?: { not: null };
};
type ListWhere = { ownerId?: string; publicToken?: string };

/**
 * Isolated in-memory stand-in for the two reads of the scenario: the policy
 * read (`readWishlist`) and the holder read (`getMyReservations`). Every
 * narrowing the reads ask for is applied, so a widened query shows up as a
 * leaked title or a second card. Columns are not narrowed per `select`: the
 * mappers build new objects, so a field the select forgot still cannot travel.
 */
const { getSession, prisma, state, relationsBetween, ensureOwnerList } = vi.hoisted(() => {
  const state = {
    actor: null as string | null,
    list: null as ListRow | null,
    gifts: [] as Row[],
    relations: {
      blocked: false,
      friend: false,
      subscriber: false,
      contactMatch: false,
    } as Relations,
  };

  function matches(row: Row, where: GiftWhere): boolean {
    if (where.listId !== undefined && row.listId !== where.listId) return false;
    if (where.archivedAt === null && row.archivedAt !== null) return false;
    if (where.NOT?.archivedAt === null && row.archivedAt === null) return false;
    if (where.visibility !== undefined && !where.visibility.in.includes(row.visibility)) {
      return false;
    }
    if (where.status !== undefined && row.status !== where.status) return false;
    if (where.reservedById !== undefined && row.reservedById !== where.reservedById) return false;
    if (where.reservationDueAt?.not === null && row.reservationDueAt === null) return false;
    if (where.reservationPhase?.not === null && row.reservationPhase === null) return false;
    return true;
  }

  const prisma = {
    list: {
      async findUnique(args: { where: ListWhere }): Promise<ListRow | null> {
        const list = state.list;
        if (list === null) return null;
        if (args.where.ownerId !== undefined) {
          return list.ownerId === args.where.ownerId ? list : null;
        }
        return list.publicToken === args.where.publicToken ? list : null;
      },
    },
    gift: {
      async findMany(args: { where: GiftWhere }): Promise<Row[]> {
        return state.gifts.filter(function visible(row) {
          return matches(row, args.where);
        });
      },
      async count(args: { where: GiftWhere }): Promise<number> {
        return state.gifts.filter(function visible(row) {
          return matches(row, args.where);
        }).length;
      },
    },
    async $transaction(operations: Promise<unknown>[]): Promise<unknown[]> {
      return Promise.all(operations);
    },
  };

  const getSession = vi.fn(async function currentSession() {
    return state.actor === null ? null : { user: { id: state.actor }, session: { token: "t" } };
  });
  const relationsBetween = vi.fn(async function relations() {
    return { ...state.relations };
  });
  const ensureOwnerList = vi.fn(async function repairList() {
    return undefined;
  });

  return { getSession, prisma, state, relationsBetween, ensureOwnerList };
});

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/db/client", () => ({ prisma }));
vi.mock("@/lib/relationships", () => ({ relationshipReader: { relationsBetween } }));
vi.mock("@/lib/owner-list", () => ({ ensureOwnerList }));

import { giftCardSchema, reservationCardSchema } from "@gift-list/contracts";
import { getMyGifts } from "@/actions/my-gifts";
import { getMyReservations } from "@/actions/my-reservations";
import { readWishlist } from "@/actions/wishlist-read";
import { toOwnerGiftCard } from "@/domain/owner-gift-card";

const OWNER = "owner";
const HOLDER = "holder";
const LIST_TOKEN = "tok-1";
const headers = new Headers({ "accept-language": "ru-RU,ru;q=0.9" });

const HOLDER_PERSON = { id: HOLDER, nick: "daria", name: "Дарья" };

const LIST: ListRow = {
  id: "l1",
  ownerId: OWNER,
  publicToken: LIST_TOKEN,
  owner: { name: "Анна", nick: "anna" },
};

function gift(overrides: Partial<Row> & Pick<Row, "id" | "title">): Row {
  return {
    listId: "l1",
    description: null,
    priceAmount: null,
    priceCurrency: null,
    linkUrl: null,
    visibility: "PUBLIC",
    quantity: "SINGLE",
    expiresOn: null,
    archivedAt: null,
    closedAt: null,
    status: "OPEN",
    reservationPhase: null,
    reservationDueAt: null,
    reservationTimeZone: null,
    reservationBought: false,
    holderVisibleToOwner: false,
    holderVisibleToOthers: true,
    reservedById: null,
    reservedBy: null,
    titleSnapshotOnReserve: null,
    list: { ownerId: OWNER, owner: { nick: "anna" } },
    tags: [],
    ...overrides,
  };
}

/** The holder's live reservation plus the owner's other wishes it must not reveal. */
const holderWishes: Row[] = [
  gift({
    id: "g-reserved",
    title: "Плед в клетку",
    titleSnapshotOnReserve: "Плед",
    visibility: "FRIENDS",
    status: "RESERVED",
    reservationPhase: "ACTIVE",
    // End of the picked day: 2026-12-10 00:00 UTC is the day 2026-12-09.
    reservationDueAt: new Date("2026-12-10T00:00:00.000Z"),
    reservationTimeZone: "UTC",
    holderVisibleToOwner: false,
    holderVisibleToOthers: true,
    reservedById: HOLDER,
    reservedBy: HOLDER_PERSON,
  }),
  gift({ id: "g-public", title: "Публичное" }),
  gift({ id: "g-friends", title: "Только друзьям", visibility: "FRIENDS" }),
  gift({ id: "g-secret", title: "Секретное", visibility: "SECRET" }),
  // Another holder's live reservation: the read must narrow by the caller, not
  // return every RESERVED row of the list.
  gift({
    id: "g-rival",
    title: "Чужая бронь",
    visibility: "FRIENDS",
    status: "RESERVED",
    reservationPhase: "ACTIVE",
    reservationDueAt: new Date("2026-12-11T00:00:00.000Z"),
    reservationTimeZone: "UTC",
    reservedById: "rival",
    reservedBy: { id: "rival", nick: "roman", name: "Роман" },
  }),
];

/** The owner's row of (5): live, bought, holder shared with the owner only if allowed. */
const ownerRow: Row = gift({
  id: "g-owner",
  title: "Наушники",
  description: "Беспроводные",
  priceAmount: 19900,
  priceCurrency: "BYN",
  linkUrl: "https://shop.example/headphones",
  visibility: "FRIENDS",
  status: "RESERVED",
  reservationPhase: "ACTIVE",
  reservationDueAt: new Date("2026-12-10T00:00:00.000Z"),
  reservationTimeZone: "UTC",
  reservationBought: true,
  holderVisibleToOwner: false,
  holderVisibleToOthers: true,
  reservedById: HOLDER,
  reservedBy: HOLDER_PERSON,
  titleSnapshotOnReserve: "Наушники",
});

/** Exactly the closed holder card of `reservationCardSchema` (AD-12). */
const RESERVATION_CARD_KEYS = [
  "bought",
  "canOpenGift",
  "dueAt",
  "giftId",
  "holderVisibleToOthers",
  "holderVisibleToOwner",
  "ownerNick",
  "phase",
  "status",
  "titleSnapshot",
];

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

function expectReservationCardKeys(card: unknown): void {
  expect(Object.keys(card as Record<string, unknown>).sort()).toEqual(RESERVATION_CARD_KEYS);
}

beforeEach(() => {
  vi.clearAllMocks();
  state.actor = null;
  state.list = null;
  state.gifts = [];
  state.relations = { blocked: false, friend: false, subscriber: false, contactMatch: false };
});

describe("AD-15 (4) — unfriend при активной брони", () => {
  beforeEach(() => {
    // The holder of one wish; an unfriend leaves no friendship, subscription or
    // contact match behind.
    state.actor = HOLDER;
    state.list = LIST;
    state.gifts = holderWishes;
  });

  it("после unfriend вишлист пуст, а карточка брони остаётся с точным набором полей", async () => {
    const wishlist = await readWishlist({
      viewer: { id: HOLDER },
      target: { ownerId: OWNER },
    });

    // AD-7: an unfriended profile stays a readable list with nothing visible —
    // not even the PUBLIC wish, because a signed-in stranger needs a relation.
    expect(wishlist).toEqual({ access: "gifts", gifts: [] });
    expect(relationsBetween).toHaveBeenCalledWith(HOLDER, OWNER);

    const result = await getMyReservations(headers);
    if (!result.ok) throw new Error(`unexpected error: ${result.code}`);

    // A-14: the card is read by holder and status only, so the unfriend cannot
    // remove it.
    expect(result.data.reservations).toEqual([
      {
        giftId: "g-reserved",
        titleSnapshot: "Плед",
        status: "RESERVED",
        ownerNick: "anna",
        dueAt: "2026-12-09",
        phase: "ACTIVE",
        bought: false,
        holderVisibleToOwner: false,
        holderVisibleToOthers: true,
        canOpenGift: false,
      },
    ]);

    const [card] = result.data.reservations;
    expectReservationCardKeys(card);
    expect(reservationCardSchema.safeParse(card).success).toBe(true);

    // The closed list and the one card explain nothing: no other wish, no
    // visibility reason, no list token.
    const body = JSON.stringify({ wishlist, reservations: result.data.reservations });
    for (const hiddenTitle of ["Публичное", "Только друзьям", "Секретное", "Чужая бронь"]) {
      expect(body).not.toContain(hiddenTitle);
    }
    for (const forbidden of ["publicToken", "listToken", "visibility", "reservationTimeZone"]) {
      expect(body).not.toContain(forbidden);
    }
  });

  it("при Block вишлист закрыт как неизвестный, а карточка жива без ссылки на детали", async () => {
    state.relations = { blocked: true, friend: false, subscriber: false, contactMatch: false };

    const wishlist = await readWishlist({
      viewer: { id: HOLDER },
      target: { ownerId: OWNER },
    });

    // AD-7 / AD-15 (3): a block is one closed gate, indistinguishable from an
    // unknown owner.
    expect(wishlist).toBeNull();

    const result = await getMyReservations(headers);
    if (!result.ok) throw new Error(`unexpected error: ${result.code}`);

    const [card] = result.data.reservations;
    expect(result.data.reservations).toHaveLength(1);
    expect(card).toMatchObject({
      giftId: "g-reserved",
      titleSnapshot: "Плед",
      status: "RESERVED",
      phase: "ACTIVE",
      canOpenGift: false,
    });
    expectReservationCardKeys(card);
    expect(reservationCardSchema.safeParse(card).success).toBe(true);

    // The card carries the moment-of-reserving title, not the current one, and
    // none of the owner's other wishes: the block closes the list, not the card.
    const body = JSON.stringify(result.data.reservations);
    for (const hiddenTitle of [
      "Плед в клетку",
      "Публичное",
      "Только друзьям",
      "Секретное",
      "Чужая бронь",
    ]) {
      expect(body).not.toContain(hiddenTitle);
    }
    for (const forbidden of ["publicToken", "listToken", "visibility", "reservationTimeZone"]) {
      expect(body).not.toContain(forbidden);
    }
  });
});

describe("AD-15 (5) — владелец при holderVisibleToOwner=false", () => {
  beforeEach(() => {
    state.actor = OWNER;
    state.list = LIST;
    state.gifts = [ownerRow];
  });

  it("не отдаёт владельцу ни одного признака брони", async () => {
    // The row really has a holder, a purchase fact and a running phase; the card
    // just looks exactly like the same wish without a reservation (D-49).
    expect(ownerRow).toMatchObject({
      status: "RESERVED",
      reservationPhase: "ACTIVE",
      reservationBought: true,
      holderVisibleToOwner: false,
    });
    expect(ownerRow.reservedBy).toEqual(HOLDER_PERSON);

    const result = await getMyGifts(headers);
    if (!result.ok) throw new Error(`unexpected error: ${result.code}`);

    const [card] = result.data.gifts;
    if (card === undefined) throw new Error("expected the owner card");

    // AD-15 (5) / D-49: the wish is a surprise, so the owner sees an open wish.
    expect(card.status).toBe("OPEN");
    expect(card.reservedBy).toBeNull();
    expect(card.reservationLabel).toBeNull();
    expect(card.ownerAction).toBeNull();
    expect(card).not.toHaveProperty("reservation");
    expect(card).not.toHaveProperty("bought");
    expect(card).not.toHaveProperty("dueAt");

    // The rest is the shared owner-card contract, field for field, built by the
    // same mapper — and it equals the card of the same wish without them.
    const openTwin: Row = {
      ...ownerRow,
      status: "OPEN",
      reservationPhase: null,
      reservationBought: false,
      holderVisibleToOwner: false,
      reservedById: null,
      reservedBy: null,
      titleSnapshotOnReserve: null,
    };
    expect(card).toEqual(toOwnerGiftCard(ownerRow));
    expect(card).toEqual(toOwnerGiftCard(openTwin));
    expect(giftCardSchema.safeParse(card).success).toBe(true);
    expect(Object.keys(card).sort()).toEqual(OWNER_CARD_KEYS);

    // The owner branch needs no relation facts at all.
    expect(relationsBetween).not.toHaveBeenCalled();
    expect(ensureOwnerList).not.toHaveBeenCalled();

    const body = JSON.stringify(card);
    expect(body).not.toContain("Дарья");
    expect(body).not.toContain("daria");
    expect(body).not.toContain('"bought"');
    expect(body).not.toContain('"dueAt"');
    expect(body).not.toContain("RESERVED");
  });
});
