// @vitest-environment happy-dom
import { getMessages } from "@gift-list/contracts";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { IntlProvider } from "use-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CollectionsRoute from "../../app/(app)/collections/index";
import { controlByLabel, controlByText, settle } from "@/test/dom";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(function makeMocks() {
  return {
    state: "ready" as "ready" | "anonymous",
    replace: vi.fn(),
    push: vi.fn(),
    signOut: vi.fn(),
    fetchCollections: vi.fn(),
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

vi.mock("expo-router", function routerModule() {
  return {
    router: { replace: mocks.replace, push: mocks.push },
    Stack: { Screen: function TestScreen() { return null; } },
    useLocalSearchParams: function params() { return {}; },
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

// The measured grid needs a layout; a card width is enough for the card content.
vi.mock("@/ui/use-card-grid", function cardGrid() {
  return {
    useCardGrid: function useCardGrid() {
      return { columns: 2, cardWidth: 160, attachContainer: function attach() {} };
    },
  };
});

vi.mock("@/api/collections", function api() {
  return { fetchCollections: mocks.fetchCollections };
});

const collections = [
  {
    id: "c1",
    title: "Для рыбалки",
    description: null,
    coverImageUrl: null,
    itemCount: 12,
  },
  {
    id: "c2",
    title: "На Новый год",
    description: null,
    coverImageUrl: null,
    itemCount: 1,
  },
  {
    id: "c3",
    title: "Осенние тренды",
    description: null,
    coverImageUrl: null,
    itemCount: 3,
  },
];

let root: Root;
let container: HTMLElement;

async function mount() {
  await act(async function render() {
    root.render(
      <IntlProvider locale="ru" messages={getMessages("ru")} timeZone="UTC">
        <CollectionsRoute />
      </IntlProvider>,
    );
  });
  await settle(10);
}

beforeEach(function reset() {
  vi.clearAllMocks();
  mocks.state = "ready";
  mocks.signOut.mockResolvedValue({ ok: true });
  mocks.fetchCollections.mockResolvedValue({ ok: true, collections });
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

describe("Мой вишлист → Подборки", () => {
  it("аноним уходит на вход и возвращается на /collections", async function anonymousGate() {
    mocks.state = "anonymous";
    await mount();

    expect(mocks.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/collections" },
    });
    expect(mocks.fetchCollections).not.toHaveBeenCalled();
  });

  it("рисует сетку опубликованных подборок с числом идей", async function grid() {
    await mount();

    expect(mocks.fetchCollections).toHaveBeenCalledTimes(1);
    const list = container.querySelector('[data-testid="collections-list"]');
    expect(list?.getAttribute("role")).toBe("list");
    expect(list?.querySelectorAll('[role="listitem"]')).toHaveLength(3);
    expect(container.textContent).toContain("Для рыбалки");
    expect(container.textContent).toContain("12 идей");
    expect(container.textContent).toContain("1 идея");
    expect(container.textContent).toContain("3 идеи");
  });

  it("нажатие на карточку открывает подборку", async function openCard() {
    await mount();

    const card = controlByLabel("Для рыбалки, 12 идей");
    expect(card).toBeDefined();
    await act(async function press() {
      card?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(mocks.push).toHaveBeenCalledWith({
      pathname: "/collections/[id]",
      params: { id: "c1" },
    });
  });

  it("пустой ответ — «Подборок пока нет», а не ошибка", async function empty() {
    mocks.fetchCollections.mockResolvedValue({ ok: true, collections: [] });
    await mount();

    expect(container.textContent).toContain("Подборок пока нет");
    expect(container.textContent).toContain("Скоро здесь появятся идеи подарков.");
    expect(controlByText("Повторить")).toBeUndefined();
  });

  it("обрыв сети показывает ошибку и «Повторить» читает снова", async function retry() {
    mocks.fetchCollections
      .mockResolvedValueOnce({ ok: false, network: true })
      .mockResolvedValueOnce({ ok: true, collections });
    await mount();

    expect(container.textContent).toContain("Не получилось загрузить. Проверьте сеть.");
    expect(container.textContent).toContain("Нет соединения. Попробуйте ещё раз.");

    const retry = controlByText("Повторить");
    expect(retry).toBeDefined();
    await act(async function pressRetry() {
      retry?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settle(10);

    expect(mocks.fetchCollections).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Для рыбалки");
  });
});
