import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/db/generated/client";

vi.mock("server-only", () => ({}));

const {
  inviteLinkCreate,
  inviteLinkFindUnique,
  blockFindFirst,
  friendshipFindUnique,
  friendshipCreate,
  friendshipInviteDeleteMany,
  executeRaw,
  transaction,
  PrismaClientKnownRequestError,
} = vi.hoisted(() => {
  /** Stands in for the generated class, so a test can shape the `code`. */
  class PrismaClientKnownRequestError extends Error {
    code: string;

    constructor(message: string, { code }: { code: string }) {
      super(message);
      this.code = code;
    }
  }

  return {
    inviteLinkCreate: vi.fn(),
    inviteLinkFindUnique: vi.fn(),
    blockFindFirst: vi.fn(),
    friendshipFindUnique: vi.fn(),
    friendshipCreate: vi.fn(),
    friendshipInviteDeleteMany: vi.fn(),
    executeRaw: vi.fn(),
    transaction: vi.fn(),
    PrismaClientKnownRequestError,
  };
});

const tx = {
  $executeRaw: executeRaw,
  inviteLink: { findUnique: inviteLinkFindUnique },
  block: { findFirst: blockFindFirst },
  friendship: { findUnique: friendshipFindUnique, create: friendshipCreate },
  friendshipInvite: { deleteMany: friendshipInviteDeleteMany },
};

/** The mock carries only the members the adapter touches; the port needs no others. */
function asTransactionClient(client: typeof tx): Prisma.TransactionClient {
  return client as unknown as Prisma.TransactionClient;
}

vi.mock("@/db/client", () => ({
  prisma: {
    inviteLink: { create: inviteLinkCreate, findUnique: inviteLinkFindUnique },
    block: { findFirst: blockFindFirst },
    friendship: { findUnique: friendshipFindUnique, create: friendshipCreate },
    friendshipInvite: { deleteMany: friendshipInviteDeleteMany },
    $transaction: transaction,
  },
}));
vi.mock("@/db/generated/client", () => ({
  Prisma: {
    PrismaClientKnownRequestError,
    TransactionIsolationLevel: { ReadCommitted: "ReadCommitted" },
  },
}));

import {
  ensureInviteLink,
  inviteLinkStore,
  inviteLinkTransaction,
} from "./invite-link-store";

function p2002() {
  return new PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002" });
}

beforeEach(() => {
  inviteLinkCreate.mockReset();
  inviteLinkFindUnique.mockReset();
  blockFindFirst.mockReset();
  friendshipFindUnique.mockReset();
  friendshipCreate.mockReset();
  friendshipInviteDeleteMany.mockReset();
  executeRaw.mockReset();
  transaction.mockReset();

  inviteLinkCreate.mockResolvedValue({ token: "stored_token" });
  inviteLinkFindUnique.mockResolvedValue(null);
  blockFindFirst.mockResolvedValue(null);
  friendshipFindUnique.mockResolvedValue(null);
  friendshipCreate.mockResolvedValue({ id: "f1" });
  friendshipInviteDeleteMany.mockResolvedValue({ count: 0 });
  executeRaw.mockResolvedValue(0);
  transaction.mockImplementation(async (work: (client: typeof tx) => Promise<unknown>) => work(tx));
});

describe("ensureInviteLink", () => {
  it("creates the missing link with a fresh token for the given user", async () => {
    inviteLinkCreate.mockResolvedValue({ token: "fresh_token" });

    await expect(ensureInviteLink("u1")).resolves.toBe("fresh_token");

    expect(inviteLinkCreate).toHaveBeenCalledWith({
      data: { userId: "u1", token: expect.any(String) },
      select: { token: true },
    });
    const token = inviteLinkCreate.mock.calls[0][0].data.token as string;
    expect(token).toMatch(/^[a-z0-9]{20,}$/);
    expect(inviteLinkFindUnique).not.toHaveBeenCalled();
  });

  it("keeps the winner's token when a concurrent repair created the link first", async () => {
    const rows: { userId: string; token: string }[] = [];
    inviteLinkCreate.mockImplementation(
      async ({ data }: { data: { userId: string; token: string } }) => {
        if (rows.length > 0) throw p2002();
        rows.push({ userId: data.userId, token: data.token });
        return { token: data.token };
      },
    );
    inviteLinkFindUnique.mockImplementation(async ({ where }: { where: { userId: string } }) => {
      const row = rows.find((candidate) => candidate.userId === where.userId);
      return row === undefined ? null : { token: row.token };
    });

    const tokens = await Promise.all([ensureInviteLink("u1"), ensureInviteLink("u1")]);

    expect(rows).toHaveLength(1);
    expect(tokens).toEqual([rows[0].token, rows[0].token]);
    expect(inviteLinkCreate).toHaveBeenCalledTimes(2);
    expect(inviteLinkFindUnique).toHaveBeenCalledTimes(1);
    expect(inviteLinkFindUnique).toHaveBeenCalledWith({
      where: { userId: "u1" },
      select: { token: true },
    });
  });

  it("rethrows a unique failure that did not leave a link row", async () => {
    inviteLinkCreate.mockRejectedValue(p2002());
    inviteLinkFindUnique.mockResolvedValue(null);

    await expect(ensureInviteLink("u1")).rejects.toBeInstanceOf(PrismaClientKnownRequestError);
  });

  it("does not hide unrelated database failures", async () => {
    const failure = new Error("database unavailable");
    inviteLinkCreate.mockRejectedValue(failure);

    await expect(ensureInviteLink("u1")).rejects.toBe(failure);
    expect(inviteLinkFindUnique).not.toHaveBeenCalled();
  });
});

