// @vitest-environment happy-dom
import { getMessages, safeNextPath, type NotificationItem } from "@gift-list/contracts";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { IntlProvider } from "use-intl";
import { beforeEach, expect, it, vi } from "vitest";
import NotificationsScreen from "../../app/(app)/notifications";
import { NotificationBadgeContext } from "@/navigation/notification-badge";
import { typeInto } from "@/test/dom";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(function makeMocks() {
  return {
    session: { ready: false },
    params: { id: "emailed-item" as string | undefined },
    focus: { run: undefined as React.EffectCallback | undefined },
    replace: vi.fn(),
    navigate: vi.fn(),
    mark: vi.fn(),
    fetchFeed: vi.fn(),
    fetchItem: vi.fn(),
    submit: vi.fn(),
    refresh: vi.fn(),
  };
});

vi.mock("expo-symbols", function symbols() {
  return { SymbolView: function DecorativeSymbol() { return null; } };
});
vi.mock("expo-linking", function linking() {
  return { openURL: vi.fn() };
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

vi.mock("expo-router", async function routerModule() {
  const { useEffect } = await import("react");
  return {
    router: { replace: mocks.replace, navigate: mocks.navigate },
    useLocalSearchParams: function params() { return mocks.params; },
    useFocusEffect: function useFocusEffect(effect: React.EffectCallback) {
      useEffect(function focused() {
        mocks.focus.run = effect;
        return effect();
      }, [effect]);
    },
    usePathname: function pathname() { return "/notifications"; },
    Stack: { Screen: function TestScreen() { return null; } },
  };
});
vi.mock("@/session/auth-context", function authModule() {
  return {
    useAuth: function session() {
      return { state: mocks.session.ready ? { status: "ready", user: { id: "recipient", name: "Мария", nick: "maria", timeZone: "UTC" } } : { status: "anonymous" } };
    },
  };
});
vi.mock("@/api/notifications", function api() {
  return {
    fetchNotification: mocks.fetchItem,
    fetchNotifications: mocks.fetchFeed,
    markNotificationRead: mocks.mark,
    submitNotificationAction: mocks.submit,
  };
});

function render() {
  return (
    <IntlProvider locale="ru" messages={getMessages("ru")} timeZone="UTC">
      <NotificationBadgeContext.Provider value={{ count: 1, refresh: mocks.refresh }}>
        <NotificationsScreen />
      </NotificationBadgeContext.Provider>
    </IntlProvider>
  );
}

beforeEach(function reset() {
  vi.resetAllMocks();
  mocks.session.ready = false;
  mocks.params.id = "emailed-item";
  mocks.focus.run = undefined;
});

it("returns through login to the selected record and reads it only after an explicit press", async function emailReturn() {
  const item: NotificationItem = {
    id: "emailed-item",
    createdAt: "2026-11-24T13:30:00.000Z",
    readAt: null,
    href: null,
    event: { kind: "UNKNOWN" },
  };
  mocks.fetchFeed.mockResolvedValue({ items: [], unread: 1, nextCursor: null });
  mocks.fetchItem.mockResolvedValue(item);
  mocks.mark.mockResolvedValue({ ok: true, data: { id: item.id } });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async function anonymous() { root.render(render()); });
    expect(mocks.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/notifications?id=emailed-item" },
    });
    const { next } = mocks.replace.mock.calls[0]![0].params;
    expect(safeNextPath(next)).toBe(next);
    expect(mocks.fetchItem).not.toHaveBeenCalled();

    mocks.session.ready = true;
    await act(async function authenticated() { root.render(render()); });
    expect(mocks.fetchItem).toHaveBeenCalledWith(item.id);
    expect(container.textContent).toContain("У вас новое уведомление");
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(mocks.mark).not.toHaveBeenCalled();

    const row = container.querySelector<HTMLElement>('[role="button"][aria-label^="Новое"]');
    expect(row).not.toBeNull();
    await act(async function explicitlyMarkRead() { row?.click(); });
    expect(mocks.mark).toHaveBeenCalledOnce();
    expect(mocks.mark).toHaveBeenCalledWith(item.id);
    expect(mocks.refresh).toHaveBeenCalledOnce();
  } finally {
    await act(async function remove() { root.unmount(); });
    container.remove();
    mocks.session.ready = false;
  }
});


