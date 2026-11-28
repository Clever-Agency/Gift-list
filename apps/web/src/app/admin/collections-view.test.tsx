// @vitest-environment happy-dom
// CLE-143 (Story 10.1, AD-22): the `/admin` collections view — the table, the
// form layer, the publication switch and the idea order as a person uses them.
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGiftListConfig, GiftListProvider } from "@gift-list/ui";
import type { EditorialCollectionAdminDetail } from "@gift-list/contracts";

const actions = vi.hoisted(() => ({
  loadCollectionAction: vi.fn(),
  createCollectionAction: vi.fn(),
  updateCollectionAction: vi.fn(),
  deleteCollectionAction: vi.fn(),
  publishCollectionAction: vi.fn(),
  unpublishCollectionAction: vi.fn(),
  createItemAction: vi.fn(),
  updateItemAction: vi.fn(),
  deleteItemAction: vi.fn(),
  reorderItemsAction: vi.fn(),
}));

vi.mock("@/actions/editorial-admin", () => actions);

import { CollectionForm } from "./collection-form";
import { CollectionsView } from "./collections-view";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const config = createGiftListConfig({
  body: "var(--font-sans)",
  heading: "var(--font-heading)",
});

let root: Root | undefined;
let container: HTMLDivElement | undefined;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  document.body.innerHTML = "";
});

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise(function nextTick(resolve) {
    setTimeout(resolve, 0);
  });
}

async function render(element: ReactElement): Promise<void> {
  await act(async () => {
    root?.render(<GiftListProvider config={config}>{element}</GiftListProvider>);
    await flush();
  });
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();
  });
}

async function typeInto(label: string, value: string): Promise<void> {
  const field = document.querySelector(`[aria-label="${label}"]`) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | null;
  expect(field, label).not.toBeNull();
  const prototype = field instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  await act(async () => {
    setter?.call(field, value);
    field?.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

function control(label: string): HTMLElement {
  const element = document.querySelector(`[aria-label="${label}"]`);
  expect(element, label).not.toBeNull();
  return element as HTMLElement;
}

function button(text: string): HTMLElement {
  const found = Array.from(document.querySelectorAll("button")).find(function matches(node) {
    return node.textContent?.trim() === text;
  });
  expect(found, text).not.toBeUndefined();
  return found as HTMLElement;
}

const termos = {
  id: "i1",
  title: "Термос",
  description: null,
  linkUrl: null,
  imageUrl: null,
  position: 0,
};

const spinning = {
  id: "i2",
  title: "Спиннинг",
  description: null,
  linkUrl: "https://example.com/spinning",
  imageUrl: null,
  position: 1,
};

const detail: EditorialCollectionAdminDetail = {
  id: "c1",
  title: "Для рыбалки",
  description: null,
  coverImageUrl: null,
  itemCount: 2,
  publishedAt: null,
  updatedAt: "2026-11-27T10:00:00.000Z",
  items: [termos, spinning],
};

const summary = {
  id: "c1",
  title: "Для рыбалки",
  description: null,
  coverImageUrl: null,
  itemCount: 2,
  publishedAt: null,
  updatedAt: "2026-11-27T10:00:00.000Z",
};

beforeEach(() => {
  for (const mock of Object.values(actions)) mock.mockReset();
});

describe("CollectionsView: table and empty state", () => {
  it("shows the calm empty sentence and the create action", async () => {
    await render(<CollectionsView collections={[]} />);

    expect(container?.textContent).toContain("Подборок пока нет");
    expect(button("Создать подборку")).toBeDefined();
    expect(document.querySelector("table")).toBeNull();
  });

  it("renders the row with the count, status and the changed date", async () => {
    await render(<CollectionsView collections={[summary]} />);

    const table = document.querySelector("table");
    expect(table).not.toBeNull();
    expect(table?.querySelector("caption")?.textContent).toBe("Подборки");
    expect(table?.querySelectorAll('th[scope="col"]')).toHaveLength(5);
    expect(table?.textContent).toContain("Для рыбалки");
    expect(table?.textContent).toContain("2");
    expect(table?.textContent).toContain("Черновик");
    expect(table?.textContent).toContain("27.11.2026");
  });
});

describe("CollectionsView: the form layer", () => {
  it("opens the create form, saves the collection and announces it", async () => {
    actions.createCollectionAction.mockResolvedValue({
      ok: true,
      data: { ...detail, items: [], itemCount: 0 },
    });
    await render(<CollectionsView collections={[]} />);

    await click(button("Создать подборку"));
    expect(document.body.textContent).toContain("Новая подборка");

    await typeInto("Название", "Для рыбалки");
    await click(button("Сохранить"));

    expect(actions.createCollectionAction).toHaveBeenCalledWith({
      title: "Для рыбалки",
      description: "",
      coverImageUrl: "",
    });
    const toast = document.querySelector('[data-testid="admin-toast"]');
    expect(toast?.textContent).toContain("Подборка создана");
    expect(toast?.querySelector('[role="status"]')).not.toBeNull();
  });

  it("shows a field error under the title instead of saving garbage", async () => {
    actions.createCollectionAction.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "title",
    });
    await render(<CollectionsView collections={[]} />);

    await click(button("Создать подборку"));
    await click(button("Сохранить"));

    expect(document.body.textContent).toContain("Введите название: от 1 до 120 символов");
  });

  it("refuses to publish an empty collection with a clear sentence", async () => {
    actions.publishCollectionAction.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      reason: "COLLECTION_EMPTY",
    });
    actions.loadCollectionAction.mockResolvedValue({ ok: true, data: { ...detail, items: [], itemCount: 0 } });
    await render(<CollectionsView collections={[summary]} />);

    await click(control("Изменить подборку «Для рыбалки»"));
    const toggle = document.querySelector('[role="switch"]');
    expect(toggle).not.toBeNull();
    await click(toggle as HTMLElement);

    expect(actions.publishCollectionAction).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Пустую подборку нельзя опубликовать");
  });
});

