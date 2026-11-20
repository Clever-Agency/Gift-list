// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { DetailDialog, type DetailFactView } from "./detail-dialog";
import { createMount, settle } from "./test-utils";

const mounted = createMount();

function noop() {}

const facts: DetailFactView[] = [
  { id: "description", label: "Описание", value: "Тёплый, 200 × 140." },
  { id: "status", label: "Статус", value: "Забронирован" },
];

function dialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[role='dialog']");
}

/** The label node of one fact: its whole text is the label. */
function factLabel(container: HTMLElement | null, label: string): HTMLElement | undefined {
  return Array.from(container?.querySelectorAll<HTMLElement>("*") ?? []).find(
    (node) => node.textContent === label,
  );
}

/**
 * Story 5.6: `DetailDialog` takes an optional `banner` — the owner's
 * `OwnerActionLabel` strip above the facts. Without it the body is exactly the
 * facts row of CLE-84; while a notice (loading, error) is set neither the facts
 * nor the strip are drawn.
 */
describe("DetailDialog: слот banner", () => {
  it("без полосы тело — прежние факты, лишнего блока нет", async () => {
    const { render } = mounted();
    await render(
      <DetailDialog open title="Плед" closeLabel="Закрыть" onClose={noop} facts={facts} />,
    );
    await settle();

    const body = dialog();
    expect(body?.textContent).toContain("Описание");
    expect(body?.textContent).toContain("Тёплый, 200 × 140.");
    expect(body?.textContent).toContain("Забронирован");
    expect(body?.querySelector("[data-testid='banner']")).toBeNull();
  });

  it("полоса стоит в теле над фактами, и факты остаются на месте", async () => {
    const { render } = mounted();
    await render(
      <DetailDialog
        open
        title="Плед"
        closeLabel="Закрыть"
        onClose={noop}
        facts={facts}
        banner={<div data-testid="banner">Срок брони истёк</div>}
      />,
    );
    await settle();

    const body = dialog();
    const banner = body?.querySelector<HTMLElement>("[data-testid='banner']");
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toBe("Срок брони истёк");
    // The strip is the first block of the body: the facts follow it.
    expect(banner?.parentElement?.firstElementChild).toBe(banner);
    expect(factLabel(body, "Описание")).toBeDefined();

    const position = banner?.compareDocumentPosition(factLabel(body, "Описание") as Node);
    expect(position && position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("notice скрывает и факты, и полосу: в теле только текст состояния", async () => {
    const { render } = mounted();
    await render(
      <DetailDialog
        open
        title="Плед"
        closeLabel="Закрыть"
        onClose={noop}
        facts={facts}
        notice="Загружаем желание"
        banner={<div data-testid="banner">Срок брони истёк</div>}
      />,
    );
    await settle();

    const body = dialog();
    expect(body?.textContent).toContain("Загружаем желание");
    expect(body?.textContent).not.toContain("Описание");
    expect(body?.querySelector("[data-testid='banner']")).toBeNull();
  });
});