it("opens the selected record independently when the feed request later fails", async function selectedWithoutFeed() {
  mocks.session.ready = true;
  let finishFeed: (value: null) => void = function noop() {};
  mocks.fetchFeed.mockReturnValue(new Promise(function pending(resolve) {
    finishFeed = resolve;
  }));
  mocks.fetchItem.mockResolvedValue({
    id: "emailed-item", createdAt: "2026-11-24T13:30:00.000Z", readAt: null,
    href: null, event: { kind: "UNKNOWN" },
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async function show() { root.render(render()); });
    expect(container.textContent).toContain("У вас новое уведомление");
    await act(async function failFeed() { finishFeed(null); });
    expect(container.textContent).toContain("Не удалось загрузить уведомления");
    expect(container.textContent).toContain("У вас новое уведомление");
    mocks.fetchFeed.mockResolvedValue({ items: [], nextCursor: null });
    await act(async function refocus() { mocks.focus.run?.(); });
    expect(mocks.fetchFeed).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain("Не удалось загрузить уведомления");
  } finally {
    await act(async function remove() { root.unmount(); });
    container.remove();
  }
});

it("reports failure to fetch the selected record while rendering the feed", async function selectedError() {
  mocks.session.ready = true;
  mocks.fetchFeed.mockResolvedValue({ items: [], nextCursor: null });
  mocks.fetchItem.mockResolvedValue(null);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async function show() { root.render(render()); });
    expect(container.textContent).toContain("Не удалось открыть уведомление из ссылки");
    expect(container.textContent).toContain("Пока тихо");
    expect(container.textContent).not.toContain("Не удалось загрузить уведомления");
  } finally {
    await act(async function remove() { root.unmount(); });
    container.remove();
  }
});

it("marks bought before offering a date and allows clearing the mark from the same notice", async function markBoughtThenExtend() {
  mocks.session.ready = true;
  mocks.params.id = undefined;
  let bought = false;
  mocks.fetchFeed.mockImplementation(async function currentFeed() {
    return {
      items: [{
        id: "due-item", createdAt: "2026-11-24T13:30:00.000Z", readAt: null, href: null,
        event: { kind: "RESERVATION_DUE", giftId: "gift", titleSnapshot: "Плед", actionable: true, bought },
      }],
      nextCursor: null,
    };
  });
  mocks.submit.mockImplementation(async function mutate(id, command) {
    bought = command.action === "bought";
    return { ok: true, data: { id } };
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async function show() { root.render(render()); });
    expect(document.querySelector('input[type="date"]')).toBeNull();
    await press("Купил, ещё не вручил");
    expect(mocks.submit).toHaveBeenCalledExactlyOnceWith("due-item", { action: "bought" });
    const date = document.querySelector<HTMLInputElement>('input[type="date"]');
    expect(date).not.toBeNull();
    const initialDate = date!.value;
    await typeInto(date!, date!.min);
    expect(date?.value).not.toBe(initialDate);
    await press("Отмена");
    await press("Продлить до…");
    expect(document.querySelector<HTMLInputElement>('input[type="date"]')?.value).toBe(initialDate);
    await press("Отмена");
    await press("Снять отметку «Купил»");
    expect(mocks.submit).toHaveBeenNthCalledWith(2, "due-item", { action: "clearBought" });
    expect(container.textContent).toContain("Купил, ещё не вручил");
    await press("Купил, ещё не вручил");
    const reopened = document.querySelector<HTMLInputElement>('input[type="date"]')!;
    const dueOn = reopened.min;
    await typeInto(reopened, dueOn);
    await press("Подтвердить");
    expect(mocks.submit).toHaveBeenLastCalledWith("due-item", { action: "extend", dueOn });
  } finally {
    await act(async function remove() { root.unmount(); });
    container.remove();
  }
});

/**
 * CLE-124/S9b-3 (§10.2, §10.4): the reminder arrives before the deadline, so it
 * keeps «Продлить до…» and adds «Подарил»; the expiry notice keeps «Подарил» but
 * loses the extension.
 */
