// @vitest-environment happy-dom
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getLinkingConfig } from "expo-router/build/getLinkingConfig";
import type { RouteNode } from "expo-router/build/Route";
import { getRoutes } from "expo-router/build/getRoutes";
import type { RequireContext } from "expo-router/build/types";

/**
 * Story 6.5: a browser that opens any app path directly, or refreshes one, must
 * mount the same screen as the phone. The web shell hands such paths to the SPA
 * (`spa-paths.test.ts`); this test fixes the other half — the SPA resolves the
 * path it started on. The route tree comes from the real `app/` directory with
 * the same `getRoutes`/`getLinkingConfig` pair expo-router builds at startup, so
 * a file outside the tree is a route the browser cannot open. The screen tests
 * (`src/session/*-screen.test.tsx`) mount those same files.
 *
 * The list is the app's own: five tabs, the signed-in screens, the auth screens,
 * the public wishlist and «Найти знакомых» (Story 6.5). `/l/:token` and
 * `/i/:token` are Next-owned App Link doubles (AD-26) and their resolution is
 * covered by `app-link-routes.test.tsx`.
 */
type SpaRoute = {
  /** The path a browser may open or refresh. */
  path: string;
  /** The leaf route name expo-router gives the screen (`RouteNode.route`). */
  leaf: string;
  /** The screen file of the leaf, as the Metro context names it. */
  file: string;
};

const SPA_ROUTES: SpaRoute[] = [
  { path: "/", leaf: "index", file: "./(app)/(tabs)/index.tsx" },
  { path: "/search", leaf: "search", file: "./(app)/(tabs)/search.tsx" },
  { path: "/friends", leaf: "friends", file: "./(app)/(tabs)/friends.tsx" },
  { path: "/friends/contacts", leaf: "friends/contacts", file: "./(app)/friends/contacts.tsx" },
  { path: "/reservations", leaf: "reservations", file: "./(app)/(tabs)/reservations.tsx" },
  { path: "/profile", leaf: "profile", file: "./(app)/(tabs)/profile.tsx" },
  { path: "/settings", leaf: "settings", file: "./(app)/settings.tsx" },
  { path: "/notifications", leaf: "notifications", file: "./(app)/notifications.tsx" },
  { path: "/gifts/new", leaf: "gifts/new", file: "./(app)/gifts/new.tsx" },
  { path: "/gifts/g-1", leaf: "gifts/[id]/index", file: "./(app)/gifts/[id]/index.tsx" },
  { path: "/gifts/g-1/edit", leaf: "gifts/[id]/edit", file: "./(app)/gifts/[id]/edit.tsx" },
  { path: "/u/anya", leaf: "u/[nick]", file: "./(app)/u/[nick].tsx" },
  { path: "/invite/tok-1", leaf: "invite/[token]", file: "./(app)/invite/[token].tsx" },
  {
    path: "/wishlist/tok-1",
    leaf: "wishlist/[token]",
    file: "./(link)/wishlist/[token].tsx",
  },
  { path: "/login", leaf: "(auth)/login", file: "./(auth)/login.tsx" },
  { path: "/register", leaf: "(auth)/register", file: "./(auth)/register.tsx" },
  { path: "/forgot", leaf: "(auth)/forgot", file: "./(auth)/forgot.tsx" },
  { path: "/reset", leaf: "(auth)/reset", file: "./(auth)/reset.tsx" },
];

const appDir = join(dirname(fileURLToPath(import.meta.url)), "../../app");

/** Every route file of `app/`, as the Metro context keys expo-router reads. */
function routeFiles(dir: string): string[] {
  const keys: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) keys.push(...routeFiles(full));
    else if (/\.tsx$/.test(entry.name)) {
      keys.push(`./${relative(appDir, full).replace(/\\/g, "/")}`);
    }
  }
  return keys;
}

/**
 * The context module Metro generates for `app/`. Route files are not executed:
 * the test needs the file tree, and the screens themselves are mounted by their
 * own tests.
 */
function appContext(): RequireContext {
  const keys = routeFiles(appDir);
  const context = ((_key: string) => ({ default: () => null })) as RequireContext;
  context.keys = () => keys;
  context.resolve = (key) => key;
  context.id = appDir;
  return context;
}

type NavigationState = {
  routes: {
    name: string;
    path?: string;
    params?: Record<string, string>;
    state?: NavigationState;
  }[];
};

/** The deepest route of a linking state: the screen that would mount. */
function leafRoute(state: NavigationState): NavigationState["routes"][number] {
  let route = state.routes[state.routes.length - 1];
  while (route?.state) route = route.state.routes[route.state.routes.length - 1];
  if (!route) throw new Error("Пустое состояние навигации");
  return route;
}

const context = appContext();
const routes = getRoutes(context, { internal_stripLoadRoute: true });
if (routes === null) throw new Error("expo-router не собрал дерево маршрутов app/");
const linking = getLinkingConfig(routes, context, {
  skipGenerated: false,
  sitemap: false,
  notFound: true,
});

/** The route file of each leaf name, from the tree expo-router built. */
const routeFilesByName = new Map<string, string>();
function collectRouteFiles(node: RouteNode): void {
  const isNotFound = node.dynamic?.some((segment) => segment.notFound) ?? false;
  if (node.type === "route" && !node.internal && !node.generated && !isNotFound) {
    routeFilesByName.set(node.route, node.contextKey);
  }
  for (const child of node.children) collectRouteFiles(child);
}
collectRouteFiles(routes);

function resolve(pathname: string): NavigationState {
  const state = linking.getStateFromPath(pathname, linking.config);
  if (!state) throw new Error(`Маршрут ${pathname} не разрешился`);
  return state as NavigationState;
}

describe("глубокая ссылка и обновление страницы (Story 6.5)", () => {
  it.each(SPA_ROUTES)("$path открывает свой экран при старте", ({ path, leaf }) => {
    const route = leafRoute(resolve(path));
    expect(route.name).toBe(leaf);
    expect(route.path).toBe(path);
  });

  it.each(SPA_ROUTES)("$path ведёт на существующий файл экрана", ({ leaf, file }) => {
    expect(routeFilesByName.get(leaf)).toBe(file);
    expect(existsSync(join(appDir, file))).toBe(true);
  });

  it("динамические сегменты попадают в параметры экрана", () => {
    expect(leafRoute(resolve("/gifts/g-1")).params).toEqual({ id: "g-1" });
    expect(leafRoute(resolve("/gifts/g-1/edit")).params).toEqual({ id: "g-1" });
    expect(leafRoute(resolve("/u/anya")).params).toEqual({ nick: "anya" });
    expect(leafRoute(resolve("/invite/tok-1")).params).toEqual({ token: "tok-1" });
    expect(leafRoute(resolve("/wishlist/tok-1")).params).toEqual({ token: "tok-1" });
  });

  it("неизвестный путь — не пустой экран, а общий not-found", () => {
    expect(leafRoute(resolve("/no-such-page")).name).toBe("+not-found");
  });

  it("в app/ нет маршрутов, которых нет в списке, кроме Next-двойников /l и /i", () => {
    const expected = [
      ...SPA_ROUTES.map((route) => route.leaf),
      // App Link doubles: Next serves `/l/:token` and `/i/:token` itself (AD-26).
      "l/[token]",
      "i/[token]",
    ];
    expect([...routeFilesByName.keys()].sort()).toEqual(expected.sort());
  });
});
