import { describe, expect, it } from "vitest";
import {
  NO_RELATIONS,
  VisibilityPolicy,
  type GiftVisibility,
  type ViewerRelations,
  type VisibilityViewer,
} from "./visibility";

const OWNER_ID = "u1";
const VISITOR_ID = "u2";
const ARCHIVED_AT = new Date("2026-01-01T00:00:00.000Z");
const VISIBILITIES: readonly GiftVisibility[] = ["PUBLIC", "FRIENDS", "SECRET"];

function relations(overrides: Partial<ViewerRelations> = {}): ViewerRelations {
  return { ...NO_RELATIONS, ...overrides };
}

type VisitorCase = {
  readonly name: string;
  readonly viewer: VisibilityViewer;
  readonly relations: ViewerRelations;
};

const visitors: readonly VisitorCase[] = [
  { name: "owner", viewer: { id: OWNER_ID }, relations: NO_RELATIONS },
  { name: "anonymous without link", viewer: null, relations: NO_RELATIONS },
  {
    name: "anonymous via list link",
    viewer: null,
    relations: relations({ viaListToken: true }),
  },
  { name: "signed-in without relations", viewer: { id: VISITOR_ID }, relations: NO_RELATIONS },
  {
    name: "signed-in via list link",
    viewer: { id: VISITOR_ID },
    relations: relations({ viaListToken: true }),
  },
  {
    name: "subscriber",
    viewer: { id: VISITOR_ID },
    relations: relations({ subscriber: true }),
  },
  {
    name: "contact match",
    viewer: { id: VISITOR_ID },
    relations: relations({ contactMatch: true }),
  },
  { name: "friend", viewer: { id: VISITOR_ID }, relations: relations({ friend: true }) },
  {
    name: "blocked friend",
    viewer: { id: VISITOR_ID },
    relations: relations({ friend: true, blocked: true }),
  },
];

/** AD-7 read matrix for an unarchived gift, per visitor. */
const visibleWhenActive: Record<string, readonly GiftVisibility[]> = {
  owner: ["PUBLIC", "FRIENDS", "SECRET"],
  "anonymous without link": [],
  "anonymous via list link": ["PUBLIC"],
  "signed-in without relations": [],
  "signed-in via list link": ["PUBLIC"],
  subscriber: ["PUBLIC"],
  "contact match": ["PUBLIC"],
  friend: ["PUBLIC", "FRIENDS"],
  "blocked friend": [],
};

function gift(
  visibility: GiftVisibility,
  options: { readonly ownerId?: string; readonly archivedAt?: Date | null } = {},
) {
  return {
    ownerId: options.ownerId ?? OWNER_ID,
    visibility,
    archivedAt: options.archivedAt ?? null,
  };
}

describe("VisibilityPolicy.canSee — AD-7 read matrix", () => {
  it.each(
    visitors.flatMap((visitor) =>
      VISIBILITIES.flatMap((visibility) =>
        [null, ARCHIVED_AT].map((archivedAt) => ({
          name: visitor.name,
          viewer: visitor.viewer,
          relations: visitor.relations,
          visibility,
          archivedAt,
          archived: archivedAt !== null,
          isOwner: visitor.viewer?.id === OWNER_ID,
          expected: visibleWhenActive[visitor.name]!.includes(visibility),
        })),
      ),
    ),
  )(
    "$name sees $visibility (archived: $archived)",
    ({ viewer, relations, visibility, archivedAt, isOwner, expected }) => {
      const visible = VisibilityPolicy.canSee(
        viewer,
        relations,
        gift(visibility, { archivedAt }),
      );
      // AD-7: an archived gift stays visible to its owner only.
      expect(visible).toBe(expected && (!archivedAt || isOwner));
    },
  );

  it("keeps the owner branch above a block edge", () => {
    expect(
      VisibilityPolicy.canSee(
        { id: OWNER_ID },
        relations({ blocked: true }),
        gift("SECRET", { archivedAt: ARCHIVED_AT }),
      ),
    ).toBe(true);
  });

  it("never shows FRIENDS to an anonymous viewer who carries a friend fact", () => {
    expect(
      VisibilityPolicy.canSee(null, relations({ friend: true }), gift("FRIENDS")),
    ).toBe(false);
    expect(
      VisibilityPolicy.canSee(null, relations({ friend: true }), gift("SECRET")),
    ).toBe(false);
  });

  it("ignores subscriber and contact-match facts for an anonymous viewer", () => {
    const anonymous = relations({ subscriber: true, contactMatch: true });
    expect(VisibilityPolicy.canSee(null, anonymous, gift("PUBLIC"))).toBe(false);
  });
});

describe("AD-15-10 — a subscriber sees PUBLIC only (AD-7, D-30, D-31)", () => {
  const subscriber = { id: VISITOR_ID };
  const subscriberRelations = relations({ subscriber: true });
  const list = { ownerId: OWNER_ID };

  it("opens PUBLIC but never FRIENDS or SECRET", () => {
    expect(VisibilityPolicy.canSee(subscriber, subscriberRelations, gift("PUBLIC"))).toBe(true);
    expect(VisibilityPolicy.canSee(subscriber, subscriberRelations, gift("FRIENDS"))).toBe(false);
    expect(VisibilityPolicy.canSee(subscriber, subscriberRelations, gift("SECRET"))).toBe(false);
  });

  it("keeps only PUBLIC in a whole list read and grants no friendship", () => {
    const publicGift = gift("PUBLIC");

    const result = VisibilityPolicy.resolve(subscriber, subscriberRelations, list, [
      gift("FRIENDS"),
      gift("SECRET"),
      publicGift,
    ]);

    expect(result).toEqual({ access: "gifts", gifts: [publicGift], role: "viewer" });
    // AD-19 / D-31: a subscription is not a friendship and never sets the fact.
    expect(subscriberRelations.friend).toBe(false);
  });

  it("narrows the database filter to PUBLIC", () => {
    expect(
      VisibilityPolicy.allowedVisibilities(subscriber, subscriberRelations, OWNER_ID),
    ).toEqual(["PUBLIC"]);
  });
});

