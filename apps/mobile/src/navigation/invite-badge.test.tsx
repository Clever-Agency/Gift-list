// @vitest-environment happy-dom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  InviteBadgeProvider,
  useInviteBadge,
  type InviteBadgeValue,
} from "./invite-badge";
import { settle } from "@/test/dom";

const invites = vi.hoisted(() => ({ fetchInvites: vi.fn() }));
/** The session is not under test: `useAuth` answers with whatever the case needs. */
const session = vi.hoisted(() => ({
  state: { status: "anonymous" } as {
    status: string;
    user?: { id: string };
  },
}));

vi.mock("@/api/circle", () => invites);
vi.mock("@/session/auth-context", () => ({
  useAuth: () => ({
    state: session.state,
    setUser: vi.fn(),
    signOut: vi.fn(),
    retry: vi.fn(),
  }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type SessionState = typeof session.state;

const signedIn: SessionState = { status: "ready", user: { id: "u1" } };

/** `GET /me/invites` the way `fetchInvites` returns it: the count is not a page. */
function invitesAnswer(count: number) {
  const page = { items: [], total: count, nextCursor: null };
  return {
    ok: true,
    invites: {
      incoming: page,
      outgoing: { items: [], total: 0, nextCursor: null },
      incomingCount: count,
    },
  };
}

const networkFailure = { ok: false, network: true };
const expiredSession = { ok: false, code: "UNAUTHENTICATED", message: "" };

const probe: { badge?: InviteBadgeValue } = {};

function badge(): InviteBadgeValue {
  if (!probe.badge) throw new Error("Probe не получил useInviteBadge()");
  return probe.badge;
}

function Probe() {
  const value = useInviteBadge();
  useEffect(() => {
    probe.badge = value;
  });
  return null;
}

Probe.displayName = "Probe";

let root: Root;
let container: HTMLElement;

function badgeTree() {
  return (
    <InviteBadgeProvider>
      <Probe />
    </InviteBadgeProvider>
  );
}

/** Renders the provider with the session the case has put into `session.state`. */
async function mount() {
  await act(async () => {
    root.render(badgeTree());
  });
  await settle();
}

/** Moves the mocked session, the way `AuthProvider` would after its read. */
async function setSession(next: SessionState) {
  session.state = next;
  await mount();
}

async function refresh() {
  await act(async () => {
    badge().refresh();
  });
  await settle();
}

beforeEach(() => {
  vi.resetAllMocks();
  delete probe.badge;
  session.state = { status: "anonymous" };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("InviteBadgeProvider", () => {
  it("после входа читает /me/invites один раз и берёт incomingCount", async () => {
    session.state = signedIn;
    invites.fetchInvites.mockResolvedValue(invitesAnswer(2));

    await mount();

    expect(invites.fetchInvites).toHaveBeenCalledTimes(1);
    expect(invites.fetchInvites).toHaveBeenCalledWith();
    expect(badge().count).toBe(2);
  });

  it("ноль означает «badge нет»", async () => {
    session.state = signedIn;
    invites.fetchInvites.mockResolvedValue(invitesAnswer(0));

    await mount();

    expect(badge().count).toBe(0);
  });

  it("число больше 99 приходит как есть: «99+» рисует Badge", async () => {
    session.state = signedIn;
    invites.fetchInvites.mockResolvedValue(invitesAnswer(120));

    await mount();

    expect(badge().count).toBe(120);
  });

  it("чтение начинается, когда сессия стала ready, а не на loading", async () => {
    session.state = { status: "loading" };
    invites.fetchInvites.mockResolvedValue(invitesAnswer(1));

    await mount();
    expect(invites.fetchInvites).not.toHaveBeenCalled();
    expect(badge().count).toBeNull();

    await setSession(signedIn);
    expect(invites.fetchInvites).toHaveBeenCalledTimes(1);
    expect(badge().count).toBe(1);
  });

  it("аноним не делает запрос и badge нет", async () => {
    session.state = { status: "anonymous" };
    invites.fetchInvites.mockResolvedValue(invitesAnswer(3));

    await mount();
    await refresh();

    expect(invites.fetchInvites).not.toHaveBeenCalled();
    expect(badge().count).toBeNull();
  });

  it("ошибка первого чтения оставляет badge пустым", async () => {
    session.state = signedIn;
    invites.fetchInvites.mockResolvedValue(networkFailure);

    await mount();

    expect(badge().count).toBeNull();
  });

  it("сетевая ошибка после успешного чтения сохраняет последнее число", async () => {
    session.state = signedIn;
    invites.fetchInvites.mockResolvedValue(invitesAnswer(3));
    await mount();
    expect(badge().count).toBe(3);

    invites.fetchInvites.mockResolvedValue(networkFailure);
    await refresh();

    expect(invites.fetchInvites).toHaveBeenCalledTimes(2);
    expect(badge().count).toBe(3);
  });

  it("UNAUTHENTICATED снимает badge: сессией ведёт AuthContext", async () => {
    session.state = signedIn;
    invites.fetchInvites.mockResolvedValue(invitesAnswer(2));
    await mount();
    expect(badge().count).toBe(2);

    invites.fetchInvites.mockResolvedValue(expiredSession);
    await refresh();

    expect(badge().count).toBeNull();
  });

  it("refresh повторяет чтение и обновляет число", async () => {
    session.state = signedIn;
    invites.fetchInvites.mockResolvedValue(invitesAnswer(2));
    await mount();

    invites.fetchInvites.mockResolvedValue(invitesAnswer(5));
    await refresh();

    expect(invites.fetchInvites).toHaveBeenCalledTimes(2);
    expect(badge().count).toBe(5);
  });

  it("поздний ответ первого чтения не перекрывает ответ refresh", async () => {
    session.state = signedIn;
    let resolveFirst: ((value: unknown) => void) | undefined;
    let resolveSecond: ((value: unknown) => void) | undefined;
    invites.fetchInvites
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );

    await mount();
    await refresh();

    await act(async () => {
      resolveSecond?.(invitesAnswer(7));
    });
    await act(async () => {
      resolveFirst?.(invitesAnswer(2));
    });
    await settle();

    expect(badge().count).toBe(7);
  });

  it("после выхода число сбрасывается и нового запроса нет", async () => {
    session.state = signedIn;
    invites.fetchInvites.mockResolvedValue(invitesAnswer(4));
    await mount();
    expect(badge().count).toBe(4);

    await setSession({ status: "anonymous" });

    expect(badge().count).toBeNull();
    expect(invites.fetchInvites).toHaveBeenCalledTimes(1);
  });
});
