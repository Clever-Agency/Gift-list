// @vitest-environment happy-dom
// CLE-144 (Story 10.2, AD-22): the `/admin/tags` view — the queue table, the
// approve layer, the rejection confirmation and the result toast as a person uses
// them.
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGiftListConfig, GiftListProvider } from "@gift-list/ui";
import type { CustomTagQueueItem, TagCatalogItem } from "@gift-list/contracts";

const actions = vi.hoisted(() => ({
  approveCustomTagAction: vi.fn(),
  rejectCustomTagAction: vi.fn(),
}));

vi.mock("@/actions/custom-tag-admin", () => actions);

import { TagsView } from "./tags-view";

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
  for (const mock of Object.values(actions)) mock.mockReset();
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
  const field = document.querySelector(`[aria-label="${label}"]`) as HTMLInputElement | null;
  expect(field, label).not.toBeNull();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

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

function radio(label: string): HTMLElement {
  const element = document.querySelector(`[role="radio"][aria-label="${label}"]`);
  expect(element, label).not.toBeNull();
  return element as HTMLElement;
}

/** A button inside one layer: the row and the dialog both say «Одобрить». */
function buttonIn(testId: string, text: string): HTMLElement {
  const layer = document.querySelector(`[data-testid="${testId}"]`);
  expect(layer, testId).not.toBeNull();
  const found = Array.from(layer?.querySelectorAll("button") ?? []).find(function matches(node) {
    return node.textContent?.trim() === text;
  });
  expect(found, text).not.toBeUndefined();
  return found as HTMLElement;
}

const item: CustomTagQueueItem = {
  normalizedText: "айфон",
  sampleText: "Айфон",
  usageCount: 3,
};

const catalog: TagCatalogItem[] = [{ id: "t1", slug: "iphone", label: "Айфон" }];

describe("TagsView: the queue table", () => {
  it("shows the calm empty sentence and no table", async () => {
    await render(<TagsView queue={[]} tags={catalog} />);

    expect(container?.textContent).toContain("Тегов на модерации нет");
    expect(document.querySelector("table")).toBeNull();
  });

  it("renders the caption, the three columns and the row", async () => {
    await render(<TagsView queue={[item]} tags={catalog} />);

    const table = document.querySelector("table");
    expect(table).not.toBeNull();
    expect(table?.querySelector("caption")?.textContent).toBe("Свои теги на модерации");
    expect(table?.querySelectorAll('th[scope="col"]')).toHaveLength(3);
    expect(table?.textContent).toContain("Айфон");
    expect(table?.textContent).toContain("3");
    expect(control("Одобрить «Айфон»")).toBeDefined();
    expect(control("Отклонить «Айфон»")).toBeDefined();
  });
});

describe("TagsView: approval", () => {
  it("approves the text into a new catalog tag and announces it", async () => {
    actions.approveCustomTagAction.mockResolvedValue({
      ok: true,
      data: { normalizedText: "айфон", tagId: "t9", linkedTags: 3 },
    });
    await render(<TagsView queue={[item]} tags={catalog} />);

    await click(control("Одобрить «Айфон»"));
    expect(document.body.textContent).toContain("Одобрение тега «Айфон»");
    // The caption is prefilled from the queue key and stays editable.
    expect(
      (document.querySelector('[aria-label="Подпись (ru)"]') as HTMLInputElement).value,
    ).toBe("айфон");

    await typeInto("Slug", "iphone");
    await click(buttonIn("admin-tag-approve", "Одобрить"));

    expect(actions.approveCustomTagAction).toHaveBeenCalledWith({
      mode: "new",
      normalizedText: "айфон",
      slug: "iphone",
      labels: { ru: "айфон" },
    });
    const toast = document.querySelector('[data-testid="admin-tag-toast"]');
    expect(toast?.textContent).toContain("Тег одобрен");
    expect(toast?.querySelector('[role="status"]')).not.toBeNull();
    expect(document.querySelector("table")).toBeNull();
  });

  it("approves the text into an existing catalog tag", async () => {
    actions.approveCustomTagAction.mockResolvedValue({
      ok: true,
      data: { normalizedText: "айфон", tagId: "t1", linkedTags: 3 },
    });
    await render(<TagsView queue={[item]} tags={catalog} />);

    await click(control("Одобрить «Айфон»"));
    await click(radio("Существующий тег"));
    await click(radio("Айфон"));
    await click(buttonIn("admin-tag-approve", "Одобрить"));

    expect(actions.approveCustomTagAction).toHaveBeenCalledWith({
      mode: "existing",
      normalizedText: "айфон",
      tagId: "t1",
    });
    expect(document.body.textContent).toContain("Тег одобрен");
  });

  it("keeps the row and shows a taken slug under the field", async () => {
    actions.approveCustomTagAction.mockResolvedValue({
      ok: false,
      code: "CONFLICT",
      message: "Conflict",
      reason: "CUSTOM_TAG_SLUG_TAKEN",
      field: "slug",
    });
    await render(<TagsView queue={[item]} tags={catalog} />);

    await click(control("Одобрить «Айфон»"));
    await typeInto("Slug", "iphone");
    await click(buttonIn("admin-tag-approve", "Одобрить"));

    expect(document.body.textContent).toContain("Такой slug уже занят");
    expect(document.querySelector("table")).not.toBeNull();
  });

  it("shows an empty caption error under the language field", async () => {
    actions.approveCustomTagAction.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Invalid input",
      field: "labels.ru",
    });
    await render(<TagsView queue={[item]} tags={catalog} />);

    await click(control("Одобрить «Айфон»"));
    await click(buttonIn("admin-tag-approve", "Одобрить"));

    expect(document.body.textContent).toContain("Подпись не может быть пустой");
    expect(document.querySelector("table")).not.toBeNull();
  });

  it("refuses an existing-tag approval with no tag chosen", async () => {
    await render(<TagsView queue={[item]} tags={catalog} />);

    await click(control("Одобрить «Айфон»"));
    await click(radio("Существующий тег"));
    await click(buttonIn("admin-tag-approve", "Одобрить"));

    expect(actions.approveCustomTagAction).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Такого тега нет в каталоге");
  });
});

describe("TagsView: rejection", () => {
  it("confirms the rejection, drops the row and announces it", async () => {
    actions.rejectCustomTagAction.mockResolvedValue({
      ok: true,
      data: { normalizedText: "айфон" },
    });
    await render(<TagsView queue={[item]} tags={catalog} />);

    await click(control("Отклонить «Айфон»"));
    expect(document.body.textContent).toContain("Отклонить тег?");
    await click(buttonIn("admin-tag-reject", "Отклонить"));

    expect(actions.rejectCustomTagAction).toHaveBeenCalledWith({ normalizedText: "айфон" });
    const toast = document.querySelector('[data-testid="admin-tag-toast"]');
    expect(toast?.textContent).toContain("Тег отклонён");
    expect(toast?.querySelector('[role="status"]')).not.toBeNull();
    expect(document.querySelector("table")).toBeNull();
  });

  it("keeps the row and explains a repeated decision", async () => {
    actions.rejectCustomTagAction.mockResolvedValue({
      ok: false,
      code: "CONFLICT",
      message: "Conflict",
      reason: "CUSTOM_TAG_DECIDED",
    });
    await render(<TagsView queue={[item]} tags={catalog} />);

    await click(control("Отклонить «Айфон»"));
    await click(buttonIn("admin-tag-reject", "Отклонить"));

    expect(document.body.textContent).toContain("Этот текст уже решён. Обновите страницу.");
    expect(document.querySelector("table")).not.toBeNull();
  });
});
