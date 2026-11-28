// @vitest-environment happy-dom
import type { Me } from "@gift-list/contracts";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth-context";
import { consumeAuthEmail, forgetAuthEmail, rememberAuthEmail } from "./auth-navigation";
import { settle } from "@/test/dom";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const store = vi.hoisted(() => ({ clearSessionToken: vi.fn() }));
const zone = vi.hoisted(() => ({ deviceTimeZone: vi.fn() }));
const sessionEvents = vi.hoisted(() => ({
  openSessionEvents: vi.fn(),
  publish: vi.fn(),
  close: vi.fn(),
}));

vi.mock("@/api/client", () => api);
vi.mock("@/platform/session-token", () => store);
vi.mock("@/platform/session-events", () => ({ openSessionEvents: sessionEvents.openSessionEvents }));
vi.mock("@/session/device-time-zone", () => zone);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type Auth = ReturnType<typeof useAuth>;

const user: Me = {
  id: "u1",
  email: "a@b.test",
  name: "Аня",
  nick: "anya",
  timeZone: "Europe/Minsk",
  hideFromSearch: false,
};
const anotherUser: Me = { ...user, id: "u2", email: "other@b.test", nick: "other" };

function receiveSessionChange() {
  const [onChange] = sessionEvents.openSessionEvents.mock.lastCall ?? [];
  if (!onChange) throw new Error("AuthProvider не подписался на смену сессии");
  onChange();
}

const probe: { auth?: Auth } = {};

function auth(): Auth {
  if (!probe.auth) throw new Error("Probe не получил useAuth()");
  return probe.auth;
}
let root: Root;
let container: HTMLElement;

function Probe({ onAuth }: { onAuth: (value: Auth) => void }) {
  const value = useAuth();
  useEffect(() => {
    onAuth(value);
  });
  return null;
}

