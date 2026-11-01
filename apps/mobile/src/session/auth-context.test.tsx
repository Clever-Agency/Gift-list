// @vitest-environment happy-dom
import type { Me } from "@gift-list/contracts";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth-context";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const store = vi.hoisted(() => ({ clearSessionToken: vi.fn() }));
const zone = vi.hoisted(() => ({ deviceTimeZone: vi.fn() }));

vi.mock("@/api/client", () => api);
vi.mock("@/platform/session-token", () => store);
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
};

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

  it("при сетевой ошибке не очищает токен", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, network: true });
    await mount();
    expect(store.clearSessionToken).not.toHaveBeenCalled();
    expect(auth().state).toEqual({ status: "anonymous" });
  });

  it("при другой ошибке API не очищает токен", async () => {
    api.apiRequest.mockResolvedValue({
      ok: false,
      code: "RATE_LIMITED",
      message: "",
    });
    await mount();
    expect(store.clearSessionToken).not.toHaveBeenCalled();
    expect(auth().state).toEqual({ status: "anonymous" });
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
  });

  it("signOut при сетевой ошибке не очищает токен и оставляет пользователя", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data: user });
    await mount();
    api.apiRequest.mockResolvedValue({ ok: false, network: true });
    let result: Awaited<ReturnType<Auth["signOut"]>> | undefined;
    await act(async () => {
      result = await auth().signOut();
    });
    expect(result).toEqual({ ok: false, network: true });
    expect(store.clearSessionToken).not.toHaveBeenCalled();
    expect(auth().state).toEqual({ status: "ready", user });
  });

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
  });
});
