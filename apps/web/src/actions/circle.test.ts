import { beforeEach, describe, expect, it, vi } from "vitest";

import { normalizeForSearch, type ProfileRelationship } from "@gift-list/contracts";
import type { CircleCandidate } from "@/domain/circle";

vi.mock("server-only", () => ({}));

const { getSession, reader } = vi.hoisted(() => ({
  getSession: vi.fn(),
  reader: {
    readFriends: vi.fn(),
    readSubscriptions: vi.fn(),
    readSubscribers: vi.fn(),
    readIncomingInvites: vi.fn(),
    readOutgoingInvites: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/lib/circle-store", () => ({ circleReader: reader }));

import { listFriends, listInvites, listSubscribers, listSubscriptions } from "./circle";

const session = { user: { id: "u9" }, session: {} };

type MemberSeed = {
  readonly id: string;
  readonly displayName?: string;
  readonly nick?: string;
  readonly relationship?: ProfileRelationship;
  readonly subscribed?: boolean;
  readonly followsViewer?: boolean;
  readonly blocked?: boolean;
};

function member(seed: MemberSeed): CircleCandidate {
  const displayName = seed.displayName ?? seed.id;
  return {
    id: seed.id,
    displayName,
    nick: seed.nick ?? displayName,
    nameNormalized: normalizeForSearch(displayName),
    relationship: seed.relationship ?? "FRIENDS",
    subscribed: seed.subscribed ?? false,
    followsViewer: seed.followsViewer ?? false,
    blocked: seed.blocked ?? false,
  };
}

/** `count` friends ordered by the alphabet: «Друг 01», «Друг 02», … */
function numberedFriends(count: number): CircleCandidate[] {
  return Array.from({ length: count }, function friendAt(_, index) {
    const number = String(index + 1).padStart(2, "0");
    return member({ id: `friend-${number}`, displayName: `Друг ${number}`, nick: `drug_${number}` });
  });
}

beforeEach(() => {
  getSession.mockReset();
  for (const read of Object.values(reader)) read.mockReset();

  getSession.mockResolvedValue(session);
  for (const read of Object.values(reader)) read.mockResolvedValue([]);
});

describe("circle list actions without a session", () => {
  it("answer UNAUTHENTICATED and never read the circle", async () => {
    getSession.mockResolvedValue(null);

    for (const action of [
      () => listFriends({}, new Headers()),
      () => listSubscriptions({}, new Headers()),
      () => listSubscribers({}, new Headers()),
      () => listInvites({}, new Headers()),
    ]) {
      await expect(action()).resolves.toEqual({
        ok: false,
        code: "UNAUTHENTICATED",
        message: "Authentication required",
      });
    }

    for (const read of Object.values(reader)) expect(read).not.toHaveBeenCalled();
  });
});

describe("listFriends", () => {
  it("answers a page of 15 rows with the full total and an opaque cursor", async () => {
    reader.readFriends.mockResolvedValue(numberedFriends(17));

    const result = await listFriends({}, new Headers());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toHaveLength(15);
    expect(result.data.total).toBe(17);
    expect(result.data.nextCursor).toBe("друг 15|friend-15");
    expect(reader.readFriends).toHaveBeenCalledWith("u9");
    expect(result.data.items[0]).toEqual({
      displayName: "Друг 01",
      nick: "drug_01",
      relationship: "FRIENDS",
      subscribed: false,
      followsYou: false,
    });
  });

  it("never puts the internal id, the sort key, email or wishes on the wire", async () => {
    const hidden = {
      ...member({ id: "hidden", displayName: "Скрытая", nick: "hidden" }),
      hideFromSearch: true,
      email: "hidden@example.com",
    };
    reader.readFriends.mockResolvedValue([hidden]);

    const result = await listFriends({}, new Headers());
    const json = JSON.stringify(result);

    expect(result.ok).toBe(true);
    expect(json).not.toContain("\"id\"");
    expect(json).not.toContain("nameNormalized");
    expect(json).not.toContain("hidden@example.com");
    expect(json).not.toContain("gifts");
    expect(json).not.toContain("hideFromSearch");
    expect(json).not.toContain("inviteCooldown");
  });

  it("keeps a friend hidden from the global search in the list (AD-13)", async () => {
    const hidden = {
      ...member({ id: "hidden", displayName: "Скрытая", nick: "hidden" }),
      hideFromSearch: true,
    };
    reader.readFriends.mockResolvedValue([hidden]);

    const result = await listFriends({}, new Headers());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items.map((card) => card.nick)).toEqual(["hidden"]);
    expect(result.data.total).toBe(1);
  });

  it("treats a blank query as the whole circle and searches the whole list", async () => {
    reader.readFriends.mockResolvedValue([
      member({ id: "alenka", displayName: "Алёна", nick: "alena" }),
      ...numberedFriends(3),
    ]);

    const all = await listFriends({ q: "   " }, new Headers());
    expect(all.ok).toBe(true);
    if (!all.ok) return;
    expect(all.data.total).toBe(4);

    const byYo = await listFriends({ q: "Алена" }, new Headers());
    expect(byYo.ok).toBe(true);
    if (!byYo.ok) return;
    expect(byYo.data.items.map((card) => card.nick)).toEqual(["alena"]);
    expect(byYo.data.total).toBe(1);
    expect(byYo.data.nextCursor).toBeNull();
  });

  it("pages from the cursor of the previous answer", async () => {
    reader.readFriends.mockResolvedValue(numberedFriends(17));

    const second = await listFriends({ cursor: "друг 15|friend-15" }, new Headers());

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.data.items.map((card) => card.nick)).toEqual(["drug_16", "drug_17"]);
    expect(second.data.nextCursor).toBeNull();
    expect(second.data.total).toBe(17);
  });

  it("maps a cursor the domain did not issue to VALIDATION on the cursor field", async () => {
    reader.readFriends.mockResolvedValue(numberedFriends(3));

    const result = await listFriends({ cursor: "мусор" }, new Headers());

    expect(result).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid cursor",
      field: "cursor",
    });
  });

  it("maps the two subscription facts of the row", async () => {
    reader.readFriends.mockResolvedValue([
      member({ id: "both", subscribed: true, followsViewer: true, relationship: "FRIENDS" }),
    ]);

    const result = await listFriends({}, new Headers());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items[0]).toMatchObject({ subscribed: true, followsYou: true });
  });
});

