// @vitest-environment happy-dom
import type { GiftCard } from "@gift-list/contracts";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/session/auth-context";
import EditGiftScreen from "../../app/(app)/gifts/[id]/edit";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
const gifts = vi.hoisted(() => ({ fetchGift: vi.fn(), updateGift: vi.fn() }));
const store = vi.hoisted(() => ({ clearSessionToken: vi.fn() }));
const zone = vi.hoisted(() => ({ deviceTimeZone: vi.fn() }));
const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  dismissTo: vi.fn(),
}));
/** Route params stand-in: the screen reads the wish id from `[id]`. */
const search = vi.hoisted(() => ({ params: {} as Record<string, string | undefined> }));

vi.mock("@/api/client", () => api);
// The screen under test is the edit flow only: the api module's own mapping is
// covered by its callers, so the screen test drives `fetchGift`/`updateGift` directly.
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
  useLocalSearchParams: () => search.params,
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
    accessible?: boolean;
    accessibilityLabel?: string;
    accessibilityState?: { busy?: boolean };
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
  function View({
    children,
    testID,
    accessible,
    accessibilityLabel,
    accessibilityState,
  }: ViewProps) {
    const props: Record<string, unknown> = {
      ...(testID ? { "data-testid": testID } : {}),
      ...(accessible ? { "data-accessible": "true" } : {}),
      ...(accessibilityLabel ? { "aria-label": accessibilityLabel } : {}),
      ...(accessibilityState?.busy ? { "aria-busy": "true" } : {}),
    };
    return React.createElement("div", props, children);
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

const stored: GiftCard = {
  id: "g1",
  title: "Наушники",
  description: "Чёрные, с шумоподавлением",
  priceAmount: 25000,
  priceCurrency: "RUB",
  linkUrl: "https://example.com/x",
  visibility: "FRIENDS",
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

/** The screen's first read answers with the stored wish. */
function loaded(gift: GiftCard = stored) {
  signedIn();
  gifts.fetchGift.mockResolvedValue({ ok: true, gift });
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

/** A chosen radio in the currency chips or the visibility rows. */
function selected(label: string): boolean {
  return container.querySelector(`button[aria-label="${label}"]`)?.getAttribute("aria-checked") === "true";
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
        <EditGiftScreen />
      </AuthProvider>,
    );
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  search.params = { id: "g1" };
  zone.deviceTimeZone.mockReturnValue("Europe/Minsk");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("изменение желания: гейт сессии", () => {
  it("пока сессия неизвестна, ничего не показывает и не уходит со страницы", async () => {
    api.apiRequest.mockReturnValue(new Promise(() => {}));
    await mount();

    expect(navigation.replace).not.toHaveBeenCalled();
    expect(text()).toBe("");
  });

  it("аноним уходит на вход с возвратом в форму редактирования", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/gifts/g1/edit" },
    });
    expect(text()).toBe("");
  });
});

