import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/db/generated/client";

vi.mock("server-only", () => ({}));

const {
  inviteLinkFindUniqueOrThrow,
  inviteLinkFindUnique,
  blockFindFirst,
  friendshipFindUnique,
  friendshipCreate,
  friendshipInviteDeleteMany,
  executeRaw,
  transaction,
  RecordNotFoundError,
} = vi.hoisted(() => {
  class RecordNotFoundError extends Error {
    code = "P2025";
    constructor() {
      super("An operation failed because it depends on one or more records that were required but not found.");
    }
  }

  return {
    inviteLinkFindUniqueOrThrow: vi.fn(),
    inviteLinkFindUnique: vi.fn(),
    blockFindFirst: vi.fn(),
    friendshipFindUnique: vi.fn(),
    friendshipCreate: vi.fn(),
    friendshipInviteDeleteMany: vi.fn(),
    executeRaw: vi.fn(),
    transaction: vi.fn(),
    RecordNotFoundError,
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
    inviteLink: { findUniqueOrThrow: inviteLinkFindUniqueOrThrow, findUnique: inviteLinkFindUnique },
    block: { findFirst: blockFindFirst },
    friendship: { findUnique: friendshipFindUnique, create: friendshipCreate },
    friendshipInvite: { deleteMany: friendshipInviteDeleteMany },
    $transaction: transaction,
  },
}));

import { inviteLinkStore, inviteLinkTransaction, readInviteLinkToken } from "./invite-link-store";

beforeEach(() => {
  inviteLinkFindUniqueOrThrow.mockReset();
  inviteLinkFindUnique.mockReset();
  blockFindFirst.mockReset();
  friendshipFindUnique.mockReset();
  friendshipCreate.mockReset();
  friendshipInviteDeleteMany.mockReset();
  executeRaw.mockReset();
  transaction.mockReset();

  inviteLinkFindUniqueOrThrow.mockResolvedValue({ token: "stored_token" });
  inviteLinkFindUnique.mockResolvedValue(null);
  blockFindFirst.mockResolvedValue(null);
  friendshipFindUnique.mockResolvedValue(null);
  friendshipCreate.mockResolvedValue({ id: "f1" });
  friendshipInviteDeleteMany.mockResolvedValue({ count: 0 });
  executeRaw.mockResolvedValue(0);
  transaction.mockImplementation(async (work: (client: typeof tx) => Promise<unknown>) => work(tx));
});

describe("readInviteLinkToken", () => {
  it("returns the stored token for the user and never writes", async () => {
    inviteLinkFindUniqueOrThrow.mockResolvedValue({ token: "live_token" });

    await expect(readInviteLinkToken("u1")).resolves.toBe("live_token");

    expect(inviteLinkFindUniqueOrThrow).toHaveBeenCalledWith({
      where: { userId: "u1" },
      select: { token: true },
    });
    expect(inviteLinkFindUniqueOrThrow).toHaveBeenCalledTimes(1);
  });

  it("refuses when the row is missing instead of creating one", async () => {
    inviteLinkFindUniqueOrThrow.mockRejectedValue(new RecordNotFoundError());

    await expect(readInviteLinkToken("u1")).rejects.toBeInstanceOf(RecordNotFoundError);
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
