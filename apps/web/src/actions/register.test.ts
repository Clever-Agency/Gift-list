import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  InviteLinkOwner,
  InviteLinkTransaction,
} from "@/domain/invite-link";
import type { FriendshipPair } from "@/domain/friendship";

vi.mock("server-only", () => ({}));

const {
  findFirst,
  create,
  transaction,
  inviteLinkTransaction,
  signInEmail,
  consumeRateLimit,
  authRateLimit,
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
    findFirst: vi.fn(),
    create: vi.fn(),
    transaction: vi.fn(),
    inviteLinkTransaction: vi.fn(),
    signInEmail: vi.fn(),
    consumeRateLimit: vi.fn(),
    authRateLimit: vi.fn(),
    PrismaClientKnownRequestError,
  };
});

vi.mock("@/db/client", () => ({
  prisma: { user: { findFirst }, $transaction: transaction },
}));
vi.mock("@/db/generated/client", () => ({
  Prisma: {
    PrismaClientKnownRequestError,
    TransactionIsolationLevel: { ReadCommitted: "ReadCommitted" },
  },
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { signInEmail } } }));
vi.mock("@/lib/invite-link-store", () => ({ inviteLinkTransaction }));
vi.mock("@/lib/rate-limit", () => ({
  DEFAULT_AUTH_RATE_LIMIT: { max: 5, windowSeconds: 3600 },
  authRateLimit,
  consumeRateLimit,
  clientIp: () => "127.0.0.1",
}));

const isPasswordPwnedFailOpen = vi.hoisted(() => vi.fn());

vi.mock("@/lib/hibp-password", () => ({
  isPasswordPwnedFailOpen,
}));

import { registerUser } from "./register";

const input = {
  email: "a@example.com",
  password: "password1234",
  displayName: "Анна",
  nick: "anna",
};

/** Two successful registrations mint different ids; every other field must match. */
function withoutUserId(result: Awaited<ReturnType<typeof registerUser>>["result"]) {
  if (!result.ok) return result;
  const user: Record<string, unknown> = { ...result.data.user };
  delete user.id;
  return { ...result, data: { ...result.data, user } };
}

const OWNER: InviteLinkOwner = { id: "zebra_owner", displayName: "Сергей", nick: "sergey" };
const LINK_TOKEN = "invite_token_1";

type PortMemory = {
  owners: Map<string, InviteLinkOwner>;
  lookups: string[];
  /** The new user id is generated at runtime, so the flag stands for its pair row. */
  blocked: boolean;
  failFriendship: boolean;
  friendships: FriendshipPair[];
  invites: { fromUserId: string; toUserId: string }[];
  writes: string[];
  locks: FriendshipPair[];
  blockChecks: Array<[string, string]>;
};

function createPortMemory(seed: Partial<PortMemory> = {}): PortMemory {
  return {
    owners: new Map(),
    lookups: [],
    blocked: false,
    failFriendship: false,
    friendships: [],
    invites: [],
    writes: [],
    locks: [],
    blockChecks: [],
    ...seed,
  };
}

/** The invite-link port inside the registration transaction, without a database. */
function createInvitePort(memory: PortMemory): InviteLinkTransaction {
  return {
    async findOwnerByToken(token) {
      memory.lookups.push(token);
      return memory.owners.get(token) ?? null;
    },
    async hasBlockBetween(firstUserId, secondUserId) {
      memory.blockChecks.push([firstUserId, secondUserId]);
      return memory.blocked;
    },
    async findFriendship(pair) {
      return memory.friendships.some(
        (edge) => edge.userLowId === pair.userLowId && edge.userHighId === pair.userHighId,
      );
    },
    async lockPair(pair) {
      memory.locks.push(pair);
    },
    async createFriendship(pair) {
      if (memory.failFriendship) throw new Error("friendship write failed");
      memory.friendships.push(pair);
      memory.writes.push("friendship");
    },
    async deleteInvitesBetween(firstUserId, secondUserId) {
      memory.invites = memory.invites.filter(
        (invite) =>
          !(
            (invite.fromUserId === firstUserId && invite.toUserId === secondUserId) ||
            (invite.fromUserId === secondUserId && invite.toUserId === firstUserId)
          ),
      );
      memory.writes.push("delete-invites");
    },
  };
}

let port: PortMemory;

function headers(language = "ru-BY") {
  return new Headers({ "accept-language": language });
}