describe("изменение желания: загрузка", () => {
  it("пока желание грузится, показывает skeleton без формы", async () => {
    signedIn();
    gifts.fetchGift.mockReturnValue(new Promise(() => {}));
    await mount();

    expect(container.querySelectorAll('[data-testid="wish-card-skeleton"]')).toHaveLength(1);
    expect(text()).not.toContain("Название");
    expect(button("Сохранить")).toBeUndefined();
  });

  it("skeleton объявлен диктору: занятая область с подписью «Загружаем желание»", async () => {
    signedIn();
    gifts.fetchGift.mockReturnValue(new Promise(() => {}));
    await mount();

    const region = container.querySelector('[aria-label="Загружаем желание"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-busy")).toBe("true");
    expect(region?.getAttribute("data-accessible")).toBe("true");
    expect(region?.querySelectorAll('[data-testid="wish-card-skeleton"]')).toHaveLength(1);
  });

  it("заполняет форму полями желания и подписью «Сохранить»", async () => {
    loaded();
    await mount();

    expect(gifts.fetchGift).toHaveBeenCalledWith("g1");
    expect(text()).toContain("Изменить желание");
    expect(field("Название").value).toBe("Наушники");
    expect(field("Описание (необязательно)").value).toBe("Чёрные, с шумоподавлением");
    expect(field("Ссылка (необязательно)").value).toBe("https://example.com/x");
    expect(field("Цена (необязательно)").value).toBe("250");
    expect(selected("RUB")).toBe(true);
    expect(selected("Друзьям")).toBe(true);
    expect(button("Сохранить")).toBeDefined();
  });

  it("обрыв сети: тело с повтором, toast, затем «Повторить» открывает форму", async () => {
    signedIn();
    gifts.fetchGift.mockResolvedValue({ ok: false, network: true });
    await mount();

    expect(text()).toContain("Не получилось загрузить. Проверьте сеть.");
    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(button("Повторить")).toBeDefined();
    expect(button("Сохранить")).toBeUndefined();

    gifts.fetchGift.mockResolvedValue({ ok: true, gift: stored });
    await press("Повторить");

    expect(gifts.fetchGift).toHaveBeenCalledTimes(2);
    expect(field("Название").value).toBe("Наушники");
    expect(text()).not.toContain("Не получилось загрузить. Проверьте сеть.");
    expect(text()).not.toContain("Нет соединения. Попробуйте ещё раз.");
  });

  it("ответ не по контракту: общее тело ошибки, общий toast и повтор", async () => {
    signedIn();
    gifts.fetchGift.mockResolvedValue({ ok: false, invalid: true });
    await mount();

    expect(text()).toContain("Не получилось загрузить. Попробуйте ещё раз.");
    expect(text()).not.toContain("Не получилось загрузить. Проверьте сеть.");
    expect(text()).toContain("Не получилось. Попробуйте ещё раз.");
    expect(button("Повторить")).toBeDefined();
  });

  it("желания нет: «Желание не найдено.» и возврат к списку, а не пустая форма", async () => {
    signedIn();
    gifts.fetchGift.mockResolvedValue({ ok: false, code: "NOT_FOUND", message: "" });
    await mount();

    expect(text()).toContain("Желание не найдено.");
    expect(button("Сохранить")).toBeUndefined();
    expect(button("К моему вишлисту")).toBeDefined();

    await press("К моему вишлисту");
    expect(navigation.dismissTo).toHaveBeenCalledWith({ pathname: "/" });
  });

  it("401 при загрузке: гасит сессию и уводит на вход с возвратом и причиной", async () => {
    signedIn();
    gifts.fetchGift.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    expect(store.clearSessionToken).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/gifts/g1/edit", reason: "session_expired" },
    });
    expect(text()).not.toContain("Сессия закончилась, войдите снова");
  });
});

