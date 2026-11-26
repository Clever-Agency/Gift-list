// @vitest-environment happy-dom
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { settle } from "@/test/dom";
import { AuthProvider } from "@/session/auth-context";
import InviteScreen from "../../app/(app)/invite/[token]";
import LinkInviteScreen from "../../app/i/[token]";
import LinkWishlistScreen from "../../app/l/[token]";
import PublicWishlistScreen from "../../app/(link)/wishlist/[token]";

/**
 * Story 6.2 (E): App Links `/l/:token` and `/i/:token` open the public wishlist
 * and the invite. The route files are doubles, not redirects (`Open Questions` 9):
 * a redirect would replace the history entry, so «назад» would leave the app.
 * The test fixes the one thing the double must be — the very same screen module —
 * and that it reads the token the way the original does.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const appDir = join(root, "apps/mobile/app");

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const invites = vi.hoisted(() => ({ getInvitePreview: vi.fn(), acceptInvite: vi.fn() }));
const copier = vi.hoisted(() => ({ copyMyInviteLink: vi.fn() }));
const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  back: vi.fn(),
  canGoBack: vi.fn(() => true),
}));
const search = vi.hoisted(() => ({
  params: { token: "tok_i" } as Record<string, string | undefined>,
}));

vi.mock("@/api/client", () => api);
vi.mock("@/api/invite-link", () => invites);
vi.mock("@/invite/copy-link", () => copier);
vi.mock("@/platform/session-token", () => ({ clearSessionToken: vi.fn() }));
vi.mock("@/session/device-time-zone", () => ({ deviceTimeZone: () => "Europe/Minsk" }));
vi.mock("expo-linking", () => ({ openURL: vi.fn() }));
vi.mock("expo-router", async () => {
  const React = await import("react");
  return {
    router: navigation,
    Stack: { Screen: () => null },
    useLocalSearchParams: () => search.params,
    Link: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});
vi.mock("react-native-safe-area-context", async () => {
  const React = await import("react");
  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement("div", null, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});
vi.mock("use-intl", async () => {
  const { dirname: dir, join: joinPath } = await import("node:path");
  const { fileURLToPath: fileUrl } = await import("node:url");
  const repo = joinPath(dir(fileUrl(import.meta.url)), "../../../..");
  function read(name: string): Record<string, unknown> {
    return JSON.parse(
      readFileSync(joinPath(repo, `packages/contracts/src/i18n/ru/${name}.json`), "utf8"),
    ) as Record<string, unknown>;
  }
  const catalogs = { app: read("app"), common: read("common") };

  function lookup(catalog: unknown, key: string, values?: Record<string, unknown>): string {
    let node = catalog;
    for (const part of key.split(".")) {
      if (typeof node !== "object" || node == null || !(part in node)) return key;
      node = (node as Record<string, unknown>)[part];
    }
    if (typeof node !== "string") return key;
    return node.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? ""));
  }

  function catalogFor(namespace: string): unknown {
    const [head, ...rest] = namespace.split(".");
    const base = head === "common" ? catalogs.common : catalogs.app;
    return rest.reduce<unknown>(
      (node, part) =>
        typeof node === "object" && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      base,
    );
  }

  return {
    useTranslations:
      (namespace: string) => (key: string, values?: Record<string, unknown>) =>
        lookup(catalogFor(namespace), key, values),
    useLocale: () => "ru",
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const user = {
  id: "u1",
  email: "a@b.test",
  name: "Аня",
  nick: "anya",
  timeZone: "Europe/Minsk",
};

const inviter = { displayName: "Сергей", nick: "sergey" };

/** The route file of one App Link double without its comments: only the code. */
function routeCode(folder: "l" | "i"): string {
  const source = readFileSync(join(appDir, folder, "[token].tsx"), "utf8");
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .trim();
}

let view: Root;
let container: HTMLElement;

async function mountInviteDouble() {
  await act(async () => {
    view.render(
      <AuthProvider>
        <LinkInviteScreen />
      </AuthProvider>,
    );
  });
  await settle(10);
}

beforeEach(() => {
  vi.resetAllMocks();
  search.params = { token: "tok_i" };
  navigation.canGoBack.mockReturnValue(true);
  api.apiRequest.mockResolvedValue({ ok: true, data: user });
  invites.getInvitePreview.mockResolvedValue({
    ok: true,
    inviter,
    state: "can_accept",
  });
  invites.acceptInvite.mockResolvedValue({ ok: true, outcome: "FRIENDS" });
  copier.copyMyInviteLink.mockResolvedValue("copied");
  container = document.createElement("div");
  document.body.appendChild(container);
  view = createRoot(container);
});

afterEach(async () => {
  await act(async () => view.unmount());
  container.remove();
});

describe("маршруты-двойники /l и /i (Story 6.2 E)", () => {
  it("каждый двойник — тот же экран, что оригинал, а не его копия", () => {
    expect(LinkWishlistScreen).toBe(PublicWishlistScreen);
    expect(LinkInviteScreen).toBe(InviteScreen);
  });

  it("сегмент один: /l/[token] и /i/[token] без лишних файлов", () => {
    expect(readdirSync(join(appDir, "l"))).toEqual(["[token].tsx"]);
    expect(readdirSync(join(appDir, "i"))).toEqual(["[token].tsx"]);
  });

  it("двойники — re-export, без redirect и без +not-found", () => {
    // A redirect or a not-found hop would rewrite the history entry of the link,
    // and a local component would be a copy of the screen, not the screen itself.
    expect(routeCode("l")).toBe('export { default } from "../(link)/wishlist/[token]";');
    expect(routeCode("i")).toBe('export { default } from "../(app)/invite/[token]";');
  });

  it("двойник читает token тем же useLocalSearchParams и открывает тот же экран", async () => {
    await mountInviteDouble();

    expect(invites.getInvitePreview).toHaveBeenCalledWith("tok_i");
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Сергей");
    expect(container.textContent).toContain("Добавить");
  });

  it("гость с /i уходит на регистрацию с тем же next=/invite/{token}", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mountInviteDouble();

    // The double is the same screen, so the guest hand-off keeps the `/invite`
    // path it was written for: one screen, one return address.
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/register",
      params: { next: "/invite/tok_i" },
    });
  });
});
