// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { click, dialogElement, escape, settle } from "@/test/dom";
import { ReservationReleaseConfirm } from "@/ui/reservation-release-confirm";

const catalog = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../../..", "packages/contracts/src/i18n/ru/app.json"),
    "utf8",
  ),
) as { gift: { release: Record<string, string> } };

vi.mock("use-intl", () => ({
  useTranslations: () => (key: string) => catalog.gift.release[key] ?? key,
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
  await settle();
}

function body(): string {
  return dialogElement()?.textContent ?? "";
}

function control(label: string): HTMLElement | undefined {
  return Array.from(
    document.querySelectorAll<HTMLElement>('button, [role="button"]'),
  ).find((node) => (node.textContent ?? "").includes(label));
}

const onClose = vi.fn();
const onConfirm = vi.fn();

beforeEach(() => {
  onClose.mockReset();
  onConfirm.mockReset();
});

/**
 * Story 5.2: снятие своей брони — обычное действие. Тексты дословные из epics и
 * EXPERIENCE, «Отмена» — ghost, «Снять бронь» — обычная кнопка, не коралловая
 * (`DESIGN.md` → Colors → Destructive оставляет красный за чужой бронью).
 */
describe("ReservationReleaseConfirm", () => {
  it("показывает вопрос и обе кнопки дословно", async () => {
    await render(
      <ReservationReleaseConfirm
        open
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    expect(dialogElement()).not.toBeNull();
    expect(body()).toContain("Снять бронь? Желание снова станет открытым.");
    expect(control("Отмена")).toBeDefined();
    expect(control("Снять бронь")).toBeDefined();
    expect(catalog.gift.release.title).toBe("Снять бронь? Желание снова станет открытым.");
    expect(catalog.gift.release.confirm).toBe("Снять бронь");
    expect(catalog.gift.release.cancel).toBe("Отмена");
  });

  it("«Снять бронь» подтверждает, «Отмена» и Esc закрывают без действия", async () => {
    await render(
      <ReservationReleaseConfirm open onClose={onClose} onConfirm={onConfirm} />,
    );

    await click(control("Снять бронь"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    await click(control("Отмена"));
    expect(onClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      escape();
    });
    await settle();
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("пока запрос в полёте, кнопки заняты и второй раз не отправляют", async () => {
    await render(
      <ReservationReleaseConfirm open busy onClose={onClose} onConfirm={onConfirm} />,
    );

    const confirm = control("Снять бронь");
    expect(confirm?.getAttribute("aria-busy")).toBe("true");
    expect(confirm?.getAttribute("aria-disabled")).toBe("true");
    expect(control("Отмена")?.getAttribute("aria-disabled")).toBe("true");

    await click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
    await click(control("Отмена"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