describe("изменение желания: сохранение", () => {
  it("успех: шлёт полный GiftUpdate и уводит к списку с toast=gift_updated", async () => {
    loaded();
    gifts.updateGift.mockResolvedValue({ ok: true, gift: { ...stored, title: "Наушники Sony" } });
    await mount();

    await type("Название", "Наушники Sony");
    await press("Сохранить");

    expect(gifts.updateGift).toHaveBeenCalledTimes(1);
    expect(gifts.updateGift).toHaveBeenCalledWith("g1", {
      title: "Наушники Sony",
      description: "Чёрные, с шумоподавлением",
      priceAmount: 25000,
      priceCurrency: "RUB",
      // `GiftFormValues` calls the field `link`, the API body `linkUrl` (AD-12).
      linkUrl: "https://example.com/x",
      visibility: "FRIENDS",
    });
    // The screen unmounts on the way back, so the confirmation is the list's to show.
    expect(text()).not.toContain("Изменения сохранены.");
    expect(navigation.dismissTo).toHaveBeenCalledTimes(1);
    expect(navigation.dismissTo).toHaveBeenCalledWith({
      pathname: "/",
      params: { toast: "gift_updated" },
    });
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  /**
   * AD-25: the amount and its currency are all-or-nothing. Clearing the prefilled
   * amount clears the stored currency with it, so the price disappears instead of
   * keeping `RUB` next to a `null` amount.
   */
  it("очистка цены шлёт priceAmount: null и priceCurrency: null", async () => {
    loaded();
    gifts.updateGift.mockResolvedValue({
      ok: true,
      gift: { ...stored, priceAmount: null, priceCurrency: null },
    });
    await mount();

    await type("Цена (необязательно)", "");
    // An empty amount hides the currency choice (EXPERIENCE → Price field).
    expect(text()).not.toContain("Валюта");
    await press("Сохранить");

    expect(gifts.updateGift).toHaveBeenCalledTimes(1);
    expect(gifts.updateGift).toHaveBeenCalledWith("g1", {
      title: "Наушники",
      description: "Чёрные, с шумоподавлением",
      priceAmount: null,
      priceCurrency: null,
      linkUrl: "https://example.com/x",
      visibility: "FRIENDS",
    });
  });

  /** D-25: an empty link clears the stored one instead of silently keeping it. */
  it("очистка ссылки шлёт linkUrl: null", async () => {
    loaded();
    gifts.updateGift.mockResolvedValue({ ok: true, gift: { ...stored, linkUrl: null } });
    await mount();

    await type("Ссылка (необязательно)", "");
    await press("Сохранить");

    expect(gifts.updateGift).toHaveBeenCalledTimes(1);
    expect(gifts.updateGift).toHaveBeenCalledWith("g1", {
      title: "Наушники",
      description: "Чёрные, с шумоподавлением",
      priceAmount: 25000,
      priceCurrency: "RUB",
      linkUrl: null,
      visibility: "FRIENDS",
    });
  });

  it("VALIDATION: ошибка появляется у поля, форма остаётся с введённым", async () => {
    loaded();
    gifts.updateGift.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "title",
    });
    await mount();

    await type("Название", "Наушники Sony");
    await press("Сохранить");

    expect(fieldText("Название")).toContain("Напишите, что вы хотите.");
    expect(field("Название").value).toBe("Наушники Sony");
    expect(text()).not.toContain("Не получилось сохранить. Попробуйте ещё раз.");
    expect(navigation.dismissTo).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("NOT_FOUND при сохранении: toast и состояние «Желание не найдено.»", async () => {
    loaded();
    gifts.updateGift.mockResolvedValue({ ok: false, code: "NOT_FOUND", message: "" });
    await mount();

    await press("Сохранить");

    expect(text()).toContain("Не найдено.");
    expect(text()).toContain("Желание не найдено.");
    expect(button("Сохранить")).toBeUndefined();
    expect(button("К моему вишлисту")).toBeDefined();
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("обрыв сети при сохранении: toast и форма с прежними значениями", async () => {
    loaded();
    gifts.updateGift.mockResolvedValue({ ok: false, network: true });
    await mount();

    await type("Название", "Наушники Sony");
    await press("Сохранить");

    expect(text()).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(field("Название").value).toBe("Наушники Sony");
    expect(field("Цена (необязательно)").value).toBe("250");
    expect(button("Сохранить")).toBeDefined();
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("ответ не по контракту: общий toast и форма на месте", async () => {
    loaded();
    gifts.updateGift.mockResolvedValue({ ok: false, invalid: true });
    await mount();

    await press("Сохранить");

    expect(text()).toContain("Не получилось. Попробуйте ещё раз.");
    expect(button("Сохранить")).toBeDefined();
    expect(navigation.dismissTo).not.toHaveBeenCalled();
  });

  it("401 при сохранении: гасит сессию и уводит на вход с возвратом и причиной", async () => {
    loaded();
    gifts.updateGift.mockResolvedValue({ ok: false, code: "UNAUTHENTICATED", message: "" });
    await mount();

    await press("Сохранить");

    expect(store.clearSessionToken).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/gifts/g1/edit", reason: "session_expired" },
    });
  });

  it("пока запрос идёт, кнопка недоступна и второй тап не шлёт второй запрос", async () => {
    loaded();
    gifts.updateGift.mockReturnValue(new Promise(() => {}));
    await mount();

    await press("Сохранить");

    const submit = button("Сохранить");
    expect(submit?.disabled).toBe(true);
    expect(submit?.getAttribute("aria-disabled")).toBe("true");
    expect(gifts.updateGift).toHaveBeenCalledTimes(1);

    await act(async () => {
      submit?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(gifts.updateGift).toHaveBeenCalledTimes(1);
  });
});
