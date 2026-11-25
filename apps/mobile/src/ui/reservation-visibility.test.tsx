// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { click, settle } from "@/test/dom";
import { ReservationVisibility } from "@/ui/reservation-visibility";

const catalog = JSON.parse(
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../..",
      "packages/contracts/src/i18n/ru/app.json",
    ),
    "utf8",
  ),
) as { reservations: { visibility: Record<string, string> } };

vi.mock("use-intl", () => ({
  useTranslations: () => (key: string) => catalog.reservations.visibility[key] ?? key,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: Root;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  host = createRoot(container);
});

afterEach(async () => {
  await act(async () => host.unmount());
  container.remove();
});

async function render(node: ReactNode) {
  await act(async () => {
    host.render(node);
  });
  await settle(10);
}

function switches(): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="switch"]'));
}

function switchNamed(label: string): HTMLElement | undefined {
  return switches().find((node) => node.getAttribute("aria-label") === label);
}

/**
 * Story 5.5 (`DESIGN.md` → ReservationCard): «Кто видит, что это я» — свёрнутый
 * блок с переключателем «Показать другим, кто берёт». CLE-124/D-49: переключателя
 * «владельцу» больше нет, значение уходит одним действием `visibility`.
 */
describe("ReservationVisibility", () => {
  it("свёрнут: переключателей в дереве нет, заголовок — кнопка с aria-expanded", async () => {
    await render(
      <ReservationVisibility
        expanded={false}
        onToggle={function noop() {}}
        values={{ holderVisibleToOthers: true }}
        onChange={function noop() {}}
      />,
    );

    expect(switches()).toHaveLength(0);
    const toggle = container.querySelector<HTMLElement>('[aria-expanded="false"]');
    expect(toggle).not.toBeNull();
    expect(toggle?.textContent).toContain("Кто видит, что это я");
  });

  it("раскрыт: один переключатель «другим», без «владельцу» и подсказки", async () => {
    await render(
      <ReservationVisibility
        expanded
        onToggle={function noop() {}}
        values={{ holderVisibleToOthers: false }}
        onChange={function noop() {}}
      />,
    );

    expect(switches()).toHaveLength(1);
    expect(switchNamed("Показать владельцу, что это я")).toBeUndefined();
    expect(switchNamed("Показать другим, кто берёт")?.getAttribute("aria-checked")).toBe(
      "false",
    );
    expect(container.textContent).not.toContain("он может уже знать");
  });

  it("переключатель отдаёт значение «другим»", async () => {
    const onChange = vi.fn();
    await render(
      <ReservationVisibility
        expanded
        onToggle={function noop() {}}
        values={{ holderVisibleToOthers: true }}
        onChange={onChange}
      />,
    );

    await click(switchNamed("Показать другим, кто берёт"));
    expect(onChange).toHaveBeenLastCalledWith({ holderVisibleToOthers: false });
  });

  it("пока запрос в полёте, переключатель показывает значение и не меняет", async () => {
    const onChange = vi.fn();
    await render(
      <ReservationVisibility
        expanded
        busy
        onToggle={function noop() {}}
        values={{ holderVisibleToOthers: true }}
        onChange={onChange}
      />,
    );

    const others = switchNamed("Показать другим, кто берёт");
    expect(others?.getAttribute("aria-disabled")).toBe("true");
    await click(others);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("нажатие на заголовок сообщает о переключении", async () => {
    const onToggle = vi.fn();
    await render(
      <ReservationVisibility
        expanded={false}
        onToggle={onToggle}
        values={{ holderVisibleToOthers: true }}
        onChange={function noop() {}}
      />,
    );

    await click(container.querySelector('[aria-expanded="false"]'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
