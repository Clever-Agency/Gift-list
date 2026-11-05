// @vitest-environment happy-dom
import { VISIBILITIES, type GiftCard } from "@gift-list/contracts";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { click, controlByLabel, dialogElement, escape, pressScrim, settle } from "@/test/dom";
import { VisibilityPicker } from "@/ui/visibility-picker";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

/** The same catalogue the app ships, so the copy is asserted without a copy of it. */
const app = JSON.parse(
  readFileSync(join(root, "packages/contracts/src/i18n/ru/app.json"), "utf8"),
) as {
  gift: {
    visibility: Record<GiftCard["visibility"], string>;
    visibilityPicker: { title: string; cancel: string };
  };
  giftForm: { field: { visibilityHint: Record<GiftCard["visibility"], string> } };
};

const labels = app.gift.visibility;
const picker = app.gift.visibilityPicker;

vi.mock("use-intl", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const app = JSON.parse(
    readFileSync(join(root, "packages/contracts/src/i18n/ru/app.json"), "utf8"),
  ) as Record<string, unknown>;

  function lookup(catalog: unknown, key: string, values?: Record<string, unknown>): string {
    let node = catalog;
    for (const part of key.split(".")) {
      if (typeof node !== "object" || node == null || !(part in node)) return key;
      node = (node as Record<string, unknown>)[part];
    }
    if (typeof node !== "string") return key;
    return node.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? ""));
  }

  return {
    useTranslations:
      (namespace: string) => (key: string, values?: Record<string, unknown>) =>
        lookup(
          namespace
            .split(".")
            .slice(1)
            .reduce<unknown>(
              (node, part) =>
                typeof node === "object" && node !== null
                  ? (node as Record<string, unknown>)[part]
                  : undefined,
              app,
            ),
          key,
          values,
        ),
  };
});

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

async function render({
  visible = true,
  value = "PUBLIC",
  onSelect = vi.fn(),
  onClose = vi.fn(),
  onClosed = vi.fn(),
}: {
  visible?: boolean;
  value?: GiftCard["visibility"];
  onSelect?: (visibility: GiftCard["visibility"]) => void;
  onClose?: () => void;
  onClosed?: () => void;
} = {}) {
  await act(async () => {
    host.render(
      <VisibilityPicker
        visible={visible}
        title="Наушники"
        value={value}
        onSelect={onSelect}
        onClose={onClose}
        onClosed={onClosed}
      />,
    );
  });
  await settle();
  return { onSelect, onClose, onClosed };
}

function radio(label: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[role="radio"][aria-label="${label}"]`);
}

/**
 * Story 2.3 (`DESIGN.md` -> Dialog, `EXPERIENCE.md` -> Visibility chip):
 * a centered dialog with the three visibility rows, the current one checked.
 */
describe("VisibilityPicker: заголовок и радио", () => {
  it("заголовок с названием желания и диалоговая семантика", async () => {
    await render();

    const dialog = dialogElement();
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("role")).toBe("dialog");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    // The dialog is named by its own heading, not by a copy of the title.
    const heading = document.getElementById(dialog?.getAttribute("aria-labelledby") ?? "");
    expect(heading?.textContent).toBe(picker.title.replace("{title}", "Наушники"));
  });

  it("три radio с подписями, текущее значение checked", async () => {
    await render({ value: "FRIENDS" });

    const radios = Array.from(document.querySelectorAll<HTMLElement>('[role="radio"]'));
    expect(radios).toHaveLength(VISIBILITIES.length);
    expect(radios.map((item) => item.getAttribute("aria-label"))).toEqual(
      VISIBILITIES.map((code) => labels[code]),
    );
    expect(
      radios.map((item) => [item.getAttribute("aria-label"), item.getAttribute("aria-checked")]),
    ).toEqual([
      [labels.PUBLIC, "false"],
      [labels.FRIENDS, "true"],
      [labels.SECRET, "false"],
    ]);
  });

  it("выбор другого значения зовёт onSelect(code) и не закрывает диалог", async () => {
    const { onSelect, onClose } = await render({ value: "PUBLIC" });

    await click(radio(labels.FRIENDS));

    expect(onSelect).toHaveBeenCalledWith("FRIENDS");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("выбор текущего значения только закрывает диалог", async () => {
    const { onSelect, onClose } = await render({ value: "PUBLIC" });

    await click(radio(labels.PUBLIC));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("VisibilityPicker: закрытие", () => {
  it("«Отмена» закрывает диалог", async () => {
    const { onClose } = await render();

    const cancel = controlByLabel(picker.cancel);
    expect(cancel?.textContent).toBe(picker.cancel);

    await click(cancel);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Esc просит закрыть диалог", async () => {
    const { onClose } = await render();

    await act(async () => {
      escape();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("visible=false — диалога нет", async () => {
    await render({ visible: false });

    expect(dialogElement()).toBeNull();
  });
});

/**
 * CLE-51: the scrim closes the layer with a press but is not a tab stop, and the
 * dialog opens with focus on the radio that shows the current value.
 */
describe("VisibilityPicker: фокус в диалоге", () => {
  it("после открытия фокус на выбранном варианте", async () => {
    await render({ value: "FRIENDS" });

    expect(radio(labels.FRIENDS)).not.toBeNull();
    expect(document.activeElement).toBe(radio(labels.FRIENDS));
  });

  it("нажатие на подложку закрывает диалог", async () => {
    const { onClose } = await render();

    await pressScrim("visibility-picker-scrim");

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

/**
 * CLE-51: focus goes back to the chip only once the layer has really closed, so the
 * picker reports the dismissal separately from `onClose` (which only asks the screen
 * to close it).
 */
describe("VisibilityPicker: слой закрылся", () => {
  function Harness({
    onSelect,
    onClosed,
  }: {
    onSelect: (visibility: GiftCard["visibility"]) => void;
    onClosed: () => void;
  }) {
    const [open, setOpen] = useState(true);

    function handleClose() {
      setOpen(false);
    }

    return (
      <VisibilityPicker
        visible={open}
        title="Наушники"
        value="PUBLIC"
        onSelect={onSelect}
        onClose={handleClose}
        onClosed={onClosed}
      />
    );
  }

  it("после «Отмена» сообщает onClosed, когда диалога уже нет", async () => {
    const onClosed = vi.fn();

    await act(async () => {
      host.render(<Harness onSelect={vi.fn()} onClosed={onClosed} />);
    });
    await settle();
    expect(dialogElement()).not.toBeNull();
    // Opening is not closing: the report fires only after the layer is gone.
    expect(onClosed).not.toHaveBeenCalled();

    await click(controlByLabel(picker.cancel));
    await settle(300);

    expect(dialogElement()).toBeNull();
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it("видимость не менялась — закрытие не зовёт onSelect", async () => {
    const onSelect = vi.fn();
    const onClosed = vi.fn();

    await act(async () => {
      host.render(<Harness onSelect={onSelect} onClosed={onClosed} />);
    });
    await settle();
    await click(controlByLabel(picker.cancel));
    await settle(300);

    expect(onSelect).not.toHaveBeenCalled();
    expect(onClosed).toHaveBeenCalledTimes(1);
  });
});
