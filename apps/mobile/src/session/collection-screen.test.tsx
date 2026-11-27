// @vitest-environment happy-dom
import { getMessages } from "@gift-list/contracts";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { IntlProvider } from "use-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CollectionRoute from "../../app/(app)/collections/[id]";
import { controlByText, settle } from "@/test/dom";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(function makeMocks() {
  return {
    state: "ready" as "ready" | "anonymous",
    replace: vi.fn(),
    push: vi.fn(),
    signOut: vi.fn(),
    fetchCollection: vi.fn(),
    addCollectionItem: vi.fn(),
    params: { id: "c1" } as Record<string, string | undefined>,
  };
});

vi.mock("@/session/auth-context", function authModule() {
  return {
    useAuth: function useAuth() {
      return {
        state:
          mocks.state === "ready"
            ? {
                status: "ready",
                user: { id: "u1", name: "Мария", nick: "maria", timeZone: "UTC" },
              }
            : { status: "anonymous" },
        signOut: mocks.signOut,
        retry: vi.fn(),
      };
    },
  };
});

vi.mock("expo-router", async function routerModule() {
  const { createElement, cloneElement } = await import("react");
  return {
    router: { replace: mocks.replace, push: mocks.push },
    Stack: { Screen: function TestScreen() { return null; } },
    useLocalSearchParams: function params() { return mocks.params; },
    // The 404 page draws `NavLink`; the router's `Link` hands `href` to its child.
    Link: function Link({
      href,
      asChild,
      children,
    }: {
      href: string;
      asChild?: boolean;
      children: React.ReactElement<Record<string, unknown>>;
    }) {
      if (!asChild) return createElement("a", { href }, children);
      return cloneElement(children, { href });
    },
  };
});

vi.mock("react-native-safe-area-context", async function safeArea() {
  const { createElement } = await import("react");
  return {
    SafeAreaView: function TestSafeArea({ children }: { children?: React.ReactNode }) {
      return createElement("div", null, children);
    },
    useSafeAreaInsets: function noInsets() {
      return { top: 0, right: 0, bottom: 0, left: 0 };
    },
  };
});

vi.mock("expo-linking", function linking() {
  return { openURL: vi.fn() };
});

vi.mock("@/api/collections", function api() {
  return {
    fetchCollection: mocks.fetchCollection,
    addCollectionItem: mocks.addCollectionItem,
  };
});

const collection = {
  id: "c1",
  title: "Для рыбалки",
  description: "Идеи для тех, кто любит воду",
  coverImageUrl: null,
  itemCount: 2,
  items: [
    {
      id: "i1",
      title: "Термос",
      description: "Держит тепло сутки",
      linkUrl: "https://shop.example/termos",
      imageUrl: "https://cdn.example.com/termos.jpg",
    },
    {
      id: "i2",
      title: "Складной нож",
      description: null,
      linkUrl: null,
      imageUrl: null,
    },
  ],
};

const card = {
  id: "g1",
  title: "Термос",
  description: "Держит тепло сутки",
  priceAmount: null,
  priceCurrency: null,
  linkUrl: "https://shop.example/termos",
  visibility: "PUBLIC",
  quantity: "SINGLE",
  expiresOn: null,
  archivedAt: null,
  tags: [],
  status: "OPEN",
  reservedBy: null,
  reservationLabel: null,
  ownerAction: null,
  undoUntil: null,
};

let root: Root;
let container: HTMLElement;

async function mount() {
  await act(async function render() {
    root.render(
      <IntlProvider locale="ru" messages={getMessages("ru")} timeZone="UTC">
        <CollectionRoute />
      </IntlProvider>,
    );
  });
  await settle(10);
}

function addButton(itemId: string): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>(`[data-testid="collection-add-${itemId}"]`);
}