describe("VisibilityPolicy.resolve — AD-7 list read", () => {
  const list = { ownerId: OWNER_ID };

  it("answers not_found without gifts when the list is missing", () => {
    const result = VisibilityPolicy.resolve(
      { id: VISITOR_ID },
      relations({ viaListToken: true }),
      null,
      [gift("PUBLIC")],
    );

    expect(result).toEqual({ access: "not_found", gifts: [], role: null });
    expect(Object.keys(result).sort()).toEqual(["access", "gifts", "role"]);
  });

  it("hides the list behind not_found when either side blocked, even for a PUBLIC link", () => {
    const result = VisibilityPolicy.resolve(
      { id: VISITOR_ID },
      relations({ blocked: true, viaListToken: true }),
      list,
      [gift("PUBLIC")],
    );

    expect(result).toEqual({ access: "not_found", gifts: [], role: null });
  });

  it("shows the owner every gift, including SECRET and archived ones", () => {
    const gifts = [
      gift("SECRET"),
      gift("PUBLIC", { archivedAt: ARCHIVED_AT }),
      gift("FRIENDS"),
    ];

    const result = VisibilityPolicy.resolve({ id: OWNER_ID }, NO_RELATIONS, list, gifts);

    expect(result).toEqual({ access: "gifts", gifts, role: "owner" });
  });

  it("keeps only PUBLIC and FRIENDS for a friend, in the incoming order", () => {
    const publicGift = gift("PUBLIC");
    const friendsGift = gift("FRIENDS");
    const secretGift = gift("SECRET");

    const result = VisibilityPolicy.resolve(
      { id: VISITOR_ID },
      relations({ friend: true }),
      list,
      [publicGift, friendsGift, secretGift],
    );

    expect(result).toEqual({
      access: "gifts",
      gifts: [publicGift, friendsGift],
      role: "viewer",
    });
  });

  it("keeps only PUBLIC for an anonymous visitor with the list link", () => {
    const publicGift = gift("PUBLIC");

    const result = VisibilityPolicy.resolve(
      null,
      relations({ viaListToken: true }),
      list,
      [gift("FRIENDS"), gift("SECRET"), publicGift],
    );

    expect(result).toEqual({ access: "gifts", gifts: [publicGift], role: "viewer" });
  });

  it("drops a gift that belongs to a different owner than the list", () => {
    const ownGift = gift("PUBLIC");

    const result = VisibilityPolicy.resolve(
      { id: OWNER_ID },
      NO_RELATIONS,
      list,
      [gift("PUBLIC", { ownerId: "u9" }), ownGift],
    );

    expect(result).toEqual({ access: "gifts", gifts: [ownGift], role: "owner" });
  });

  it("exposes nothing but access, gifts, and role — no hidden counts or flags", () => {
    const result = VisibilityPolicy.resolve(
      { id: VISITOR_ID },
      NO_RELATIONS,
      list,
      [gift("SECRET"), gift("FRIENDS"), gift("PUBLIC")],
    );

    expect(result).toEqual({ access: "gifts", gifts: [], role: "viewer" });
    expect(Object.keys(result).sort()).toEqual(["access", "gifts", "role"]);
  });
});

describe("VisibilityPolicy.allowedVisibilities — database where filter", () => {
  it("lets the owner read every visibility value", () => {
    expect(
      VisibilityPolicy.allowedVisibilities({ id: OWNER_ID }, NO_RELATIONS, OWNER_ID),
    ).toEqual(["PUBLIC", "FRIENDS", "SECRET"]);
  });

  it("lets a friend read PUBLIC and FRIENDS", () => {
    expect(
      VisibilityPolicy.allowedVisibilities(
        { id: VISITOR_ID },
        relations({ friend: true }),
        OWNER_ID,
      ),
    ).toEqual(["PUBLIC", "FRIENDS"]);
  });

  it("lets link, subscription, and contact-match viewers read only PUBLIC", () => {
    for (const fact of ["viaListToken", "subscriber", "contactMatch"] as const) {
      expect(
        VisibilityPolicy.allowedVisibilities(
          { id: VISITOR_ID },
          relations({ [fact]: true }),
          OWNER_ID,
        ),
      ).toEqual(["PUBLIC"]);
    }
    expect(
      VisibilityPolicy.allowedVisibilities(
        null,
        relations({ viaListToken: true }),
        OWNER_ID,
      ),
    ).toEqual(["PUBLIC"]);
  });

  it("returns no visibility at all for a block or a viewer without relations", () => {
    expect(
      VisibilityPolicy.allowedVisibilities(
        { id: VISITOR_ID },
        relations({ friend: true, blocked: true }),
        OWNER_ID,
      ),
    ).toEqual([]);
    expect(
      VisibilityPolicy.allowedVisibilities({ id: VISITOR_ID }, NO_RELATIONS, OWNER_ID),
    ).toEqual([]);
    expect(VisibilityPolicy.allowedVisibilities(null, NO_RELATIONS, OWNER_ID)).toEqual([]);
  });

  it.each(visitors)("$name: allowedVisibilities agrees with canSee", ({ viewer, relations }) => {
    const allowed = VisibilityPolicy.allowedVisibilities(viewer, relations, OWNER_ID);

    for (const visibility of VISIBILITIES) {
      expect(allowed.includes(visibility)).toBe(
        VisibilityPolicy.canSee(viewer, relations, gift(visibility)),
      );
    }
  });
});
