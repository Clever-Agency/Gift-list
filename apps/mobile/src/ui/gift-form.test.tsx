// @vitest-environment happy-dom
import { CURRENCIES, VISIBILITIES } from "@gift-list/contracts";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { controlByLabel, typeInto } from "@/test/dom";
import { GiftForm } from "@/ui/gift-form";
import { formatMinorToPrice } from "@/ui/gift-price";

/** The same catalogue the app ships, so the copy is asserted without a copy of it. */
type AppCatalog = {
  giftForm: {
    field: {
      title: string;
      titlePlaceholder: string;
      description: string;
      descriptionPlaceholder: string;
      price: string;
      pricePlaceholder: string;
      priceHint: string;
      currency: string;
      link: string;
      linkPlaceholder: string;
      visibility: string;
      visibilityHint: Record<string, string>;
      visibilityLocked: string;
    };
    action: { create: string; save: string; cancel: string };
    error: {
      titleRequired: string;
      titleTooLong: string;
      descriptionTooLong: string;
      priceInvalid: string;
      linkInvalid: string;
      form: string;
    };
  };
  gift: { visibility: Record<string, string> };
};

const app = JSON.parse(
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../..",
      "packages/contracts/src/i18n/ru/app.json",
    ),
    "utf8",
  ),
) as AppCatalog;

const form = app.giftForm;
const visibilityLabel = app.gift.visibility;

/** `AccessibilityInfo` lives in the React Native mock below; the announcement is an assertion. */
const announce = vi.hoisted(() => vi.fn());