describe("CollectionForm: ideas and their order", () => {
  it("adds an idea through the server action", async () => {
    actions.createItemAction.mockResolvedValue({ ok: true, data: detail });
    const onNotice = vi.fn();
    await render(
      <CollectionForm
        open
        collection={detail}
        onClose={vi.fn()}
        onChanged={vi.fn()}
        onNotice={onNotice}
      />,
    );

    expect(document.body.textContent).toContain(
      "Ссылки блогеров не добавляйте до юридической проверки",
    );
    await typeInto("Название элемента", "Фонарь");
    await click(button("Добавить элемент"));

    expect(actions.createItemAction).toHaveBeenCalledWith("c1", {
      title: "Фонарь",
      description: "",
      linkUrl: "",
      imageUrl: "",
    });
    expect(onNotice).toHaveBeenCalledWith("Элемент добавлен", "success");
  });

  it("moves an idea with the stored order of ids", async () => {
    const reordered = { ...detail, items: [spinning, termos] };
    actions.reorderItemsAction.mockResolvedValue({ ok: true, data: reordered });
    await render(
      <CollectionForm
        open
        collection={detail}
        onClose={vi.fn()}
        onChanged={vi.fn()}
        onNotice={vi.fn()}
      />,
    );

    await click(control("Опустить «Термос»"));

    expect(actions.reorderItemsAction).toHaveBeenCalledWith("c1", ["i2", "i1"]);
  });

  it("does not move the first idea up or the last one down", async () => {
    await render(
      <CollectionForm
        open
        collection={detail}
        onClose={vi.fn()}
        onChanged={vi.fn()}
        onNotice={vi.fn()}
      />,
    );

    expect(control("Поднять «Термос»").getAttribute("aria-disabled")).toBe("true");
    expect(control("Опустить «Спиннинг»").getAttribute("aria-disabled")).toBe("true");
  });

  it("edits an idea in place and removes it", async () => {
    actions.updateItemAction.mockResolvedValue({ ok: true, data: detail });
    actions.deleteItemAction.mockResolvedValue({ ok: true, data: detail });
    await render(
      <CollectionForm
        open
        collection={detail}
        onClose={vi.fn()}
        onChanged={vi.fn()}
        onNotice={vi.fn()}
      />,
    );

    await click(control("Изменить элемент «Термос»"));
    await typeInto("Название элемента", "Термос 1 л");
    await click(button("Сохранить элемент"));

    expect(actions.updateItemAction).toHaveBeenCalledWith("c1", "i1", {
      title: "Термос 1 л",
      description: "",
      linkUrl: "",
      imageUrl: "",
    });

    await click(control("Удалить элемент «Спиннинг»"));
    expect(actions.deleteItemAction).toHaveBeenCalledWith("c1", "i2");
  });

  it("publishes a non-empty collection and unpublishes it again", async () => {
    const published = { ...summary, publishedAt: "2026-11-27T11:00:00.000Z" };
    actions.publishCollectionAction.mockResolvedValue({ ok: true, data: published });
    actions.unpublishCollectionAction.mockResolvedValue({ ok: true, data: summary });
    await render(
      <CollectionForm
        open
        collection={detail}
        onClose={vi.fn()}
        onChanged={vi.fn()}
        onNotice={vi.fn()}
      />,
    );

    const toggle = document.querySelector('[role="switch"]') as HTMLElement;
    await click(toggle);
    expect(actions.publishCollectionAction).toHaveBeenCalledWith("c1");

    await act(async () => {
      await flush();
    });
    await click(document.querySelector('[role="switch"]') as HTMLElement);
    expect(actions.unpublishCollectionAction).toHaveBeenCalledWith("c1");
  });
});
