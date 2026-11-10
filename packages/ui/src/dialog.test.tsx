// @vitest-environment happy-dom
import { act, createRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { restoreFocus } from "./focus";
import { settle, createMount } from "./test-utils";

const mounted = createMount();

/** «Уменьшить движение»: настоящий `prefers-reduced-motion` happy-dom не считает. */
const media = vi.hoisted(() => ({ reduce: false }));
vi.mock("./use-reduce", () => ({ useReduceMotion: () => media.reduce }));

function noop() {}

function pressEscape() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
}

function scrim(): HTMLElement | null {
  return document.querySelector("[data-testid='dialog-scrim']");
}

beforeEach(() => {
  media.reduce = false;
});

describe("Dialog", () => {
  it("закрытый диалог ничего не рисует", async () => {
    const { render } = mounted();
    await render(<Dialog open={false} title="Удалить «Плед»?" onClose={noop} />);
    await settle();

    expect(document.querySelector("[role='dialog']")).toBeNull();
  });

  it("открытый: роль dialog, имя из заголовка, описание, действия", async () => {
    const { render } = mounted();
    await render(
      <Dialog
        open
        title="Удалить «Плед»?"
        description="Желание исчезнет из вишлиста."
        onClose={noop}
        actions={<Button label="Удалить" variant="destructive" onPress={noop} />}
      />,
    );
    await settle();

    const dialog = document.querySelector("[role='dialog']") as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const name = document.getElementById(dialog.getAttribute("aria-labelledby") as string);
    expect(name?.textContent).toBe("Удалить «Плед»?");
    const description = document.getElementById(dialog.getAttribute("aria-describedby") as string);
    expect(description?.textContent).toBe("Желание исчезнет из вишлиста.");
    expect(document.querySelector("button[aria-label='Удалить']")).not.toBeNull();
  });

  it("alertdialog для деструктивного подтверждения", async () => {
    const { render } = mounted();
    await render(<Dialog open role="alertdialog" title="Удалить?" onClose={noop} />);
    await settle();

    expect(document.querySelector("[role='alertdialog']")).not.toBeNull();
  });

  it("появление и уход — fade quick 160 мс, сдвига и scale нет", async () => {
    const { render } = mounted();
    await render(<Dialog open title="Удалить?" onClose={noop} testID="dialog" />);

    const content = document.querySelector("[data-testid='dialog']") as HTMLElement;
    // Первый кадр — enter-класс Tamagui: диалог проявляется, а не появляется сразу.
    expect(content.className).toContain("t_unmounted");

    await settle();
    expect(content.style.transition).toContain("160ms");
    expect(scrim()?.style.transition).toContain("160ms");
    expect(content.style.transform).toBe("");
    expect(content.style.transition).not.toContain("translate");
  });

  it("при reduce — только fade 100 мс, без сдвига", async () => {
    media.reduce = true;
    const { render } = mounted();
    await render(<Dialog open title="Удалить?" onClose={noop} testID="dialog" />);
    await settle();

    const content = document.querySelector("[data-testid='dialog']") as HTMLElement;
    expect(content.style.transition).toContain("100ms");
    expect(scrim()?.style.transition).toContain("100ms");
    expect(content.style.transform).toBe("");
  });

  it("Esc просит закрыть слой", async () => {
    const onClose = vi.fn();
    const { render } = mounted();
    await render(<Dialog open title="Удалить?" onClose={onClose} />);
    await settle();

    await act(async () => {
      pressEscape();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("крестик закрытия просит закрыть слой", async () => {
    const onClose = vi.fn();
    const { render } = mounted();
    await render(
      <Dialog
        open
        title="Сохранить изменения?"
        onClose={onClose}
        closeAction={{ label: "Закрыть", icon: <span>x</span> }}
      />,
    );
    await settle();

    const cross = document.querySelector("[aria-label='Закрыть']") as HTMLElement;
    await act(async () => {
      cross.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("фокус при открытии уходит на заданный элемент, по умолчанию на заголовок", async () => {
    const cancel = createRef<HTMLElement>();
    const { render } = mounted();
    await render(
      <Dialog
        open
        title="Удалить?"
        onClose={noop}
        initialFocus={cancel}
        actions={<Button ref={cancel as never} label="Отмена" variant="ghost" onPress={noop} />}
      />,
    );
    await settle();

    expect(document.activeElement).toBe(cancel.current);
  });

  it("без initialFocus фокус на заголовке", async () => {
    const { render } = mounted();
    await render(<Dialog open title="Сохранить изменения?" onClose={noop} />);
    await settle();

    const dialog = document.querySelector("[role='dialog']") as HTMLElement;
    const title = document.getElementById(dialog.getAttribute("aria-labelledby") as string);
    expect(document.activeElement).toBe(title);
  });

  it("onClosed вызывается, когда слой ушёл, и фокус остаётся за экраном", async () => {
    const onClosed = vi.fn();
    const { render } = mounted();
    await render(<Dialog open title="Удалить?" onClose={noop} onClosed={onClosed} />);
    await settle();
    expect(onClosed).not.toHaveBeenCalled();

    await render(<Dialog open={false} title="Удалить?" onClose={noop} onClosed={onClosed} />);
    await settle(300);
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[role='dialog']")).toBeNull();
  });

  it("onClosed ждёт fade, а не срабатывает в начале ухода", async () => {
    const onClosed = vi.fn();
    const { render } = mounted();
    await render(<Dialog open title="Удалить?" onClose={noop} onClosed={onClosed} />);
    await settle();

    await render(<Dialog open={false} title="Удалить?" onClose={noop} onClosed={onClosed} />);
    // 60 мс — fade ещё идёт (160 мс): фокус возвращать рано, слой ещё виден.
    await settle(60);
    expect(onClosed).not.toHaveBeenCalled();

    await settle(300);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it("закрыть и сразу открыть: onClosed не уводит фокус из нового слоя", async () => {
    const onClosed = vi.fn();
    const { render } = mounted();
    await render(<Dialog open title="Удалить?" onClose={noop} onClosed={onClosed} />);
    await settle();

    // Closed and opened again within one task, before the deferred callback runs.
    await act(async () => {
      await render(<Dialog open={false} title="Удалить?" onClose={noop} onClosed={onClosed} />);
      await render(<Dialog open title="Удалить?" onClose={noop} onClosed={onClosed} />);
    });
    await settle(300);

    expect(onClosed).not.toHaveBeenCalled();
    expect(document.querySelector("[role='dialog']")).not.toBeNull();
  });
});

describe("Dialog: возврат фокуса после Esc", () => {
  it("после Esc и закрытия фокус на кнопке, открывшей слой", async () => {
    const opener = createRef<HTMLElement>();

    function Screen() {
      const [open, setOpen] = useState(false);
      function handleOpen() {
        setOpen(true);
      }
      function handleClose() {
        setOpen(false);
      }
      function handleClosed() {
        // The pattern the apps use (`apps/mobile/app/**`, `/ui-check`).
        restoreFocus(opener.current);
      }
      return (
        <>
          <Button ref={opener as never} label="Открыть" variant="primary" onPress={handleOpen} />
          <Dialog open={open} title="Диалог" onClose={handleClose} onClosed={handleClosed} />
        </>
      );
    }
    Screen.displayName = "Screen";

    const { render } = mounted();
    await render(<Screen />);
    await settle();

    const button = opener.current as HTMLElement;
    expect(button.tagName).toBe("BUTTON");
    await act(async () => {
      button.focus();
      button.click();
    });
    await settle();
    expect(document.querySelector("[role='dialog']")).not.toBeNull();
    expect(document.activeElement).not.toBe(button);

    await act(async () => {
      pressEscape();
    });
    await settle(300);

    expect(document.querySelector("[role='dialog']")).toBeNull();
    expect(document.activeElement).toBe(button);
  });
});