beforeEach(() => {
  findFirst.mockReset();
  create.mockReset();
  transaction.mockReset();
  inviteLinkTransaction.mockReset();
  signInEmail.mockReset();
  consumeRateLimit.mockReset();
  authRateLimit.mockReset();

  port = createPortMemory();
  findFirst.mockResolvedValue(null);
  create.mockResolvedValue({});
  signInEmail.mockResolvedValue(new Response(null, { status: 200 }));
  authRateLimit.mockReturnValue({ max: 42, windowSeconds: 7 });
  consumeRateLimit.mockResolvedValue({ allowed: true });
  // The prisma transaction hands its client to the callback, exactly like
  // `$transaction`; the client carries the invite-link port of this test.
  transaction.mockImplementation(async (work: (client: unknown) => Promise<unknown>) =>
    work({ user: { create }, invite: createInvitePort(port) }),
  );
  inviteLinkTransaction.mockImplementation((client: { invite: InviteLinkTransaction }) => {
    return client.invite;
  });
  isPasswordPwnedFailOpen.mockReset();
  isPasswordPwnedFailOpen.mockResolvedValue(false);
});

describe("registerUser", () => {
  it("rejects a short password before the database and without a breach check", async () => {
    const outcome = await registerUser({ ...input, password: "short" }, headers());
    expect(outcome.result).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "password",
      reason: "PASSWORD_TOO_SHORT",
    });
    expect(findFirst).not.toHaveBeenCalled();
    expect(isPasswordPwnedFailOpen).not.toHaveBeenCalled();
  });

  it("rejects a leaked password before the database", async () => {
    isPasswordPwnedFailOpen.mockResolvedValue(true);
    const outcome = await registerUser(input, headers());
    expect(outcome.result).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "password",
      reason: "PASSWORD_PWNED",
    });
    expect(findFirst).toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });
  it("creates one list without a type and stores the negotiated locale", async () => {
    const outcome = await registerUser(input, headers());
    expect(outcome.result).toMatchObject({
      ok: true,
      data: {
        user: { email: "a@example.com", name: "Анна", nick: "anna", timeZone: null, hideFromSearch: false },
        next: "/",
      },
    });
    const data = create.mock.calls[0]?.[0].data;
    expect(data.locale).toBe("ru");
    expect(data.nameNormalized).toBe("анна");
    expect(data.lists.create).toEqual({ publicToken: expect.any(String) });
    expect(data.lists.create).not.toHaveProperty("type");
    expect(data.accounts.create.accountId).toBe(data.id);
    expect(outcome.session).toBeInstanceOf(Response);
  });

  it("creates the account, the list and the invite link in one transaction (AD-21)", async () => {
    await registerUser(input, headers());

    expect(transaction).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0]?.[0].data;
    expect(data.inviteLink.create).toEqual({ token: expect.any(String) });
    expect(data.inviteLink.create.token).toMatch(/^[a-z0-9]{20,}$/);
    // No token on the body: the link is never looked up and nothing is written.
    expect(port.lookups).toEqual([]);
    expect(port.writes).toEqual([]);
  });

  it("falls back to ru when Accept-Language has no supported tag", async () => {
    await registerUser(input, headers("en-US"));
    expect(create.mock.calls[0]?.[0].data.locale).toBe("ru");
  });

  it("rewrites a list link and drops an absolute next", async () => {
    const list = await registerUser({ ...input, next: "/l/tok_1" }, headers());
    expect(list.result).toMatchObject({ ok: true, data: { next: "/wishlist/tok_1" } });
    const external = await registerUser({ ...input, next: "https://evil.test" }, headers());
    expect(external.result).toMatchObject({ ok: true, data: { next: "/" } });
  });

  it("creates the friendship in the registration transaction when the invite token is live (AD-21)", async () => {
    port.owners.set(LINK_TOKEN, OWNER);

    const outcome = await registerUser({ ...input, inviteToken: LINK_TOKEN }, headers());

    expect(outcome.result).toMatchObject({ ok: true, data: { next: "/" } });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(port.lookups).toEqual([LINK_TOKEN]);
    const userId = create.mock.calls[0]?.[0].data.id as string;
    // One canonical edge: the new account and the link owner, ordered by id.
    const pair: FriendshipPair =
      userId < OWNER.id
        ? { userLowId: userId, userHighId: OWNER.id }
        : { userLowId: OWNER.id, userHighId: userId };
    expect(port.locks).toEqual([pair]);
    expect(port.friendships).toEqual([pair]);
    expect(port.writes).toEqual(["friendship", "delete-invites"]);
  });

  it("succeeds without a friendship when the invite token is unknown", async () => {
    const outcome = await registerUser({ ...input, inviteToken: "nonsense" }, headers());

    // The answer is the one of a registration without a token (AD-21).
    expect(outcome.result).toMatchObject({
      ok: true,
      data: {
        user: { email: "a@example.com", name: "Анна", nick: "anna", timeZone: null, hideFromSearch: false },
        next: "/",
      },
    });
    expect(port.lookups).toEqual(["nonsense"]);
    expect(port.locks).toEqual([]);
    expect(port.writes).toEqual([]);
  });

  it("succeeds without a friendship when the pair is blocked", async () => {
    port.owners.set(LINK_TOKEN, OWNER);
    port.blocked = true;

    const outcome = await registerUser({ ...input, inviteToken: LINK_TOKEN }, headers());

    expect(outcome.result).toMatchObject({ ok: true, data: { next: "/" } });
    expect(port.friendships).toEqual([]);
    expect(port.writes).toEqual([]);
  });

  it("sends a blocked invite and an unknown token home with one body (CLE-99)", async () => {
    const inviteNext = "/invite/tok_1";
    const unknown = await registerUser(
      { ...input, inviteToken: "nonsense", next: inviteNext },
      headers(),
    );

    port.owners.set(LINK_TOKEN, OWNER);
    port.blocked = true;
    const blocked = await registerUser(
      { ...input, inviteToken: LINK_TOKEN, next: inviteNext },
      headers(),
    );

    expect(withoutUserId(unknown.result)).toEqual({
      ok: true,
      data: {
        user: {
          email: "a@example.com",
          name: "Анна",
          nick: "anna",
          timeZone: null,
          hideFromSearch: false,
        },
        next: "/",
      },
    });
    // Block and an unknown token stay indistinguishable, including `next`.
    expect(withoutUserId(blocked.result)).toEqual(withoutUserId(unknown.result));
    expect(JSON.stringify(blocked.result)).not.toContain("block");
    expect(JSON.stringify(blocked.result)).not.toContain(OWNER.displayName);
    expect(JSON.stringify(blocked.result)).not.toContain(OWNER.nick);
    expect(port.friendships).toEqual([]);
    expect(port.writes).toEqual([]);
    if (!blocked.result.ok) throw new Error("expected a successful registration");
    expect(port.blockChecks).toEqual([[blocked.result.data.user.id, OWNER.id]]);
  });

  it("keeps the invite screen when registration creates the friendship (CLE-99)", async () => {
    port.owners.set(LINK_TOKEN, OWNER);

    const outcome = await registerUser(
      { ...input, inviteToken: LINK_TOKEN, next: "/invite/tok_1?from=page" },
      headers(),
    );

    expect(outcome.result).toMatchObject({
      ok: true,
      data: { next: "/invite/tok_1?from=page" },
    });
    expect(port.friendships).toHaveLength(1);
  });

  it("keeps the invite screen when the body does not carry a token (CLE-99)", async () => {
    const outcome = await registerUser({ ...input, next: "/invite/tok_1" }, headers());

    expect(outcome.result).toMatchObject({ ok: true, data: { next: "/invite/tok_1" } });
    expect(port.lookups).toEqual([]);
    expect(port.blockChecks).toEqual([]);
  });

  it("drops an invite return path with a query the same way for a block and an unknown token (CLE-99)", async () => {
    const next = "/i/tok_1?from=page";
    const unknown = await registerUser({ ...input, inviteToken: "nonsense", next }, headers());

    port.owners.set(LINK_TOKEN, OWNER);
    port.blocked = true;
    const blocked = await registerUser({ ...input, inviteToken: LINK_TOKEN, next }, headers());

    expect(withoutUserId(unknown.result)).toMatchObject({ ok: true, data: { next: "/" } });
    expect(withoutUserId(blocked.result)).toEqual(withoutUserId(unknown.result));
    expect(port.friendships).toEqual([]);
  });

  it("creates no friendship and no subscription from a /l/ next path (AD-15-11)", async () => {
    // AD-15-11: the same live token that would create a friendship on `/i/` must
    // do nothing when the registration came through a list link.
    port.owners.set(LINK_TOKEN, OWNER);

    const outcome = await registerUser(
      { ...input, next: "/l/tok_1", inviteToken: LINK_TOKEN },
      headers(),
    );

    expect(outcome.result).toMatchObject({ ok: true, data: { next: "/wishlist/tok_1" } });
    expect(port.lookups).toEqual([]);
    expect(port.friendships).toEqual([]);
    expect(port.writes).toEqual([]);
  });

  it("rolls the registration back when the friendship write fails (AD-21)", async () => {
    port.owners.set(LINK_TOKEN, OWNER);
    port.failFriendship = true;

    await expect(registerUser({ ...input, inviteToken: LINK_TOKEN }, headers())).rejects.toThrow(
      "friendship write failed",
    );
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it("maps a duplicate email to EMAIL_TAKEN, including when the nick is taken too", async () => {
    findFirst.mockResolvedValue({ email: "a@example.com", nickNormalized: "anna" });
    expect((await registerUser(input, headers())).result).toMatchObject({
      ok: false,
      code: "VALIDATION",
      reason: "EMAIL_TAKEN",
      field: "email",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("maps a duplicate nick to NICK_TAKEN", async () => {
    findFirst.mockResolvedValue({ email: "b@example.com", nickNormalized: "anna" });
    expect((await registerUser(input, headers())).result).toMatchObject({
      reason: "NICK_TAKEN",
      field: "nick",
    });
  });

  it("rethrows a unique failure that left no user row", async () => {
    create.mockRejectedValue(new PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002" }));

    await expect(registerUser(input, headers())).rejects.toBeInstanceOf(
      PrismaClientKnownRequestError,
    );
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it("does not open a session when sign-in fails", async () => {
    signInEmail.mockResolvedValue(new Response(null, { status: 401 }));
    const outcome = await registerUser(input, headers());
    expect(outcome.result).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(outcome.session).toBeUndefined();
  });

  it("spends the registration counter with the configured auth limit", async () => {
    await registerUser(input, headers());
    expect(authRateLimit).toHaveBeenCalled();
    expect(consumeRateLimit).toHaveBeenCalledWith("register:127.0.0.1", {
      max: 42,
      windowSeconds: 7,
    });
  });
});

/**
 * AD-13 / CLE-94: the unique index on `nickNormalized` is the last word, but the
 * use-case must look up and store the canonical form on its own, not rely on the
 * HTTP body schema having lower-cased the nick first.
 */
describe("registerUser nick uniqueness", () => {
  type StoredUser = { email: string; nickNormalized: string };
  type FindFirstArgs = {
    where: { OR: { email?: string; nickNormalized?: string }[] };
  };
  type CreateArgs = { data: { email: string; nickNormalized: string } };

  /** The two unique indexes of `User`, emulated in memory. */
  function uniqueStore(rows: StoredUser[] = []): StoredUser[] {
    findFirst.mockImplementation(async ({ where }: FindFirstArgs) => {
      return (
        rows.find((row) =>
          where.OR.some((condition) =>
            condition.email !== undefined
              ? condition.email === row.email
              : condition.nickNormalized === row.nickNormalized,
          ),
        ) ?? null
      );
    });
    create.mockImplementation(async ({ data }: CreateArgs) => {
      if (rows.some((row) => row.email === data.email || row.nickNormalized === data.nickNormalized)) {
        throw new PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002" });
      }
      rows.push({ email: data.email, nickNormalized: data.nickNormalized });
      return {};
    });
    return rows;
  }

  it("stores and looks up the canonical nick when the caller skipped the body schema", async () => {
    const rows = uniqueStore();

    const outcome = await registerUser({ ...input, nick: " Anna_1 " }, headers());

    expect(outcome.result).toMatchObject({ ok: true, data: { user: { nick: "anna_1" } } });
    expect(findFirst).toHaveBeenCalledWith({
      where: { OR: [{ email: "a@example.com" }, { nickNormalized: "anna_1" }] },
      select: { email: true, nickNormalized: true },
    });
    expect(create.mock.calls[0]?.[0].data).toMatchObject({
      nick: "anna_1",
      nickNormalized: "anna_1",
    });
    expect(rows).toEqual([{ email: "a@example.com", nickNormalized: "anna_1" }]);
  });

  it("refuses a case variant of a taken nick with NICK_TAKEN", async () => {
    uniqueStore([{ email: "b@example.com", nickNormalized: "anna_1" }]);

    const outcome = await registerUser({ ...input, nick: "ANNA_1" }, headers());

    expect(outcome.result).toMatchObject({
      ok: false,
      code: "VALIDATION",
      field: "nick",
      reason: "NICK_TAKEN",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("answers NICK_TAKEN, not 500, when the unique index decides the race", async () => {
    const rows = uniqueStore();
    create.mockImplementationOnce(async ({ data }: CreateArgs) => {
      // The parallel registration committed first; the index then refuses this row.
      rows.push({ email: "b@example.com", nickNormalized: data.nickNormalized });
      throw new PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002" });
    });

    const outcome = await registerUser({ ...input, nick: "ANNA_1" }, headers());

    expect(outcome.result).toMatchObject({
      ok: false,
      code: "VALIDATION",
      field: "nick",
      reason: "NICK_TAKEN",
    });
  });
});
