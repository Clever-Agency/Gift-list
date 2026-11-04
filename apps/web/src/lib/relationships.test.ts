import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Story 3.2 has no relation tables yet, so the reader must not read the
// database at all. Every property access on this stand-in client throws, which
// catches a lookup that sneaks in before Epic 4 / Epic 8 wire it up.
const prismaTrap = vi.hoisted(() =>
  new Proxy(
    {},
    {
      get(_target, property) {
        throw new Error(`prisma.${String(property)} must not be read`);
      },
      has(_target, property) {
        throw new Error(`prisma.${String(property)} must not be probed`);
      },
      ownKeys() {
        throw new Error("prisma must not be enumerated");
      },
    },
  ),
);

vi.mock("@/db/client", () => ({ prisma: prismaTrap }));

import { relationshipReader } from "@/lib/relationships";

const OWNER_ID = "owner_1";
const VIEWER_ID = "viewer_1";

const NO_RELATION_FACTS = {
  blocked: false,
  friend: false,
  subscriber: false,
  contactMatch: false,
};

describe("relationshipReader", () => {
  it("reports no relations for an anonymous visitor", async () => {
    await expect(
      relationshipReader.relationsBetween(null, OWNER_ID),
    ).resolves.toEqual(NO_RELATION_FACTS);
  });

  it("reports no relations for a signed-in visitor", async () => {
    await expect(
      relationshipReader.relationsBetween(VIEWER_ID, OWNER_ID),
    ).resolves.toEqual(NO_RELATION_FACTS);
  });

  it("reports no relations when the viewer is the owner", async () => {
    await expect(
      relationshipReader.relationsBetween(OWNER_ID, OWNER_ID),
    ).resolves.toEqual(NO_RELATION_FACTS);
  });

  it("leaves the list-token fact to the caller", async () => {
    const facts = await relationshipReader.relationsBetween(VIEWER_ID, OWNER_ID);
    expect(facts).not.toHaveProperty("viaListToken");
  });

  it("never touches the Prisma client", async () => {
    await relationshipReader.relationsBetween(null, OWNER_ID);
    await relationshipReader.relationsBetween(VIEWER_ID, OWNER_ID);
    expect(() => Reflect.get(prismaTrap, "gift")).toThrow(/prisma\.gift/);
  });
});