beforeEach(function reset() {
  vi.clearAllMocks();
  mocks.state = "ready";
  mocks.params = { id: "c1" };
  mocks.signOut.mockResolvedValue({ ok: true });
  mocks.fetchCollection.mockResolvedValue({ ok: true, collection });
  mocks.addCollectionItem.mockResolvedValue({ ok: true, gift: card });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async function remove() {
  await act(async function unmount() {
    root.unmount();
  });
  container.remove();
});

describe("Подборка", () => {
  it("аноним уходит на вход и возвращается на свою подборку", async function anonymousGate() {
    mocks.state = "anonymous";
    await mount();

    expect(mocks.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/collections/c1" },
    });
    expect(mocks.fetchCollection).not.toHaveBeenCalled();
  });

  it("показывает заголовок, описание и идеи со ссылкой и картинкой", async function detail() {
    await mount();

    expect(mocks.fetchCollection).toHaveBeenCalledWith("c1");
    expect(container.textContent).toContain("Для рыбалки");
    expect(container.textContent).toContain("Идеи для тех, кто любит воду");
    expect(container.textContent).toContain("Термос");
    expect(container.textContent).toContain("Держит тепло сутки");
    expect(container.textContent).toContain("Складной нож");
    expect(container.querySelectorAll('[role="list"] [role="listitem"]')).toHaveLength(2);

    const photo = container.querySelector('[data-testid="collection-item-photo-i1"]');
    expect(photo?.getAttribute("src")).toBe("https://cdn.example.com/termos.jpg");
    const link = container.querySelector('a[href="https://shop.example/termos"]');
    expect(link).not.toBeNull();
  });

  it("неопубликованная или чужая подборка — общая страница «не найдено»", async function missing() {
    mocks.fetchCollection.mockResolvedValue({ ok: true, access: "not_found" });
    await mount();

    expect(container.textContent).toContain("Страница не найдена");
    expect(container.textContent).not.toContain("Добавить в мой вишлист");
  });

  it("добавление: кнопка становится «Добавлено», toast подтверждает, второй раз не уходит", async function added() {
    await mount();

    const button = addButton("i1");
    expect(button?.textContent).toContain("Добавить в мой вишлист");
    await act(async function pressAdd() {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle(10);

    expect(mocks.addCollectionItem).toHaveBeenCalledWith("c1", "i1");
    expect(addButton("i1")?.textContent).toContain("Добавлено");
    expect(addButton("i1")?.disabled).toBe(true);
    expect(container.textContent).toContain("Добавлено в вишлист");
    // The other idea keeps its own button.
    expect(addButton("i2")?.textContent).toContain("Добавить в мой вишлист");

    await act(async function pressAgain() {
      addButton("i1")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(mocks.addCollectionItem).toHaveBeenCalledTimes(1);
  });

  it("ошибка сети оставляет кнопку и показывает существующий текст", async function networkFailure() {
    mocks.addCollectionItem.mockResolvedValue({ ok: false, network: true });
    await mount();

    await act(async function pressAdd() {
      addButton("i1")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle(10);

    expect(container.textContent).toContain("Нет соединения. Попробуйте ещё раз.");
    expect(addButton("i1")?.textContent).toContain("Добавить в мой вишлист");
    expect(addButton("i1")?.disabled).toBe(false);
  });

  it("лимит и проверки желания показываются текстом ошибки", async function refusal() {
    mocks.addCollectionItem.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "title",
    });
    await mount();

    await act(async function pressAdd() {
      addButton("i1")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle(10);

    expect(container.textContent).toContain("Проверьте введённые данные.");
    expect(addButton("i1")?.disabled).toBe(false);
  });

  it("ошибка чтения даёт «Повторить», повтор читает снова", async function retry() {
    mocks.fetchCollection
      .mockResolvedValueOnce({ ok: false, network: true })
      .mockResolvedValueOnce({ ok: true, collection });
    await mount();

    expect(container.textContent).toContain("Не получилось загрузить. Проверьте сеть.");
    const retry = controlByText("Повторить");
    expect(retry).toBeDefined();
    await act(async function pressRetry() {
      retry?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle(10);

    expect(mocks.fetchCollection).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Термос");
  });
});
