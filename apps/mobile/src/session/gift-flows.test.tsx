// @vitest-environment happy-dom
import type { GiftCard } from "@gift-list/contracts";
import { act, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/session/auth-context";
import MyWishlistScreen from "../../app/(app)/index";
import EditGiftScreen from "../../app/(app)/gifts/[id]/edit";
import NewGiftScreen from "../../app/(app)/gifts/new";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const gifts = vi.hoisted(() => ({
  fetchMyGifts: vi.fn(),
  createGift: vi.fn(),
  fetchGift: vi.fn(),
  updateGift: vi.fn(),
}));
const store = vi.hoisted(() => ({ clearSessionToken: vi.fn() }));
const zone = vi.hoisted(() => ({ deviceTimeZone: vi.fn() }));

/**
 * A minimal expo-router for the two flows: a stack of routes where only the top
 * one is rendered. `push` opens a screen, `dismissTo` pops back to the list with
 * the one-shot `?toast=` the form handed over, and `setParams` merges (dropping
 * `undefined` keys) the way expo-router does. `useFocusEffect` runs its effect
 * while its screen is mounted — the top route here — so a list that comes back
 * mounts again and refetches, like its focus effect does on the real router.
 */
const navigation = vi.hoisted(() => {
  type Params = Record<string, string | undefined>;
  type Route = { pathname: string; params: Params };
  type Target = string | { pathname: string; params?: Params };

  const listeners = new Set<() => void>();
  let stack: Route[] = [{ pathname: "/", params: {} }];

  function normalize(target: Target): Route {
    return typeof target === "string"
      ? { pathname: target, params: {} }
      : { pathname: target.pathname, params: { ...target.params } };
  }

  function commit(next: Route[]) {
    stack = next;
    for (const listener of listeners) listener();
  }

  const router = {
    push(target: Target) {
      commit([...stack, normalize(target)]);
    },
    replace(target: Target) {
      const top = normalize(target);
      commit([...stack.slice(0, Math.max(0, stack.length - 1)), top]);
    },
    dismissTo(target: Target) {
      // The list is the only route dismissed to in these flows.
      commit([normalize(target)]);
    },
    back() {
      if (stack.length > 1) commit(stack.slice(0, -1));
    },
    canGoBack() {
      return stack.length > 1;
    },
    setParams(next: Params) {
      const top = stack[stack.length - 1];
      if (!top) return;
      const params = { ...top.params };
      for (const [key, value] of Object.entries(next)) {
        if (value === undefined) delete params[key];
        else params[key] = value;
      }
      commit([...stack.slice(0, -1), { ...top, params }]);
    },
  };

  return {
    router,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    // The array identity changes on every commit, so React sees each change.
    snapshot: () => stack,
    reset: () => {
      stack = [{ pathname: "/", params: {} }];
    },
    pathname: () => stack[stack.length - 1]?.pathname ?? "/",
    params: () => stack[stack.length - 1]?.params ?? {},
  };
});

vi.mock("@/api/client", () => api);
// The flows live between screens: each screen's `my-gifts` calls are driven
// directly, so the assertions see the mapped `GiftInput` / `GiftUpdate`.
vi.mock("@/api/my-gifts", () => gifts);
vi.mock("@/platform/session-token", () => store);
vi.mock("@/session/device-time-zone", () => zone);
vi.mock("expo-linking", () => ({ openURL: vi.fn() }));
// The visibility chip draws its icon with `expo-symbols`; it is decorative.
vi.mock("expo-symbols", async () => {
  const React = await import("react");
  return {
    SymbolView: () => React.createElement("span", { "data-testid": "visibility-icon" }),
  };
});
vi.mock("use-intl", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
  function read(name: string): Record<string, unknown> {
    return JSON.parse(
      readFileSync(join(root, `packages/contracts/src/i18n/ru/${name}.json`), "utf8"),
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
vi.mock("expo-router", async () => {
  const React = await import("react");
  return {
    router: navigation.router,
    Stack: { Screen: () => null },
    useLocalSearchParams: () => navigation.params(),
    // The mounted top route is the focused screen: the effect lives as long as
    // that screen is rendered, like focus/blur around a pushed screen.
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(effect, [effect]);
    },
  };
});
// The forms' discard guard blocks the system back; these flows cover «Отмена» and
// the save, which never pass through it.
vi.mock("expo-router/react-navigation", () => ({
  usePreventRemove: () => undefined,
  useNavigation: () => ({ dispatch: vi.fn() }),
}));
vi.mock("react-native", async () => {
  const React = await import("react");
  type ChildrenProps = { children?: React.ReactNode };
  type TextProps = ChildrenProps & {
    accessibilityRole?: string;
    accessibilityLiveRegion?: string;
  };
  type ViewProps = ChildrenProps & {
    testID?: string;
    role?: string;
    accessible?: boolean;
    accessibilityLabel?: string;
    accessibilityState?: { busy?: boolean };
    pointerEvents?: string;
  };
  type PressableProps = ChildrenProps & {
    onPress?: () => void;
    disabled?: boolean;
    accessibilityRole?: string;
    accessibilityLabel?: string;
    accessibilityState?: {
      checked?: boolean;
      disabled?: boolean;
      busy?: boolean;
      selected?: boolean;
    };
  };
  type InputProps = {
    value?: string;
    onChangeText?: (value: string) => void;
    accessibilityLabel?: string;
    placeholder?: string;
    maxLength?: number;
  };

  function Text({ children, accessibilityRole }: TextProps) {
    const role = accessibilityRole as React.AriaRole | undefined;
    return React.createElement("span", role ? { role } : null, children);
  }
  function View({
    children,
    testID,
    role,
    accessible,
    accessibilityLabel,
    accessibilityState,
    pointerEvents,
  }: ViewProps) {
    const props: Record<string, unknown> = {
      ...(testID ? { "data-testid": testID } : {}),
      ...(role ? { role } : {}),
      ...(accessible ? { "data-accessible": "true" } : {}),
      ...(accessibilityLabel ? { "aria-label": accessibilityLabel } : {}),
      ...(accessibilityState?.busy ? { "aria-busy": "true" } : {}),
      ...(pointerEvents ? { "data-pointer-events": pointerEvents } : {}),
    };
    return React.createElement("div", props, children);
  }
  function ScrollView({ children }: ChildrenProps) {
    return React.createElement("div", null, children);
  }
  /** `Modal` mounts its children only while visible, like the platform. */
  function Modal({ visible, children }: ChildrenProps & { visible?: boolean }) {
    if (!visible) return null;
    return React.createElement("div", { "data-testid": "modal" }, children);
  }
  function Pressable({
    children,
    onPress,
    disabled,
    accessibilityRole,
    accessibilityLabel,
    accessibilityState,
  }: PressableProps) {
    const role = accessibilityRole as React.AriaRole | undefined;
    const props: React.ButtonHTMLAttributes<HTMLButtonElement> = {
      type: "button",
      ...(role ? { role } : {}),
      ...(accessibilityLabel ? { "aria-label": accessibilityLabel } : {}),
      ...(accessibilityState && "checked" in accessibilityState
        ? { "aria-checked": accessibilityState.checked ? "true" : "false" }
        : {}),
      ...(disabled ? { disabled: true, "aria-disabled": "true" } : {}),
      // A disabled `Pressable` does not run `onPress`, same as the platform.
      ...(disabled ? {} : { onClick: onPress }),
    };
    return React.createElement("button", props, children);
  }
  function TextInput({
    value,
    onChangeText,
    accessibilityLabel,
    placeholder,
    maxLength,
  }: InputProps) {
    const props: React.InputHTMLAttributes<HTMLInputElement> = {
      value: value ?? "",
      ...(accessibilityLabel ? { "aria-label": accessibilityLabel } : {}),
      ...(placeholder ? { placeholder } : {}),
      ...(maxLength != null ? { maxLength } : {}),
      onChange: (event: { target: { value: string } }) => onChangeText?.(event.target.value),
    };
    return React.createElement("input", props);
  }

  return {
    StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} },
    Text,
    View,
    ScrollView,
    TextInput,
    Pressable,
    Modal,
    // These flows cover the native path: the browser guard stays out of the window.
    Platform: { OS: "android" as const },
    // One column, like a phone in the browser (`DESIGN.md` → columns).
    useWindowDimensions: () => ({ width: 375, height: 800 }),
    AccessibilityInfo: { announceForAccessibility: vi.fn(), setAccessibilityFocus: vi.fn() },
    findNodeHandle: () => null,
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

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const user = {
  id: "u1",
  email: "a@b.test",
  name: "Аня",
  nick: "anya",
  timeZone: "Europe/Minsk",
};

function gift(overrides: Partial<GiftCard> = {}): GiftCard {
  return {
    id: "g1",
    title: "Свитер",
    description: "Синий",
    priceAmount: 105000,
    priceCurrency: "BYN",
    linkUrl: "https://example.com/sviter",
    visibility: "FRIENDS",
    quantity: "SINGLE",
    expiresOn: null,
    archivedAt: null,
    tags: [],
    status: "OPEN",
    reservedBy: null,
    reservationLabel: null,
    ownerAction: null,
    ...overrides,
  };
}

/** `/api/v1/me` answers with the session; the sign-out call answers with success. */
function signedIn() {
  api.apiRequest.mockImplementation((path: string) =>
    Promise.resolve(
      path === "/api/v1/me" ? { ok: true, data: user } : { ok: true, data: { signedOut: true } },
    ),
  );
}

/** The owner list answer `fetchMyGifts` resolves with. */
function listAnswer(cards: GiftCard[]) {
  return { ok: true, access: "gifts" as const, gifts: cards };
}

let root: Root;
let container: HTMLElement;

/** The top route's screen, as expo-router would have it on screen. */
function Routes() {
  const stack = useSyncExternalStore(
    navigation.subscribe,
    navigation.snapshot,
    navigation.snapshot,
  );
  switch (stack[stack.length - 1]?.pathname) {
    case "/":
      return <MyWishlistScreen />;
    case "/gifts/new":
      return <NewGiftScreen />;
    case "/gifts/[id]/edit":
      return <EditGiftScreen />;
    default:
      return null;
  }
}

function text(): string {
  return container.textContent ?? "";
}

function field(label: string): HTMLInputElement {
  const input = Array.from(container.querySelectorAll("input")).find(
    (node) => node.getAttribute("aria-label") === label,
  );
  expect(input, `поле «${label}»`).toBeDefined();
  return input as HTMLInputElement;
}

/** Controlled input: set the value past React's tracker, then let React see the `input` event. */
async function type(label: string, value: string) {
  const input = field(label);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** A button found by its visible label (primary buttons, chips, radios). */
function button(label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find((node) =>
    (node.textContent ?? "").includes(label),
  );
}

/** A button found by its accessible name (the wish card's edit target). */
function labeled(label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find(
    (node) => node.getAttribute("aria-label") === label,
  );
}

async function press(label: string) {
  const target = button(label);
  expect(target, `кнопка «${label}»`).toBeDefined();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function pressLabeled(label: string) {
  const target = labeled(label);
  expect(target, `кнопка «${label}»`).toBeDefined();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** A chosen radio in the currency chips or the visibility rows. */
function chosen(label: string): boolean {
  return (
    container.querySelector(`button[aria-label="${label}"]`)?.getAttribute("aria-checked") ===
    "true"
  );
}

/** Lets pending effects and promises settle (navigation reads, fetch answers). */
async function flush() {
  await act(async () => {});
}

async function mount() {
  await act(async () => {
    root.render(
      <AuthProvider>
        <Routes />
      </AuthProvider>,
    );
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  navigation.reset();
  zone.deviceTimeZone.mockReturnValue("Europe/Minsk");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

/**
 * Story 2.2, create flow across screens (FR-10, AD-12, AD-17): «Добавить
 * желание» on the list opens the composer, the composer maps the form values
 * onto `GiftInput` and hands «Добавлено в вишлист» over in `?toast=`; the list
 * shows the notice and reads the owner list again, so the new wish is there.
 */
describe("поток: создание желания из списка", () => {
  it("список → форма → createGift(GiftInput) → список с «Добавлено в вишлист» и новым желанием", async () => {
    const existing = gift();
    const created = gift({
      id: "g2",
      title: "Наушники",
      description: null,
      priceAmount: 25050,
      priceCurrency: "RUB",
      linkUrl: "https://example.com/wh-1000xm5",
      visibility: "FRIENDS",
    });
    signedIn();
    gifts.fetchMyGifts
      .mockResolvedValueOnce(listAnswer([existing]))
      .mockResolvedValue(listAnswer([created, existing]));
    gifts.createGift.mockResolvedValue({ ok: true, gift: created });

    await mount();
    expect(text()).toContain("Свитер");
    expect(gifts.fetchMyGifts).toHaveBeenCalledTimes(1);

    await press("Добавить желание");
    expect(navigation.pathname()).toBe("/gifts/new");
    expect(text()).toContain("Новое желание");

    await type("Название", "Наушники");
    await type("Ссылка (необязательно)", "https://example.com/wh-1000xm5");
    await type("Цена (необязательно)", "250,5");
    await press("RUB");
    await press("Друзьям");
    await press("Добавить желание");
    await flush();

    expect(gifts.createGift).toHaveBeenCalledTimes(1);
    expect(gifts.createGift).toHaveBeenCalledWith({
      title: "Наушники",
      description: null,
      linkUrl: "https://example.com/wh-1000xm5",
      // `250,5` → integer minor units; the picked currency rides along (AD-25).
      priceAmount: 25050,
      priceCurrency: "RUB",
      visibility: "FRIENDS",
    });

    // `dismissTo` pops the composer and the list shows the handed-over notice.
    expect(navigation.pathname()).toBe("/");
    expect(navigation.params()).toEqual({});
    expect(text()).toContain("Добавлено в вишлист");
    // And it read the owner list again on the way back: the new wish is there.
    expect(gifts.fetchMyGifts).toHaveBeenCalledTimes(2);
    expect(text()).toContain("Наушники");
    expect(text()).toContain("Свитер");
  });
});

/**
 * The discard step's «Сохранить» runs the form's own submit, so the same create
 * flow works from the dialog: the draft is saved and the list shows the notice
 * instead of the unsaved draft being dropped.
 */
describe("поток: сохранение из шага «Сохранить изменения?»", () => {
  it("форма → «Отмена» → «Сохранить» в диалоге → createGift → список с «Добавлено в вишлист»", async () => {
    const created = gift({ id: "g2", title: "Наушники" });
    signedIn();
    gifts.fetchMyGifts
      .mockResolvedValueOnce(listAnswer([]))
      .mockResolvedValue(listAnswer([created]));
    gifts.createGift.mockResolvedValue({ ok: true, gift: created });

    await mount();
    await press("Добавить желание");
    await type("Название", "Наушники");
    await press("Отмена");

    expect(text()).toContain("Сохранить изменения?");
    await press("Сохранить");
    await flush();

    expect(gifts.createGift).toHaveBeenCalledTimes(1);
    expect(navigation.pathname()).toBe("/");
    expect(text()).toContain("Добавлено в вишлист");
    expect(text()).toContain("Наушники");
  });
});

/**
 * Story 2.2, edit flow across screens: the owner card opens
 * `/gifts/[id]/edit` with the id, the screen reads that wish and prefills the
 * form, the changed field travels back as `GiftUpdate`, and the list shows
 * «Изменения сохранены.» from `?toast=` over a freshly read list.
 */
describe("поток: редактирование желания из списка", () => {
  it("список → карточка → edit с id → fetchGift → правка → updateGift(id, GiftUpdate) → список с «Изменения сохранены.»", async () => {
    const stored = gift();
    const updated = gift({ title: "Свитер мериносовый" });
    signedIn();
    gifts.fetchMyGifts
      .mockResolvedValueOnce(listAnswer([stored]))
      .mockResolvedValue(listAnswer([updated]));
    gifts.fetchGift.mockResolvedValue({ ok: true, gift: stored });
    gifts.updateGift.mockResolvedValue({ ok: true, gift: updated });

    await mount();
    expect(text()).toContain("Свитер");
    expect(gifts.fetchMyGifts).toHaveBeenCalledTimes(1);

    await pressLabeled("Изменить «Свитер»");
    await flush();

    expect(navigation.pathname()).toBe("/gifts/[id]/edit");
    expect(navigation.params()).toEqual({ id: "g1" });
    expect(gifts.fetchGift).toHaveBeenCalledWith("g1");

    // The form is prefilled from the stored AD-12 card.
    expect(text()).toContain("Изменить желание");
    expect(field("Название").value).toBe("Свитер");
    expect(field("Описание (необязательно)").value).toBe("Синий");
    expect(field("Ссылка (необязательно)").value).toBe("https://example.com/sviter");
    expect(field("Цена (необязательно)").value).toBe("1050");
    expect(chosen("BYN")).toBe(true);
    expect(chosen("Друзьям")).toBe(true);

    await type("Название", "Свитер мериносовый");
    await press("Сохранить");
    await flush();

    expect(gifts.updateGift).toHaveBeenCalledTimes(1);
    expect(gifts.updateGift).toHaveBeenCalledWith("g1", {
      title: "Свитер мериносовый",
      description: "Синий",
      priceAmount: 105000,
      priceCurrency: "BYN",
      linkUrl: "https://example.com/sviter",
      visibility: "FRIENDS",
    });

    // The edit screen pops back and hands «Изменения сохранены.» to the list.
    expect(navigation.pathname()).toBe("/");
    expect(navigation.params()).toEqual({});
    expect(text()).toContain("Изменения сохранены.");
    // The list read itself again and shows the saved title.
    expect(gifts.fetchMyGifts).toHaveBeenCalledTimes(2);
    expect(text()).toContain("Свитер мериносовый");
  });
});