vi.mock("use-intl", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
  function read(name: string): Record<string, unknown> {
    return JSON.parse(
      readFileSync(join(root, `packages/contracts/src/i18n/ru/${name}.json`), "utf8"),
    ) as Record<string, unknown>;
  }
  const catalogs = { app: read("app"), common: read("common") };

  function lookup(catalog: unknown, key: string, values?: Record<string, unknown>): string {
    let node = catalog;
    for (const part of key.split(".")) {
      if (typeof node !== "object" || node == null || !(part in node)) return key;
      node = (node as Record<string, unknown>)[part];
    }
    if (typeof node !== "string") return key;
    return node.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? ""));
  }

  /** `app.giftForm` resolves the same way `useTranslations` prefixes a namespace. */
  function catalogFor(namespace: string): unknown {
    const [head, ...rest] = namespace.split(".");
    const base = head === "common" ? catalogs.common : catalogs.app;
    return rest.reduce<unknown>(
      (node, part) =>
        typeof node === "object" && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      base,
    );
  }

  return {
    useTranslations:
      (namespace: string) => (key: string, values?: Record<string, unknown>) =>
        lookup(catalogFor(namespace), key, values),
    useLocale: () => "ru",
  };
});
vi.mock("react-native", () => ({
  AccessibilityInfo: { announceForAccessibility: announce },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type FormProps = Omit<ComponentProps<typeof GiftForm>, "onSubmit">;

let host: Root;
let container: HTMLDivElement;

beforeEach(() => {
  announce.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  host = createRoot(container);
});

afterEach(async () => {
  await act(async () => host.unmount());
  container.remove();
});

async function mount(overrides: Partial<FormProps> = {}) {
  const onSubmit = vi.fn();
  await act(async () => {
    host.render(<GiftForm submitting={false} onSubmit={onSubmit} {...overrides} />);
  });
  return onSubmit;
}

function text(): string {
  return container.textContent ?? "";
}

function field(label: string): HTMLInputElement {
  const input = Array.from(container.querySelectorAll<HTMLInputElement>("input, textarea")).find(
    (node) => node.getAttribute("aria-label") === label,
  );
  expect(input, `поле «${label}»`).toBeDefined();
  return input as HTMLInputElement;
}

/** The field box: its label, input and the inline message under it. */
function fieldText(label: string): string {
  return field(label).parentElement?.textContent ?? "";
}

/** Controlled input: set the value past React's tracker, then let React see the `input` event. */
async function type(label: string, value: string) {
  const input = field(label);
  await typeInto(input, value);
}

function radio(label: string): HTMLElement | undefined {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="radio"]')).find(
    (node) => node.getAttribute("aria-label") === label,
  );
}

function isChecked(label: string): boolean {
  const option = radio(label);
  expect(option, `радио «${label}»`).toBeDefined();
  return option?.getAttribute("aria-checked") === "true";
}

function submitButton(label: string = form.action.save): HTMLButtonElement | undefined {
  return controlByLabel(label, container) as HTMLButtonElement | undefined;
}

function cancelButton(label: string = form.action.cancel): HTMLButtonElement | undefined {
  return controlByLabel(label, container) as HTMLButtonElement | undefined;
}

async function press(label: string) {
  const target = controlByLabel(label, container);
  expect(target, `кнопка «${label}»`).toBeDefined();
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function submit() {
  return press(form.action.save);
}

describe("GiftForm: поля", () => {
  it("подписи, плейсхолдеры и подсказки видимости — из каталога", async () => {
    await mount();

    for (const label of [
      form.field.title,
      form.field.description,
      form.field.link,
      form.field.price,
      form.field.visibility,
    ]) {
      expect(text()).toContain(label);
    }

    expect(field(form.field.title).getAttribute("placeholder")).toBe(form.field.titlePlaceholder);
    expect(field(form.field.description).getAttribute("placeholder")).toBe(
      form.field.descriptionPlaceholder,
    );
    expect(field(form.field.link).getAttribute("placeholder")).toBe(form.field.linkPlaceholder);
    expect(field(form.field.price).getAttribute("placeholder")).toBe(form.field.pricePlaceholder);

    for (const visibility of VISIBILITIES) {
      expect(radio(visibilityLabel[visibility]), visibility).toBeDefined();
      expect(text()).toContain(form.field.visibilityHint[visibility]);
    }
  });

  /** `EXPERIENCE.md` → Price field: an empty amount does not show a currency. */
  it("валюта скрыта, пока цена пуста, и по умолчанию выбран USD", async () => {
    await mount();

    expect(text()).not.toContain(form.field.currency);
    expect(radio("USD")).toBeUndefined();
    expect(radio("RUB")).toBeUndefined();

    await type(form.field.price, "250");

    expect(text()).toContain(form.field.currency);
    for (const code of CURRENCIES) expect(radio(code), code).toBeDefined();
    expect(isChecked("USD")).toBe(true);
    expect(isChecked("RUB")).toBe(false);
    expect(isChecked("EUR")).toBe(false);
    expect(fieldText(form.field.price)).toContain(form.field.priceHint);
  });

  /** ARCH-A17: a new wish is visible to everyone. */
  it("видимость по умолчанию — «всем» (PUBLIC)", async () => {
    await mount();

    expect(isChecked(visibilityLabel.PUBLIC)).toBe(true);
    expect(isChecked(visibilityLabel.FRIENDS)).toBe(false);
    expect(isChecked(visibilityLabel.SECRET)).toBe(false);
  });
});

describe("GiftForm: отправка", () => {
  it("пустая цена уходит как null: без суммы и без валюты", async () => {
    const onSubmit = await mount();

    await type(form.field.title, "  Наушники  ");
    await submit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      title: "Наушники",
      description: null,
      link: null,
      priceAmount: null,
      priceCurrency: null,
      visibility: "PUBLIC",
    });
  });

  it("цена в минорных единицах с выбранной валютой, видимость и текст — из формы", async () => {
    const onSubmit = await mount();

    await type(form.field.title, "Наушники");
    await type(form.field.description, "  Чёрные, с шумоподавлением  ");
    await type(form.field.link, "  https://example.com/wh-1000xm5  ");
    await type(form.field.price, "250,5");
    await press("RUB");
    await press(visibilityLabel.FRIENDS);
    await submit();

    expect(onSubmit).toHaveBeenCalledWith({
      title: "Наушники",
      description: "Чёрные, с шумоподавлением",
      link: "https://example.com/wh-1000xm5",
      priceAmount: 25050,
      priceCurrency: "RUB",
      visibility: "FRIENDS",
    });
  });

  it("initialValues заполняют поля, цену в минорных единицах и выбор", async () => {
    const onSubmit = await mount({
      initialValues: {
        title: "Свитер",
        description: "Синий",
        link: "https://example.com/sviter",
        priceAmount: 25050,
        priceCurrency: "RUB",
        visibility: "SECRET",
      },
    });

    expect(field(form.field.title).value).toBe("Свитер");
    expect(field(form.field.description).value).toBe("Синий");
    expect(field(form.field.link).value).toBe("https://example.com/sviter");
    expect(field(form.field.price).value).toBe(formatMinorToPrice(25050));
    expect(text()).toContain(form.field.currency);
    expect(isChecked("RUB")).toBe(true);
    expect(isChecked("USD")).toBe(false);
    expect(isChecked(visibilityLabel.SECRET)).toBe(true);
    expect(isChecked(visibilityLabel.PUBLIC)).toBe(false);

    await submit();

    expect(onSubmit).toHaveBeenCalledWith({
      title: "Свитер",
      description: "Синий",
      link: "https://example.com/sviter",
      priceAmount: 25050,
      priceCurrency: "RUB",
      visibility: "SECRET",
    });
  });

  /**
   * Story 2.3: a wish that is no longer open shows its stored visibility, but the
   * rows are disabled and the hint says why. The form still sends the stored value.
   */
  it("visibilityLocked: радио показывают текущее значение, не меняются и подсказка видна", async () => {
    const onSubmit = await mount({
      initialValues: { title: "Свитер", visibility: "SECRET" },
      visibilityLocked: true,
    });

    expect(text()).toContain(form.field.visibilityLocked);
    for (const code of VISIBILITIES) {
      const option = radio(visibilityLabel[code]);
      expect(option, visibilityLabel[code]).toBeDefined();
      expect(option?.getAttribute("aria-disabled")).toBe("true");
    }
    expect(isChecked(visibilityLabel.SECRET)).toBe(true);

    await press(visibilityLabel.PUBLIC);

    expect(isChecked(visibilityLabel.SECRET)).toBe(true);
    expect(isChecked(visibilityLabel.PUBLIC)).toBe(false);

    await submit();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: "SECRET" }),
    );
  });

  it("пустое название: ошибка под полем, отправки нет, ошибка объявлена", async () => {
    const onSubmit = await mount();

    await submit();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(fieldText(form.field.title)).toContain(form.error.titleRequired);
    expect(announce).toHaveBeenCalledWith(form.error.titleRequired);
  });

  it("неверные цена и ссылка показывают свои ошибки и не отправляют", async () => {
    const onSubmit = await mount();

    await type(form.field.title, "Свитер");
    await type(form.field.price, "12.345");
    await type(form.field.link, "example.com");
    await submit();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(fieldText(form.field.price)).toContain(form.error.priceInvalid);
    expect(fieldText(form.field.link)).toContain(form.error.linkInvalid);
  });

  it("правка поля убирает только его ошибку", async () => {
    const onSubmit = await mount();

    await type(form.field.price, "abc");
    await type(form.field.link, "nope");
    await submit();

    expect(fieldText(form.field.title)).toContain(form.error.titleRequired);
    expect(fieldText(form.field.price)).toContain(form.error.priceInvalid);
    expect(fieldText(form.field.link)).toContain(form.error.linkInvalid);

    await type(form.field.title, "Свитер");
    expect(fieldText(form.field.title)).not.toContain(form.error.titleRequired);
    expect(fieldText(form.field.price)).toContain(form.error.priceInvalid);

    await type(form.field.price, "250");
    expect(fieldText(form.field.price)).not.toContain(form.error.priceInvalid);
    expect(fieldText(form.field.link)).toContain(form.error.linkInvalid);

    await type(form.field.link, "https://example.com");
    expect(fieldText(form.field.link)).not.toContain(form.error.linkInvalid);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([
    { field: "title", label: form.field.title, message: form.error.titleRequired },
    { field: "priceAmount", label: form.field.price, message: form.error.priceInvalid },
    { field: "link", label: form.field.link, message: form.error.linkInvalid },
  ])("serverError $field показывается под своим полем", async ({ field: name, label, message }) => {
    await mount({ serverError: { field: name } });

    expect(fieldText(label)).toContain(message);
    // The message is the field's own alert, not a form-level one above the button.
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toBe(message);
    expect(alert?.parentElement).toBe(field(label).parentElement);
  });

  it("serverError с неизвестным полем — общая ошибка формы", async () => {
    await mount({ serverError: { field: "tags", message: "Что-то не так" } });

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toBe(form.error.form);
    expect(text()).not.toContain("Что-то не так");
    expect(fieldText(form.field.title)).not.toContain(form.error.titleRequired);
    expect(fieldText(form.field.price)).not.toContain(form.error.priceInvalid);
    expect(fieldText(form.field.link)).not.toContain(form.error.linkInvalid);
  });

  it("во время сохранения кнопка недоступна и форма не отправляется", async () => {
    const onSubmit = await mount({ submitting: true });

    const button = submitButton();
    expect(button).toBeDefined();
    expect(button?.getAttribute("aria-disabled")).toBe("true");

    await submit();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submitLabel заменяет подпись кнопки", async () => {
    const onSubmit = await mount({ submitLabel: form.action.create });

    const button = submitButton(form.action.create);
    expect(button?.textContent).toBe(form.action.create);
    expect(submitButton(form.action.save)).toBeUndefined();

    await type(form.field.title, "Свитер");
    await press(form.action.create);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe("GiftForm: черновик", () => {
  it("onDirtyChange: true после правки и false после возврата к исходному", async () => {
    const onDirtyChange = vi.fn();
    await mount({ initialValues: { title: "Свитер" }, onDirtyChange });

    // The opening values are not an edit: nothing is reported on mount.
    expect(onDirtyChange).not.toHaveBeenCalled();

    await type(form.field.title, "Свитер с шарфом");
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(onDirtyChange).toHaveBeenCalledTimes(1);

    await type(form.field.title, "Свитер");
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(onDirtyChange).toHaveBeenCalledTimes(2);
  });

  it("пробелы вокруг значения не делают форму грязной", async () => {
    const onDirtyChange = vi.fn();
    await mount({ initialValues: { title: "Свитер" }, onDirtyChange });

    await type(form.field.title, "  Свитер  ");
    expect(onDirtyChange).not.toHaveBeenCalled();

    await type(form.field.title, "Шарф");
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it("выбор видимости и валюты — тоже правка", async () => {
    const onDirtyChange = vi.fn();
    await mount({ initialValues: { title: "Свитер" }, onDirtyChange });

    await press(visibilityLabel.SECRET);
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    await type(form.field.price, "250");
    await press("RUB");
    // The form was already dirty: only the flip is reported, not every keystroke.
    expect(onDirtyChange).toHaveBeenCalledTimes(1);
  });
});

describe("GiftForm: отмена", () => {
  it("без onCancel кнопки отмены нет, форма как раньше", async () => {
    await mount();

    expect(cancelButton()).toBeUndefined();
    expect(text()).not.toContain(form.action.cancel);
    expect(submitButton()).toBeDefined();
  });

  it("с onCancel рядом с сохранением появляется «Отмена» и зовёт обработчик", async () => {
    const onCancel = vi.fn();
    await mount({ onCancel });

    const cancel = cancelButton();
    expect(cancel).toBeDefined();
    expect(cancel?.textContent).toBe(form.action.cancel);
    expect(submitButton()).toBeDefined();

    await press(form.action.cancel);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("cancelLabel заменяет подпись отмены", async () => {
    await mount({ onCancel: vi.fn(), cancelLabel: "Назад" });

    expect(cancelButton("Назад")).toBeDefined();
    expect(cancelButton()).toBeUndefined();
    expect(submitButton()).toBeDefined();
  });

  it("во время сохранения отмена не срабатывает", async () => {
    const onCancel = vi.fn();
    await mount({ submitting: true, onCancel });

    const cancel = cancelButton() as HTMLButtonElement | undefined;
    expect(cancel).toBeDefined();
    // The busy cancel stays in the Tab order: announced disabled, not natively disabled.
    expect(cancel?.disabled).toBe(false);
    expect(cancel?.getAttribute("aria-disabled")).toBe("true");
    expect(cancel?.tabIndex).toBe(0);
    await press(form.action.cancel);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