it("напоминание до срока оставляет «Продлить до…», а «Срок истёк» — нет", async function dueActions() {
  mocks.session.ready = true;
  mocks.params.id = undefined;
  mocks.fetchFeed.mockResolvedValue({
    items: [{
      id: "reminder", createdAt: "2026-11-24T13:30:00.000Z", readAt: null, href: null,
      event: {
        kind: "RESERVATION_DUE", giftId: "gift", titleSnapshot: "Плед", actionable: true,
        dueAt: "2999-01-01T21:00:00.000Z", timeZone: "UTC", reminder: true,
      },
    }],
    nextCursor: null,
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async function show() { root.render(render()); });
    expect(container.textContent).toContain("снимется через 7 дней после этой даты");
    for (const label of ["Подарил", "Купил, ещё не вручил", "Продлить до…", "Снять бронь"]) {
      expect(actionButton(label), `кнопка «${label}»`).toBeDefined();
    }

    mocks.fetchFeed.mockResolvedValue({
      items: [{
        id: "due", createdAt: "2026-11-24T13:30:00.000Z", readAt: null, href: null,
        event: {
          kind: "RESERVATION_DUE", giftId: "gift", titleSnapshot: "Плед", actionable: true,
          dueAt: "2020-01-01T21:00:00.000Z", timeZone: "UTC",
        },
      }],
      nextCursor: null,
    });
    await act(async function refocus() { mocks.focus.run?.(); });
    expect(container.textContent).toContain("Если ничего не сделать, бронь снимется");
    for (const label of ["Подарил", "Купил, ещё не вручил", "Снять бронь"]) {
      expect(actionButton(label), `кнопка «${label}»`).toBeDefined();
    }
    expect(actionButton("Продлить до…")).toBeUndefined();
  } finally {
    await act(async function remove() { root.unmount(); });
    container.remove();
  }
});

it("«Подарил» из уведомления отправляет действие given (Story 5.7)", async function markGiven() {
  mocks.session.ready = true;
  mocks.params.id = undefined;
  mocks.fetchFeed.mockResolvedValue({
    items: [{
      id: "due", createdAt: "2026-11-24T13:30:00.000Z", readAt: null, href: null,
      event: {
        kind: "RESERVATION_DUE", giftId: "gift", titleSnapshot: "Плед", actionable: true,
        dueAt: "2020-01-01T21:00:00.000Z", timeZone: "UTC",
      },
    }],
    nextCursor: null,
  });
  mocks.submit.mockResolvedValue({ ok: true, data: { id: "due" } });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async function show() { root.render(render()); });
    await press("Подарил");
    expect(mocks.submit).toHaveBeenCalledExactlyOnceWith("due", { action: "given" });
  } finally {
    await act(async function remove() { root.unmount(); });
    container.remove();
  }
});

/**
 * Story 6.6 (D-26, D-49): the wish-expiry notice has two variants — the released
 * one only states the fact, the kept one offers the same «Подарил» action.
 */