describe("inviteLinkStore", () => {
  it("reads the owner as the three fields the link shows", async () => {
    inviteLinkFindUnique.mockResolvedValue({
      user: { id: "u1", name: "Анна", nick: "anna" },
    });

    await expect(inviteLinkStore.findOwnerByToken("tok")).resolves.toEqual({
      id: "u1",
      displayName: "Анна",
      nick: "anna",
    });
    expect(inviteLinkFindUnique).toHaveBeenCalledWith({
      where: { token: "tok" },
      select: { user: { select: { id: true, name: true, nick: true } } },
    });
  });

  it("answers null for an unknown token", async () => {
    inviteLinkFindUnique.mockResolvedValue(null);

    await expect(inviteLinkStore.findOwnerByToken("nonsense")).resolves.toBeNull();
  });

  it("opens one READ COMMITTED transaction per accept", async () => {
    inviteLinkFindUnique.mockResolvedValue({
      user: { id: "zebra_owner", name: "Владелец", nick: "owner" },
    });

    const result = await inviteLinkStore.transaction(async (client) =>
      client.findOwnerByToken("tok"),
    );

    expect(result).toEqual({ id: "zebra_owner", displayName: "Владелец", nick: "owner" });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction.mock.calls[0][1]).toEqual({ isolationLevel: "ReadCommitted" });
  });
});

describe("inviteLinkTransaction", () => {
  it("takes the shared pair lock and writes through the friendship adapter", async () => {
    const client = inviteLinkTransaction(asTransactionClient(tx));

    await client.lockPair({ userLowId: "alpha_viewer", userHighId: "zebra_owner" });
    await client.createFriendship({ userLowId: "alpha_viewer", userHighId: "zebra_owner" });
    await client.deleteInvitesBetween("alpha_viewer", "zebra_owner");

    // The key of `pg_advisory_xact_lock` is the canonical pair, one per direction.
    expect(executeRaw.mock.calls[0][1]).toBe("alpha_viewer:zebra_owner");
    expect(friendshipCreate).toHaveBeenCalledWith({
      data: { userLowId: "alpha_viewer", userHighId: "zebra_owner" },
    });
    expect(friendshipInviteDeleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { fromUserId: "alpha_viewer", toUserId: "zebra_owner" },
          { fromUserId: "zebra_owner", toUserId: "alpha_viewer" },
        ],
      },
    });
  });

  it("reads the block and the edge from the same transaction client", async () => {
    blockFindFirst.mockResolvedValue({ id: "b1" });
    friendshipFindUnique.mockResolvedValue({ id: "f1" });
    const client = inviteLinkTransaction(asTransactionClient(tx));

    await expect(client.hasBlockBetween("a", "b")).resolves.toBe(true);
    await expect(
      client.findFriendship({ userLowId: "alpha_viewer", userHighId: "zebra_owner" }),
    ).resolves.toBe(true);

    expect(blockFindFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { blockerId: "a", blockedId: "b" },
          { blockerId: "b", blockedId: "a" },
        ],
      },
      select: { id: true },
    });
    expect(friendshipFindUnique).toHaveBeenCalledWith({
      where: { userLowId_userHighId: { userLowId: "alpha_viewer", userHighId: "zebra_owner" } },
      select: { id: true },
    });
  });
});