describe("listSubscriptions and listSubscribers", () => {
  it("read their own direction and never mix the two lists", async () => {
    reader.readSubscriptions.mockResolvedValue([
      member({ id: "followed", displayName: "Иван", nick: "ivan", subscribed: true }),
    ]);
    reader.readSubscribers.mockResolvedValue([
      member({ id: "follower", displayName: "Пётр", nick: "petr", followsViewer: true }),
    ]);

    const subscriptions = await listSubscriptions({}, new Headers());
    const subscribers = await listSubscribers({}, new Headers());

    expect(subscriptions.ok).toBe(true);
    expect(subscribers.ok).toBe(true);
    if (!subscriptions.ok || !subscribers.ok) return;
    expect(subscriptions.data.items).toEqual([
      {
        displayName: "Иван",
        nick: "ivan",
        relationship: "FRIENDS",
        subscribed: true,
        followsYou: false,
      },
    ]);
    expect(subscribers.data.items).toEqual([
      {
        displayName: "Пётр",
        nick: "petr",
        relationship: "FRIENDS",
        subscribed: false,
        followsYou: true,
      },
    ]);
    expect(reader.readSubscriptions).toHaveBeenCalledWith("u9");
    expect(reader.readSubscribers).toHaveBeenCalledWith("u9");
    expect(reader.readFriends).not.toHaveBeenCalled();
  });

  it("apply the same optional search filter as the friends tab", async () => {
    reader.readSubscriptions.mockResolvedValue([
      member({ id: "ivan", displayName: "Иван", nick: "ivan" }),
      member({ id: "anna", displayName: "Анна", nick: "anna" }),
    ]);

    const result = await listSubscriptions({ q: "анна" }, new Headers());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items.map((card) => card.nick)).toEqual(["anna"]);
    expect(result.data.total).toBe(1);
  });

  it("refuse a broken cursor on their own field", async () => {
    await expect(listSubscriptions({ cursor: "мусор" }, new Headers())).resolves.toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid cursor",
      field: "cursor",
    });
    await expect(listSubscribers({ cursor: "мусор" }, new Headers())).resolves.toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid cursor",
      field: "cursor",
    });
  });
});

describe("listInvites", () => {
  it("keeps incoming and outgoing apart with the full incoming count", async () => {
    reader.readIncomingInvites.mockResolvedValue(numberedFriends(17));
    reader.readOutgoingInvites.mockResolvedValue([
      member({ id: "out", displayName: "Борис", nick: "boris", relationship: "OUTGOING_PENDING" }),
    ]);

    const result = await listInvites({}, new Headers());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.incoming.items).toHaveLength(15);
    expect(result.data.incoming.total).toBe(17);
    expect(result.data.incoming.nextCursor).toBe("друг 15|friend-15");
    expect(result.data.outgoing.items.map((card) => card.nick)).toEqual(["boris"]);
    expect(result.data.outgoing.total).toBe(1);
    expect(result.data.outgoing.nextCursor).toBeNull();
    expect(result.data.incomingCount).toBe(17);
    expect(Object.keys(result.data).sort()).toEqual([
      "incoming",
      "incomingCount",
      "outgoing",
    ]);
  });

  it("keeps incomingCount full on a cursor page of the incoming half", async () => {
    reader.readIncomingInvites.mockResolvedValue(numberedFriends(17));
    reader.readOutgoingInvites.mockResolvedValue([]);

    const result = await listInvites({ incomingCursor: "друг 15|friend-15" }, new Headers());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.incoming.items.map((card) => card.nick)).toEqual(["drug_16", "drug_17"]);
    expect(result.data.incoming.total).toBe(17);
    expect(result.data.incomingCount).toBe(17);
    expect(reader.readIncomingInvites).toHaveBeenCalledTimes(2);
  });

  it("never puts the internal id or wishes into either half", async () => {
    reader.readIncomingInvites.mockResolvedValue([member({ id: "in" })]);
    reader.readOutgoingInvites.mockResolvedValue([member({ id: "out" })]);

    const result = await listInvites({}, new Headers());
    const json = JSON.stringify(result);

    expect(result.ok).toBe(true);
    expect(json).not.toContain("\"id\"");
    expect(json).not.toContain("nameNormalized");
    expect(json).not.toContain("gifts");
  });

  it("names the half whose cursor is broken", async () => {
    reader.readIncomingInvites.mockResolvedValue(numberedFriends(3));
    reader.readOutgoingInvites.mockResolvedValue([]);

    await expect(listInvites({ incomingCursor: "мусор" }, new Headers())).resolves.toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid cursor",
      field: "incomingCursor",
    });

    reader.readOutgoingInvites.mockResolvedValue([member({ id: "out" })]);
    await expect(listInvites({ outgoingCursor: "мусор" }, new Headers())).resolves.toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Invalid cursor",
      field: "outgoingCursor",
    });
  });
});
