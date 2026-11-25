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
 * блок с двумя переключателями. Оба значения уходят одним действием `visibility`,
 * поэтому компонент сообщает пару целиком.
 */
describe("ReservationVisibility", () => {
  it("свёрнут: переключателей в дереве нет, заголовок — кнопка с aria-expanded", async () => {
    await render(
      <ReservationVisibility
        expanded={false}
        onToggle={function noop() {}}
        values={{ holderVisibleToOwner: false, holderVisibleToOthers: true }}
        onChange={function noop() {}}
      />,
    );

    expect(switches()).toHaveLength(0);
    const toggle = container.querySelector<HTMLElement>('[aria-expanded="false"]');
    expect(toggle).not.toBeNull();
    expect(toggle?.textContent).toContain("Кто видит, что это я");
  });

  it("раскрыт: две подписи дословно, состояния из значений", async () => {
    await render(
      <ReservationVisibility
        expanded
        onToggle={function noop() {}}
        values={{ holderVisibleToOwner: true, holderVisibleToOthers: false }}
        onChange={function noop() {}}
      />,
    );

    expect(switches()).toHaveLength(2);
    expect(switchNamed("Показать владельцу, что это я")?.getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(switchNamed("Показать другим, кто берёт")?.getAttribute("aria-checked")).toBe(
      "false",
    );
    // Включённое «владельцу» показывает подсказку FR-31.
    expect(container.textContent).toContain(
      "Владелец сразу увидит ваше имя; если потом выключить, он может уже знать",
    );
  });

  it("подсказка есть только при включённом «владельцу»", async () => {
    await render(
      <ReservationVisibility
        expanded
        onToggle={function noop() {}}
        values={{ holderVisibleToOwner: false, holderVisibleToOthers: true }}
        onChange={function noop() {}}
      />,
    );

    expect(container.textContent).not.toContain("он может уже знать");
  });

  it("переключатель отдаёт пару с изменённой половиной", async () => {
    const onChange = vi.fn();
    await render(
      <ReservationVisibility
        expanded
        onToggle={function noop() {}}
        values={{ holderVisibleToOwner: false, holderVisibleToOthers: true }}
        onChange={onChange}
      />,
    );

    await click(switchNamed("Показать владельцу, что это я"));
    expect(onChange).toHaveBeenLastCalledWith({
      holderVisibleToOwner: true,
      holderVisibleToOthers: true,
    });

    await click(switchNamed("Показать другим, кто берёт"));
    expect(onChange).toHaveBeenLastCalledWith({
      holderVisibleToOwner: false,
      holderVisibleToOthers: false,
    });
  });

  it("пока запрос в полёте, переключатели показывают значение и не меняют", async () => {
    const onChange = vi.fn();
    await render(
      <ReservationVisibility
        expanded
        busy
        onToggle={function noop() {}}
        values={{ holderVisibleToOwner: false, holderVisibleToOthers: true }}
        onChange={onChange}
      />,
    );

    const owner = switchNamed("Показать владельцу, что это я");
    expect(owner?.getAttribute("aria-disabled")).toBe("true");
    await click(owner);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("нажатие на заголовок сообщает о переключении", async () => {
    const onToggle = vi.fn();
    await render(
      <ReservationVisibility
        expanded={false}
        onToggle={onToggle}
        values={{ holderVisibleToOwner: false, holderVisibleToOthers: true }}
        onChange={function noop() {}}
      />,
    );

    await click(container.querySelector('[aria-expanded="false"]'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