async function mount() {
  await act(async () => {
    root.render(
      <AuthProvider>
        <Probe
          onAuth={(value) => {
            probe.auth = value;
          }}
        />
      </AuthProvider>,
    );
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  sessionEvents.openSessionEvents.mockReturnValue(sessionEvents);
  forgetAuthEmail();
  delete probe.auth;
  zone.deviceTimeZone.mockReturnValue("Asia/Tokyo");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("AuthProvider", () => {
  it("загружает пользователя при монтировании и не отправляет часовой пояс, если он задан", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: user });
    await mount();
    expect(api.apiRequest).toHaveBeenCalledTimes(1);
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/me");
    expect(auth().state).toEqual({ status: "ready", user });
    expect(sessionEvents.publish).not.toHaveBeenCalled();
  });

  it("при UNAUTHENTICATED очищает токен и переводит в anonymous", async () => {
    api.apiRequest.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "",
    });
    await mount();
    expect(store.clearSessionToken).toHaveBeenCalledTimes(1);
    expect(auth().state).toEqual({ status: "anonymous" });
  });

  it("при сетевой ошибке не очищает токен и переходит в error, а не anonymous", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, network: true });
    await mount();
    expect(store.clearSessionToken).not.toHaveBeenCalled();
    expect(auth().state).toEqual({ status: "error" });
  });

  it("при другой ошибке API не очищает токен и тоже переходит в error", async () => {
    api.apiRequest.mockResolvedValue({
      ok: false,
      code: "RATE_LIMITED",
      message: "",
    });
    await mount();
    expect(store.clearSessionToken).not.toHaveBeenCalled();
    expect(auth().state).toEqual({ status: "error" });
  });

  it("retry перечитывает /api/v1/me и переводит error в ready", async () => {
    api.apiRequest.mockResolvedValueOnce({ ok: false, network: true });
    await mount();
    expect(auth().state).toEqual({ status: "error" });

    api.apiRequest.mockResolvedValueOnce({ ok: true, data: user });
    await act(async () => auth().retry());
    await settle();

    expect(api.apiRequest).toHaveBeenCalledTimes(2);
    expect(api.apiRequest).toHaveBeenLastCalledWith("/api/v1/me");
    expect(auth().state).toEqual({ status: "ready", user });
  });

  it("retry показывает loading, пока второй ответ не пришёл", async () => {
    api.apiRequest.mockResolvedValueOnce({ ok: false, network: true });
    await mount();
    expect(auth().state).toEqual({ status: "error" });

    let resolveSecond: ((value: unknown) => void) | undefined;
    api.apiRequest.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecond = resolve;
        }),
    );
    await act(async () => auth().retry());
    expect(auth().state).toEqual({ status: "loading" });

    await act(async () => {
      resolveSecond?.({ ok: true, data: user });
    });
    await settle();
    expect(auth().state).toEqual({ status: "ready", user });
  });

  it("без часового пояса отправляет пояс устройства и обновляет пользователя", async () => {
    api.apiRequest.mockImplementation(async (path: string) =>
      path === "/api/v1/me"
        ? { ok: true, data: { ...user, timeZone: null } }
        : { ok: true, data: { timeZone: "Asia/Tokyo" } },
    );
    await mount();
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/me/time-zone", {
      method: "PUT",
      body: { timeZone: "Asia/Tokyo" },
    });
    expect(auth().state).toEqual({
      status: "ready",
      user: { ...user, timeZone: "Asia/Tokyo" },
    });
  });

  it("после изменения профиля обновляет пользователя без запроса и рассылки", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: user });
    await mount();
    const changed = { ...user, nick: "newnick" };

    await act(async () => auth().updateUser(changed));

    expect(auth().state).toEqual({ status: "ready", user: changed });
    expect(api.apiRequest).toHaveBeenCalledTimes(1);
    expect(sessionEvents.publish).not.toHaveBeenCalled();
  });

  it("устанавливает новую сессию после входа или регистрации и оповещает соседние вкладки", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: user });
    await mount();

    await act(async () => auth().setUser(anotherUser));

    expect(auth().state).toEqual({ status: "ready", user: anotherUser });
    expect(api.apiRequest).toHaveBeenCalledTimes(1);
    expect(sessionEvents.publish).toHaveBeenCalledExactlyOnceWith();
  });

  it("поздняя правка профиля прежнего пользователя не заменяет другого зрителя", async function ignorePreviousProfile() {
    api.apiRequest.mockResolvedValueOnce({ ok: true, data: anotherUser });
    await mount();

    await act(async function receivePreviousProfile() {
      auth().updateUser({ ...user, nick: "newnick" });
    });

    expect(auth().state).toEqual({ status: "ready", user: anotherUser });
    expect(sessionEvents.publish).not.toHaveBeenCalled();
  });

  it("по сигналу перечитывает сессию через loading и не рассылает ответ", async () => {
    api.apiRequest.mockResolvedValueOnce({ ok: true, data: user });
    await mount();
    const guest = Promise.withResolvers<unknown>();
    api.apiRequest.mockReturnValueOnce(guest.promise);

    await act(async () => receiveSessionChange());
    expect(auth().state).toEqual({ status: "loading" });
    expect(api.apiRequest).toHaveBeenCalledTimes(2);
    expect(api.apiRequest).toHaveBeenLastCalledWith("/api/v1/me");

    await act(async () => guest.resolve({ ok: false, code: "UNAUTHENTICATED" }));
    expect(auth().state).toEqual({ status: "anonymous" });
    expect(sessionEvents.publish).not.toHaveBeenCalled();
  });

  it("после двух сигналов принимает свежий ответ и игнорирует прежнего пользователя", async () => {
    api.apiRequest.mockResolvedValueOnce({ ok: true, data: user });
    await mount();
    const previous = Promise.withResolvers<unknown>();
    api.apiRequest.mockReturnValueOnce(previous.promise);
    await act(async () => receiveSessionChange());

    api.apiRequest.mockResolvedValueOnce({ ok: true, data: anotherUser });
    await act(async () => receiveSessionChange());
    expect(auth().state).toEqual({ status: "ready", user: anotherUser });

    await act(async () => previous.resolve({ ok: true, data: user }));
    expect(auth().state).toEqual({ status: "ready", user: anotherUser });
    expect(sessionEvents.publish).not.toHaveBeenCalled();
  });

  it("игнорирует позднюю правку профиля и ответ предыдущего чтения при локальном входе", async () => {
    api.apiRequest.mockResolvedValueOnce({ ok: true, data: user });
    await mount();
    const previous = Promise.withResolvers<unknown>();
    api.apiRequest.mockReturnValueOnce(previous.promise);
    await act(async () => receiveSessionChange());

    await act(async () => auth().updateUser({ ...user, nick: "newnick" }));
    expect(auth().state).toEqual({ status: "loading" });

    await act(async () => auth().setUser(anotherUser));
    await act(async () => previous.resolve({ ok: true, data: user }));
    expect(auth().state).toEqual({ status: "ready", user: anotherUser });
    expect(sessionEvents.publish).toHaveBeenCalledExactlyOnceWith();
  });

  it("после позднего ответа входа перечитывает cookie и оповещает другие вкладки", async function reconcileLogin() {
    api.apiRequest.mockResolvedValueOnce({ ok: true, data: user });
    await mount();
    const revision = auth().getSessionRevision();
    const previous = Promise.withResolvers<unknown>();
    api.apiRequest.mockReturnValueOnce(previous.promise);
    await act(async function receiveRemoteChange() {
      receiveSessionChange();
    });

    api.apiRequest.mockResolvedValueOnce({ ok: true, data: anotherUser });
    await act(async function finishLogin() {
      auth().setUser(user, revision);
    });
    await act(async function receivePreviousSession() {
      previous.resolve({ ok: true, data: user });
    });

    expect(api.apiRequest).toHaveBeenCalledTimes(3);
    expect(auth().state).toEqual({ status: "ready", user: anotherUser });
    expect(sessionEvents.publish).toHaveBeenCalledExactlyOnceWith();
  });

  it("после позднего ответа DELETE перечитывает cookie и оповещает другие вкладки", async function reconcileLogout() {
    api.apiRequest.mockResolvedValueOnce({ ok: true, data: user });
    await mount();
    const pendingDelete = Promise.withResolvers<unknown>();
    api.apiRequest.mockReturnValueOnce(pendingDelete.promise);
    const signOut = auth().signOut();

    api.apiRequest.mockResolvedValueOnce({ ok: true, data: anotherUser });
    await act(async function receiveRemoteLogin() {
      receiveSessionChange();
    });
    expect(auth().state).toEqual({ status: "ready", user: anotherUser });

    api.apiRequest.mockResolvedValueOnce({ ok: true, data: anotherUser });
    await act(async function finishDelete() {
      pendingDelete.resolve({ ok: true, data: { signedOut: true } });
      await expect(signOut).resolves.toEqual({ ok: true });
    });

    expect(api.apiRequest).toHaveBeenCalledTimes(4);
    expect(api.apiRequest).toHaveBeenLastCalledWith("/api/v1/me");
    expect(auth().state).toEqual({ status: "ready", user: anotherUser });
    expect(sessionEvents.publish).toHaveBeenCalledExactlyOnceWith();
  });

  it("signOut: удаляет сессию, очищает токен и переводит в anonymous", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: user });
    await mount();
    api.apiRequest.mockResolvedValue({ ok: true, data: { signedOut: true } });
    let result: Awaited<ReturnType<Auth["signOut"]>> | undefined;
    await act(async () => {
      result = await auth().signOut();
    });
    expect(api.apiRequest).toHaveBeenLastCalledWith("/api/v1/session", {
      method: "DELETE",
    });
    expect(store.clearSessionToken).toHaveBeenCalledTimes(1);
    expect(auth().state).toEqual({ status: "anonymous" });
    expect(result).toEqual({ ok: true });
    expect(sessionEvents.publish).toHaveBeenCalledExactlyOnceWith();
  });

  it("signOut сбрасывает ожидающий перенос email", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: user });
    await mount();
    rememberAuthEmail("/login", "next@example.test");
    api.apiRequest.mockResolvedValue({ ok: true, data: { signedOut: true } });

    await act(async () => {
      await auth().signOut();
    });

    expect(consumeAuthEmail("/login")).toBe("");
  });

  it.each([{ ok: false, network: true }, { ok: false, code: "RATE_LIMITED" }])(
    "signOut при ошибке %o оставляет пользователя и не рассылает событие",
    async function keepCurrentSession(error) {
      api.apiRequest.mockResolvedValue({ ok: true, data: user });
      await mount();
      api.apiRequest.mockResolvedValue(error);
      let result: Awaited<ReturnType<Auth["signOut"]>> | undefined;
      await act(async function attemptSignOut() {
        result = await auth().signOut();
      });
      expect(result).toEqual(error);
      expect(store.clearSessionToken).not.toHaveBeenCalled();
      expect(auth().state).toEqual({ status: "ready", user });
      expect(sessionEvents.publish).not.toHaveBeenCalled();
    },
  );

  it("signOut при ошибке API (сессия уже истекла) всё равно очищает токен", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: user });
    await mount();
    api.apiRequest.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "",
    });
    let result: Awaited<ReturnType<Auth["signOut"]>> | undefined;
    await act(async () => {
      result = await auth().signOut();
    });
    expect(result).toEqual({ ok: true });
    expect(store.clearSessionToken).toHaveBeenCalledTimes(1);
    expect(auth().state).toEqual({ status: "anonymous" });
    expect(sessionEvents.publish).not.toHaveBeenCalled();
  });

  it("signOutLocally: гасит сессию без запроса к API (аккаунт уже удалён)", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: user });
    await mount();
    rememberAuthEmail("/login", "next@example.test");
    api.apiRequest.mockClear();

    await act(async () => {
      await auth().signOutLocally();
    });

    expect(api.apiRequest).not.toHaveBeenCalled();
    expect(store.clearSessionToken).toHaveBeenCalledTimes(1);
    expect(consumeAuthEmail("/login")).toBe("");
    expect(auth().state).toEqual({ status: "anonymous" });
    expect(sessionEvents.publish).toHaveBeenCalledExactlyOnceWith();
  });
});
