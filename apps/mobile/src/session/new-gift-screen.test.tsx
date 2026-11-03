// @vitest-environment happy-dom
import type { GiftCard } from "@gift-list/contracts";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/session/auth-context";
import NewGiftScreen from "../../app/(app)/gifts/new";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const gifts = vi.hoisted(() => ({ createGift: vi.fn() }));
const store = vi.hoisted(() => ({ clearSessionToken: vi.fn() }));
const zone = vi.hoisted(() => ({ deviceTimeZone: vi.fn() }));
const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  dismissTo: vi.fn(),
}));

vi.mock("@/api/client", () => api);
// The screen under test is the create flow only: the api module's own mapping is
// covered by its callers, so the screen test drives `createGift` directly.
vi.mock("@/api/my-gifts", () => gifts);
vi.mock("@/platform/session-token", () => store);
vi.mock("@/session/device-time-zone", () => zone);
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
vi.mock("expo-router", () => ({
  router: navigation,
  Stack: { Screen: () => null },
}));
vi.mock("react-native", async () => {
  const React = await import("react");
  type ChildrenProps = { children?: React.ReactNode };
  type TextProps = ChildrenProps & {
    accessibilityRole?: string;
    accessibilityLiveRegion?: string;
  };
  type PressableProps = ChildrenProps & {
    onPress?: () => void;
    disabled?: boolean;
    accessibilityRole?: string;
    accessibilityLabel?: string;
    accessibilityState?: { checked?: boolean; disabled?: boolean; busy?: boolean };
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
  function View({ children }: ChildrenProps) {
    return React.createElement("div", null, children);
  }
  function ScrollView({ children }: ChildrenProps) {
    return React.createElement("div", null, children);
  }
  function Pressable({
    children,
    onPress,
    disabled,
    accessibilityLabel,
    accessibilityState,
  }: PressableProps) {
    const props: React.ButtonHTMLAttributes<HTMLButtonElement> = {
      type: "button",
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
    StyleSheet: { create: (styles: unknown) => styles },
    Text,
    View,
    ScrollView,
    TextInput,
    Pressable,
    // One column, like a phone in the browser (`DESIGN.md` → columns).
    useWindowDimensions: () => ({ width: 375, height: 800 }),
    AccessibilityInfo: { announceForAccessibility: vi.fn() },
  };
});
vi.mock("react-native-safe-area-context", async () => {
  const React = await import("react");
  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement("div", null, children),
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

const created: GiftCard = {
  id: "g1",
  title: "Наушники",
  description: null,
  priceAmount: null,
  priceCurrency: null,
  linkUrl: null,
  visibility: "PUBLIC",
  quantity: "SINGLE",
  expiresOn: null,
  archivedAt: null,
  tags: [],
  status: "OPEN",
  reservedBy: null,
  reservationLabel: null,
  ownerAction: null,
};

/** `/api/v1/me` answers with the session; the sign-out call answers with success. */
function signedIn() {
  api.apiRequest.mockImplementation((path: string) =>
    Promise.resolve(
      path === "/api/v1/me" ? { ok: true, data: user } : { ok: true, data: { signedOut: true } },
    ),
  );
}

let root: Root;
let container: HTMLElement;

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

/** The field box: its label, input and the inline message under it. */
function fieldText(label: string): string {
  return field(label).parentElement?.textContent ?? "";
}

/** Controlled input: set the value past React's tracker, then let React see the `input` event. */
async function type(label: string, value: string) {
  const input = field(label);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function button(label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find((node) =>
    (node.textContent ?? "").includes(label),
  );
}

async function press(label: string) {
  const target = button(label);
  expect(target, `кнопка «${label}»`).toBeDefined();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function mount() {
  await act(async () => {
    root.render(
      <AuthProvider>
        <NewGiftScreen />
      </AuthProvider>,
    );
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  zone.deviceTimeZone.mockReturnValue("Europe/Minsk");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("новое желание: гейт сессии", () => {
  it("пока сессия неизвестна, ничего не показывает и не уходит со страницы", async () => {
    api.apiRequest.mockReturnValue(new Promise(() => {}));
    await mount();

    expect(navigation.replace).not.toHaveBeenCalled();
    expect(text()).toBe("");
  });

  it("аноним уходит на вход с возвратом в форму", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/gifts/new" },
    });
    expect(text()).toBe("");
  });
});

describe("новое желание: форма", () => {
  it("рисует заголовок, поля и кнопку создания", async () => {
    signedIn();
    await mount();

    expect(text()).toContain("Новое желание");
    expect(text()).toContain("Название");
    expect(text()).toContain("Кто видит");
    expect(button("Добавить желание")).toBeDefined();
  });

  it("успех: шлёт GiftInput и уводит к списку с одноразовым параметром toast", async () => {
    signedIn();
    gifts.createGift.mockResolvedValue({ ok: true, gift: created });
    await mount();

    await type("Название", "Наушники");
    await type("Цена (необязательно)", "250");
    await press("Добавить желание");

    expect(gifts.createGift).toHaveBeenCalledTimes(1);
    expect(gifts.createGift).toHaveBeenCalledWith({
      title: "Наушники",
      description: null,
      linkUrl: null,
      priceAmount: 25000,
      priceCurrency: "USD",
      visibility: "PUBLIC",
    });
    // The screen unmounts on the way back, so the confirmation is the list's to show.
    expect(text()).not.toContain("Добавлено в вишлист");
    expect(navigation.dismissTo).toHaveBeenCalledTimes(1);
    expect(navigation.dismissTo).toHaveBeenCalledWith({
      pathname: "/",
      params: { toast: "gift_created" },
    });
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("пустое название: createGift не зовётся и ухода к списку нет", async () => {
    signedIn();
    await mount();

    await press("Добавить желание");

    // The form owns the rule; the screen must not reach the API without a title.
    expect(gifts.createGift).not.toHaveBeenCalled();
    expect(fieldText("Название")).toContain("Напишите, что вы хотите.");
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("VALIDATION: ошибка появляется у поля, форма остаётся с введённым", async () => {
    signedIn();
    gifts.createGift.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "title",
    });
    await mount();

    await type("Название", "Наушники");
    await press("Добавить желание");

    expect(fieldText("Название")).toContain("Напишите, что вы хотите.");
    expect(field("Название").value).toBe("Наушники");
    expect(text()).not.toContain("Не получилось. Попробуйте ещё раз.");
    expect(navigation.dismissTo).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("401: гасит сессию и уводит на вход с возвратом в форму и причиной", async () => {
    signedIn();
    gifts.createGift.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    await type("Название", "Наушники");
    await press("Добавить желание");

    expect(store.clearSessionToken).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/gifts/new", reason: "session_expired" },
    });
  });

  it("обрыв сети: toast и форма с прежними значениями", async () => {
    signedIn();
    gifts.createGift.mockResolvedValue({ ok: false, network: true });
    await mount();

    await type("Название", "Наушники");
    await press("Добавить желание");

    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(field("Название").value).toBe("Наушники");
    expect(button("Добавить желание")).toBeDefined();
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("ответ не по контракту: общий toast и форма на месте", async () => {
    signedIn();
    gifts.createGift.mockResolvedValue({ ok: false, invalid: true });
    await mount();

    await type("Название", "Наушники");
    await press("Добавить желание");

    expect(text()).toContain("Не получилось. Попробуйте ещё раз.");
    expect(field("Название").value).toBe("Наушники");
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("пока запрос идёт, кнопка недоступна и второй тап не шлёт второй запрос", async () => {
    signedIn();
    gifts.createGift.mockReturnValue(new Promise(() => {}));
    await mount();

    await type("Название", "Наушники");
    await press("Добавить желание");

    const submit = button("Добавить желание");
    expect(submit?.disabled).toBe(true);
    expect(submit?.getAttribute("aria-disabled")).toBe("true");
    expect(gifts.createGift).toHaveBeenCalledTimes(1);

    await act(async () => {
      submit?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(gifts.createGift).toHaveBeenCalledTimes(1);
  });
});