it("показывает срок желания и предлагает «Подарил» только при сохранённой брони", async function wishExpiryNotices() {
  mocks.session.ready = true;
  mocks.params.id = undefined;
  mocks.submit.mockResolvedValue({ ok: true, data: { id: "kept" } });
  function feed(event: NotificationItem["event"], id = "notice") {
    return { items: [{ id, createdAt: "2026-11-24T13:30:00.000Z", readAt: null, href: null, event }], nextCursor: null };
  }
  mocks.fetchFeed.mockResolvedValue(feed({
    kind: "WISH_EXPIRY_SOON", giftId: "gift", titleSnapshot: "Плед",
  }));
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async function show() { root.render(render()); });
    expect(container.textContent).toContain("Срок желания «Плед» через 3 дня");
    expect(actionButton("Подарил")).toBeUndefined();

    mocks.fetchFeed.mockResolvedValue(feed({
      kind: "WISH_EXPIRY", giftId: "gift", titleSnapshot: "Плед", released: true, actionable: false,
    }));
    await act(async function refocus() { mocks.focus.run?.(); });
    expect(container.textContent).toContain("Срок желания «Плед» вышел, бронь снята");
    expect(actionButton("Подарил")).toBeUndefined();
    expect(container.textContent).not.toContain("Даритель уже ответил");

    mocks.fetchFeed.mockResolvedValue(feed({
      kind: "WISH_EXPIRY", giftId: "gift", titleSnapshot: "Плед", released: false, actionable: true,
    }, "kept"));
    await act(async function kept() { mocks.focus.run?.(); });
    expect(container.textContent).toContain("Если уже подарили — отметьте «Подарил»");
    await press("Подарил");
    expect(mocks.submit).toHaveBeenCalledExactlyOnceWith("kept", { action: "given" });

    mocks.fetchFeed.mockResolvedValue(feed({
      kind: "WISH_EXPIRY", giftId: "gift", titleSnapshot: "Плед", released: false, actionable: false,
    }, "stale"));
    await act(async function stale() { mocks.focus.run?.(); });
    expect(actionButton("Подарил")).toBeUndefined();
    expect(container.textContent).toContain("Даритель уже ответил");
  } finally {
    await act(async function remove() { root.unmount(); });
    container.remove();
  }
});

it("позднее продление из уведомления называет срок, а не «даритель ответил»", async function lateExtend() {
  mocks.session.ready = true;
  mocks.params.id = undefined;
  mocks.fetchFeed.mockResolvedValue({
    items: [{
      id: "reminder", createdAt: "2026-11-24T13:30:00.000Z", readAt: null, href: null,
      event: {
        kind: "RESERVATION_DUE", giftId: "gift", titleSnapshot: "Плед", actionable: true,
        dueAt: "2999-01-01T21:00:00.000Z", timeZone: "UTC", reminder: true,
      },
    }],
    nextCursor: null,
  });
  mocks.submit.mockResolvedValue({
    ok: false,
    code: "CONFLICT",
    message: "The reservation deadline has passed",
    reason: "RESERVATION_DUE_PASSED",
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async function show() { root.render(render()); });
    await press("Продлить до…");
    await press("Подтвердить");
    expect(container.textContent).toContain("Срок брони прошёл — продлить уже нельзя.");
    expect(container.textContent).not.toContain("Даритель уже ответил");
  } finally {
    await act(async function remove() { root.unmount(); });
    container.remove();
  }
});

/**
 * Story 7.3 (FR-34): the birthday reminder names the Friend and the day without
 * a year, shows the open-wish summary and opens the Friend's profile.
 */
it("показывает день рождения друга и открывает его профиль", async function friendBirthday() {
  mocks.session.ready = true;
  mocks.params.id = undefined;
  mocks.fetchFeed.mockResolvedValue({
    items: [{
      id: "birthday",
      createdAt: "2026-11-24T13:30:00.000Z",
      readAt: "2026-11-24T13:31:00.000Z",
      href: "/u/anya",
      event: {
        kind: "DATE_FRIEND",
        personName: "Аня",
        personNick: "anya",
        date: "2026-03-14",
        count: 4,
        titles: ["Плед", "Книга", "Наушники"],
      },
    }],
    nextCursor: null,
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async function show() { root.render(render()); });
    expect(container.textContent).toContain("У Аня день рождения 14.03");
    expect(container.textContent).toContain("Открытых желаний: 4");
    expect(container.textContent).toContain("«Плед», «Книга», «Наушники»");

    const row = container.querySelector<HTMLElement>('[role="button"][aria-label^="У Аня"]');
    expect(row).not.toBeNull();
    await act(async function openProfile() { row?.click(); });
    expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith("/u/anya");
    expect(mocks.mark).not.toHaveBeenCalled();
  } finally {
    await act(async function remove() { root.unmount(); });
    container.remove();
  }
});

async function press(label: string) {
  const button = actionButton(label);
  expect(button).toBeDefined();
  await act(async function click() { button?.click(); });
}

/** The control whose accessible name is the label; notifications actions have no text. */
function actionButton(label: string): HTMLElement | undefined {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="button"]')).find(
    element => element.getAttribute("aria-label") === label,
  );
}
