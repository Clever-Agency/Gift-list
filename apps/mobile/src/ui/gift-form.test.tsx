// @vitest-environment happy-dom
import { CURRENCIES, QUANTITIES, VISIBILITIES } from "@gift-list/contracts";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { click, controlByLabel, typeInto } from "@/test/dom";
import { GiftForm, type GiftFormValues } from "@/ui/gift-form";
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
      quantity: string;
      quantityHint: Record<string, string>;
      quantityLocked: string;
      tags: string;
      tagsLoading: string;
      tagsEmpty: string;
      tagsError: string;
      tagsRetry: string;
      tagCustom: string;
      tagCustomLive: string;
      tagCustomPlaceholder: string;
      tagAdd: string;
      tagSave: string;
      tagCancel: string;
      tagEdit: string;
      tagCounter: string;
      tagRemove: string;
    };
    action: { create: string; save: string; cancel: string };
    error: {
      titleRequired: string;
      titleTooLong: string;
      descriptionTooLong: string;
      priceInvalid: string;
      linkInvalid: string;
      quantityLocked: string;
      tags: string;
      tagEmpty: string;
      tagTooLong: string;
      tagDuplicate: string;
      tagInvalid: string;
      tagUnavailable: string;
      form: string;
    };
  };
  gift: {
    visibility: Record<string, string>;
    quantity: Record<string, string>;
  };
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
const quantityLabel = app.gift.quantity;

/** The fixed catalogue the form receives; labels stay verbatim from the server. */
const catalog = {
  status: "ready" as const,
  tags: [
    { id: "tag_dream", slug: "dream", label: "мечта" },
    { id: "tag_need", slug: "need-now", label: "нужно сейчас" },
    { id: "tag_someday", slug: "someday", label: "когда-нибудь" },
  ],
};

/** `AccessibilityInfo` lives in the React Native mock below; the announcement is an assertion. */
const announce = vi.hoisted(() => vi.fn());
/** UI5: happy-dom has no layout, so the scroll call is the observable effect. */
const scrollIntoView = vi.hoisted(() => vi.fn());

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
let onSubmitMock: (values: GiftFormValues) => void;

beforeEach(() => {
  announce.mockClear();
  scrollIntoView.mockClear();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  host = createRoot(container);
});

afterEach(async () => {
  await act(async () => host.unmount());
  container.remove();
});

async function mount(overrides: Partial<FormProps> = {}) {
  const onSubmit = vi.fn<(values: GiftFormValues) => void>();
  onSubmitMock = onSubmit;
  await act(async () => {
    host.render(<GiftForm submitting={false} onSubmit={onSubmit} {...overrides} />);
  });
  return onSubmit;
}

/** Re-renders the same mounted form, e.g. with the server error a save returned. */
async function update(overrides: Partial<FormProps> = {}) {
  await act(async () => {
    host.render(<GiftForm submitting={false} onSubmit={onSubmitMock} {...overrides} />);
  });
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

/** The custom-tag input, without the assertion of `field` (it may be closed). */
function customTagInput(): HTMLInputElement | undefined {
  return Array.from(container.querySelectorAll<HTMLInputElement>("input, textarea")).find(
    (node) => node.getAttribute("aria-label") === form.field.tagCustom,
  );
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

function checkbox(label: string): HTMLElement | undefined {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="checkbox"]')).find(
    (node) => node.getAttribute("aria-label") === label,
  );
}

function tagIsSelected(label: string): boolean {
  const chip = checkbox(label);
  expect(chip, `чип «${label}»`).toBeDefined();
  return chip?.getAttribute("aria-checked") === "true";
}

function isChecked(label: string): boolean {
  const option = radio(label);
  expect(option, `радио «${label}»`).toBeDefined();
  return option?.getAttribute("aria-checked") === "true";
}

function submitButton(label: string = form.action.save): HTMLButtonElement | undefined {
  return controlByLabel(label, container) as HTMLButtonElement | undefined;
}

function button(label: string): HTMLElement | undefined {
  return controlByLabel(label, container);
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

/** UI4: the custom-tag field is hidden until the «Свой тег» chip opens it. */
async function openCustomTag() {
  await press(form.field.tagCustom);
}

function customTagTrigger(): HTMLElement {
  const trigger = container.querySelector('[data-testid="custom-tag-trigger"]');
  expect(trigger, "чип «Свой тег»").not.toBeNull();
  return trigger as HTMLElement;
}

function editCustomTagButton(name: string): HTMLElement {
  const button = controlByLabel(form.field.tagEdit.replace("{name}", name), container);
  expect(button, `кнопка «Редактировать тег ${name}»`).toBeDefined();
  return button as HTMLElement;
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
      form.field.quantity,
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

    for (const quantity of QUANTITIES) {
      expect(radio(quantityLabel[quantity]), quantity).toBeDefined();
      expect(text()).toContain(form.field.quantityHint[quantity]);
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

  /** Story 2.5/D-25: a new wish is single unless the owner picks otherwise. */
  it("тип желания по умолчанию — «Один раз» (SINGLE)", async () => {
    await mount();

    expect(isChecked(quantityLabel.SINGLE)).toBe(true);
    expect(isChecked(quantityLabel.UNLIMITED)).toBe(false);
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
      quantity: "SINGLE",
      tags: [],
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
      quantity: "SINGLE",
      tags: [],
    });
  });

  /** Story 2.5: the chosen type is what the screen submits. */
  it("выбранный «Можно дарить снова» уходит как UNLIMITED", async () => {
    const onSubmit = await mount();

    await type(form.field.title, "Наушники");
    await press(quantityLabel.UNLIMITED);
    await submit();

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: "UNLIMITED" }),
    );
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
        quantity: "UNLIMITED",
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
    expect(isChecked(quantityLabel.UNLIMITED)).toBe(true);
    expect(isChecked(quantityLabel.SINGLE)).toBe(false);

    await submit();

    expect(onSubmit).toHaveBeenCalledWith({
      title: "Свитер",
      description: "Синий",
      link: "https://example.com/sviter",
      priceAmount: 25050,
      priceCurrency: "RUB",
      visibility: "SECRET",
      quantity: "UNLIMITED",
      tags: [],
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
    const group = container.querySelector(
      `[role="radiogroup"][aria-label="${form.field.visibility}"]`,
    );
    const described = document.getElementById(group?.getAttribute("aria-describedby") ?? "");
    expect(described?.textContent).toBe(form.field.visibilityLocked);
    expect(described?.getAttribute("role")).toBeNull();
    expect(group?.getAttribute("aria-invalid")).toBeNull();
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

  /**
   * Story 2.5: a wish that is no longer open keeps its stored type, disabled,
   * with the same kind of explanation as the frozen visibility.
   */
  it("quantityLocked: строки показывают сохранённое значение, не меняются и подсказка видна", async () => {
    const onSubmit = await mount({
      initialValues: { title: "Свитер", quantity: "UNLIMITED" },
      quantityLocked: true,
    });

    expect(text()).toContain(form.field.quantityLocked);
    const group = container.querySelector(
      `[role="radiogroup"][aria-label="${form.field.quantity}"]`,
    );
    const described = document.getElementById(group?.getAttribute("aria-describedby") ?? "");
    expect(described?.textContent).toBe(form.field.quantityLocked);
    expect(described?.getAttribute("role")).toBeNull();
    expect(group?.getAttribute("aria-invalid")).toBeNull();
    for (const quantity of QUANTITIES) {
      const option = radio(quantityLabel[quantity]);
      expect(option, quantityLabel[quantity]).toBeDefined();
      expect(option?.getAttribute("aria-disabled")).toBe("true");
    }
    expect(isChecked(quantityLabel.UNLIMITED)).toBe(true);

    await press(quantityLabel.SINGLE);

    expect(isChecked(quantityLabel.UNLIMITED)).toBe(true);
    expect(isChecked(quantityLabel.SINGLE)).toBe(false);

    await submit();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: "UNLIMITED" }),
    );
  });

  it("serverError quantity показывается под группой типа", async () => {
    await mount({ serverError: { field: "quantity" } });

    const group = container.querySelector(
      `[role="radiogroup"][aria-label="${form.field.quantity}"]`,
    );
    expect(group?.parentElement?.textContent).toContain(form.error.quantityLocked);
    expect(group?.getAttribute("aria-invalid")).toBe("true");
    const errorId = group?.getAttribute("aria-describedby");
    const error = document.getElementById(errorId ?? "");
    expect(error?.textContent).toBe(form.error.quantityLocked);
    expect(error?.getAttribute("role")).toBe("alert");
    // The inline message is the group's, not the form-level one above the button.
    expect(group?.parentElement?.textContent).not.toContain(form.error.form);
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
    await mount({ serverError: { field: "unknownField", message: "Что-то не так" } });

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

  /** Story 2.5: the type is part of the draft; returning to the stored one cleans it. */
  it("смена типа желания делает форму грязной, возврат к исходному — снова чистой", async () => {
    const onDirtyChange = vi.fn();
    await mount({
      initialValues: { title: "Свитер", quantity: "SINGLE" },
      onDirtyChange,
    });

    await press(quantityLabel.UNLIMITED);
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    await press(quantityLabel.SINGLE);
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });
});

describe("GiftForm: теги", () => {
  it("пока каталог грузится, показывает состояние и оставляет поле своего тега", async () => {
    await mount({ tagCatalog: { status: "loading" } });

    expect(text()).toContain(form.field.tags);
    expect(text()).toContain(form.field.tagsLoading);
    expect(checkbox("мечта")).toBeUndefined();
    // UI4: the «Свой тег» chip stays available; the field appears after a press.
    expect(button(form.field.tagCustom)).toBeDefined();
    expect(customTagInput()).toBeUndefined();
    await openCustomTag();
    expect(field(form.field.tagCustom)).toBeDefined();
  });

  it("ошибка каталога: повтор запроса, выбранные теги и свой тег остаются", async () => {
    const onRetry = vi.fn();
    const onSubmit = await mount({
      tagCatalog: { status: "error" },
      initialValues: {
        title: "Свитер",
        tags: [
          { catalogId: "tag_dream", label: "мечта" },
          { text: "своё" },
        ],
      },
      onRetryTagCatalog: onRetry,
    });

    expect(text()).toContain(form.field.tagsError);
    // The catalogue failed, but the stored choice is still visible and removable.
    expect(tagIsSelected("мечта")).toBe(true);
    expect(text()).toContain("своё");

    await press(form.field.tagsRetry);
    expect(onRetry).toHaveBeenCalledTimes(1);

    await submit();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: [{ catalogId: "tag_dream", label: "мечта" }, { text: "своё" }],
      }),
    );
  });

  it("пустой каталог не сбрасывает выбранное и не мешает своему тегу", async () => {
    const onSubmit = await mount({
      tagCatalog: { status: "ready", tags: [] },
      initialValues: {
        title: "Свитер",
        tags: [{ catalogId: "tag_dream", label: "мечта" }],
      },
    });

    // Selected tags are still shown; the empty notice would contradict them.
    expect(tagIsSelected("мечта")).toBe(true);

    await openCustomTag();
    await type(form.field.tagCustom, "своё");
    await press(form.field.tagAdd);
    await submit();

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: [{ catalogId: "tag_dream", label: "мечта" }, { text: "своё" }],
      }),
    );
  });

  it("пустой каталог без выбранных тегов показывает empty state и повтор", async () => {
    const onRetry = vi.fn();
    await mount({
      tagCatalog: { status: "ready", tags: [] },
      onRetryTagCatalog: onRetry,
    });

    expect(text()).toContain(form.field.tagsEmpty);
    await press(form.field.tagsRetry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("несколько фиксированных тегов выбираются и уходят с catalogId", async () => {
    const onSubmit = await mount({ tagCatalog: catalog });

    await type(form.field.title, "Свитер");
    await press("мечта");
    await press("нужно сейчас");
    expect(tagIsSelected("мечта")).toBe(true);
    expect(tagIsSelected("нужно сейчас")).toBe(true);
    expect(tagIsSelected("когда-нибудь")).toBe(false);

    await submit();

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: [
          { catalogId: "tag_dream", label: "мечта" },
          { catalogId: "tag_need", label: "нужно сейчас" },
        ],
      }),
    );
  });

  it("повторное нажатие снимает фиксированный тег", async () => {
    const onSubmit = await mount({ tagCatalog: catalog });

    await type(form.field.title, "Свитер");
    await press("мечта");
    await press("мечта");
    expect(tagIsSelected("мечта")).toBe(false);

    await submit();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ tags: [] }));
  });

  it("подпись фиксированного тега берётся из каталога, а не из старой карточки", async () => {
    const onSubmit = await mount({
      tagCatalog: catalog,
      initialValues: {
        title: "Свитер",
        tags: [{ catalogId: "tag_dream", label: "dream" }],
      },
    });

    // Same catalogId: the current server label replaces the stored one.
    expect(tagIsSelected("мечта")).toBe(true);
    expect(checkbox("dream")).toBeUndefined();

    await submit();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: [{ catalogId: "tag_dream", label: "мечта" }],
      }),
    );
  });

  it("свой тег тримится, добавляется чипом и отправляется как text", async () => {
    const onSubmit = await mount({ tagCatalog: catalog });

    await type(form.field.title, "Свитер");
    await openCustomTag();
    await type(form.field.tagCustom, "  своё  ");
    expect(fieldText(form.field.tagCustom)).toContain("из 30");
    await press(form.field.tagAdd);

    expect(field(form.field.tagCustom).value).toBe("");
    expect(text()).toContain("своё");

    await submit();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ tags: [{ text: "своё" }] }),
    );
  });

  it("дубль своего тега и текст длиннее 30 кодовых точек не добавляются", async () => {
    await mount({ tagCatalog: catalog });

    await openCustomTag();
    await type(form.field.tagCustom, "своё");
    await press(form.field.tagAdd);
    await type(form.field.tagCustom, "  своё  ");
    await press(form.field.tagAdd);
    expect(fieldText(form.field.tagCustom)).toContain(form.error.tagDuplicate);

    await type(form.field.tagCustom, "😀".repeat(31));
    await press(form.field.tagAdd);
    expect(fieldText(form.field.tagCustom)).toContain(
      form.error.tagTooLong.replace("{max}", "30"),
    );
  });

  it("NUL в своём теге отклоняется до запроса", async () => {
    await mount({ tagCatalog: catalog });

    await openCustomTag();
    await type(form.field.tagCustom, "сво\u0000ё");
    await press(form.field.tagAdd);

    expect(fieldText(form.field.tagCustom)).toContain(form.error.tagInvalid);
  });

  it("пустой «Добавить тег» недоступен, пока поле пустое", async () => {
    await mount({ tagCatalog: catalog });
    await openCustomTag();

    const add = button(form.field.tagAdd) as HTMLButtonElement | undefined;
    expect(add).toBeDefined();
    expect(add?.getAttribute("aria-disabled")).toBe("true");

    await type(form.field.tagCustom, "своё");
    expect(button(form.field.tagAdd)?.getAttribute("aria-disabled")).toBe("false");
  });

  it("UI4: «Свой тег» — первый чип полосы, со звездой, и открывает поле", async () => {
    await mount({ tagCatalog: catalog });

    const group = container.querySelector(
      `[role="group"][aria-label="${form.field.tags}"]`,
    ) as HTMLElement;
    const trigger = group.querySelector('[data-testid="custom-tag-trigger"]') as HTMLElement;
    expect(trigger).not.toBeNull();
    expect(trigger.getAttribute("aria-label")).toBe(form.field.tagCustom);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.querySelector('[data-testid="custom-tag-trigger-star"]')).not.toBeNull();

    // The trigger stands before every fixed tag.
    const firstFixed = group.querySelector('[role="checkbox"]') as HTMLElement;
    expect(
      trigger.compareDocumentPosition(firstFixed) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Empty «Свой тег»: no preview and no field until the press.
    expect(container.querySelector('[data-testid="custom-tag-preview"]')).toBeNull();
    expect(customTagInput()).toBeUndefined();

    await openCustomTag();

    expect(customTagInput()).toBeDefined();
    expect(button(form.field.tagAdd)).toBeDefined();
    const openedGroup = container.querySelector(
      `[role="group"][aria-label="${form.field.tags}"]`,
    ) as HTMLElement;
    const opened = openedGroup.querySelector('[data-testid="custom-tag-trigger"]') as HTMLElement;
    expect(opened.getAttribute("aria-expanded")).toBe("true");
    const editor = document.getElementById(opened.getAttribute("aria-controls") as string);
    expect(editor).not.toBeNull();
  });

  it("UI4: набранный текст live показывается в первом теге, отдельного превью нет", async () => {
    await mount({ tagCatalog: catalog });
    await openCustomTag();
    const trigger = customTagTrigger();
    expect(trigger.textContent).toBe(form.field.tagCustom);
    expect(trigger.getAttribute("aria-label")).toBe(form.field.tagCustom);

    await type(form.field.tagCustom, "  своё  ");

    expect(trigger.textContent).toBe("своё");
    // The draft is visible; the accessible name keeps the control's purpose.
    expect(trigger.getAttribute("aria-label")).toBe(
      form.field.tagCustomLive.replace("{text}", "своё"),
    );
    expect(container.querySelector('[data-testid="custom-tag-preview"]')).toBeNull();
    // Not committed yet: no remove control, the input keeps the raw text.
    expect(button("Убрать тег своё")).toBeUndefined();
    expect(field(form.field.tagCustom).value).toBe("  своё  ");

    await type(form.field.tagCustom, "   ");

    expect(trigger.textContent).toBe(form.field.tagCustom);
    expect(trigger.getAttribute("aria-label")).toBe(form.field.tagCustom);
  });

  it("UI4: повторное нажатие на тег закрывает поле, возвращает «Свой тег» и фокус", async () => {
    await mount({ tagCatalog: catalog });
    await openCustomTag();
    const trigger = customTagTrigger();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(customTagInput()).toBeDefined();

    await type(form.field.tagCustom, "своё");
    expect(trigger.textContent).toBe("своё");

    await click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.textContent).toBe(form.field.tagCustom);
    expect(customTagInput()).toBeUndefined();
    expect(document.activeElement).toBe(trigger);
  });

  it("UI4: Escape закрывает поле и возвращает фокус на тег", async () => {
    await mount({ tagCatalog: catalog });
    await openCustomTag();
    await type(form.field.tagCustom, "своё");

    await act(async () => {
      customTagInput()?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    const trigger = customTagTrigger();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.textContent).toBe(form.field.tagCustom);
    expect(customTagInput()).toBeUndefined();
    expect(document.activeElement).toBe(trigger);
  });

  it("UI4: «Отмена» закрывает поле без добавления тега и возвращает фокус", async () => {
    await mount({ tagCatalog: catalog });
    await openCustomTag();
    await type(form.field.tagCustom, "своё");

    await press(form.field.tagCancel);

    const trigger = customTagTrigger();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.textContent).toBe(form.field.tagCustom);
    expect(customTagInput()).toBeUndefined();
    expect(button("Убрать тег своё")).toBeUndefined();
    expect(document.activeElement).toBe(trigger);
  });

  it("UI4: добавленный свой тег редактируется в том же поле, текст меняется в теге live", async () => {
    const onSubmit = await mount({
      tagCatalog: catalog,
      initialValues: { title: "Свитер", tags: [{ text: "своё" }] },
    });

    await click(editCustomTagButton("своё"));

    expect(field(form.field.tagCustom).value).toBe("своё");
    expect(document.activeElement).toBe(field(form.field.tagCustom));
    expect(button(form.field.tagSave)).toBeDefined();
    expect(button(form.field.tagAdd)).toBeUndefined();
    expect(customTagTrigger().getAttribute("aria-expanded")).toBe("true");

    await type(form.field.tagCustom, "новое");

    const chip = container.querySelector('[data-testid="custom-tag-0"]') as HTMLElement;
    expect(chip.textContent).toContain("новое");
    expect(button("Убрать тег своё")).toBeDefined();

    await press(form.field.tagSave);

    expect(text()).toContain("новое");
    expect(text()).not.toContain("своё");
    expect(customTagInput()).toBeUndefined();

    await submit();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ tags: [{ text: "новое" }] }),
    );
  });

  it("UI4: редактирование в дубль показывает ту же ошибку и не меняет тег", async () => {
    await mount({
      tagCatalog: catalog,
      initialValues: { title: "Свитер", tags: [{ text: "своё" }, { text: "другое" }] },
    });

    await click(editCustomTagButton("другое"));
    await type(form.field.tagCustom, "своё");
    await press(form.field.tagSave);

    expect(fieldText(form.field.tagCustom)).toContain(form.error.tagDuplicate);
    expect(customTagInput()).toBeDefined();
    // The live label shows the invalid draft, but the tag set itself is unchanged.
    expect(container.querySelector('[data-testid="custom-tag-0"]')?.textContent).toContain("своё");
    expect(container.querySelector('[data-testid="custom-tag-1"]')?.textContent).toContain("своё");

    await press(form.field.tagCancel);
    expect(container.querySelector('[data-testid="custom-tag-0"]')?.textContent).toContain("своё");
    expect(container.querySelector('[data-testid="custom-tag-1"]')?.textContent).toContain("другое");
  });

  it("UI4: Escape при редактировании отменяет правку и оставляет исходный тег", async () => {
    await mount({
      tagCatalog: catalog,
      initialValues: { title: "Свитер", tags: [{ text: "своё" }] },
    });
    await click(editCustomTagButton("своё"));
    await type(form.field.tagCustom, "новое");

    await act(async () => {
      customTagInput()?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    const trigger = customTagTrigger();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector('[data-testid="custom-tag-0"]')?.textContent).toContain("своё");
    expect(text()).not.toContain("новое");
    expect(document.activeElement).toBe(trigger);
  });

  it("UI4: удаление редактируемого тега закрывает редактор и возвращает фокус", async () => {
    await mount({
      tagCatalog: catalog,
      initialValues: { title: "Свитер", tags: [{ text: "своё" }] },
    });
    await click(editCustomTagButton("своё"));

    await press("Убрать тег своё");

    const trigger = customTagTrigger();
    expect(customTagInput()).toBeUndefined();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
    expect(text()).not.toContain("своё");
  });

  it("UI4: открытие редактирования без правок не делает форму грязной", async () => {
    const onDirtyChange = vi.fn();
    await mount({
      tagCatalog: catalog,
      initialValues: { title: "Свитер", tags: [{ text: "своё" }] },
      onDirtyChange,
    });

    await click(editCustomTagButton("своё"));
    expect(onDirtyChange).not.toHaveBeenCalled();

    await type(form.field.tagCustom, "новое");
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    await press(form.field.tagCancel);
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it("UI4: добавленный свой тег идёт до фиксированных и несёт звезду", async () => {
    await mount({ tagCatalog: catalog });
    await openCustomTag();
    await type(form.field.tagCustom, "своё");
    await press(form.field.tagAdd);

    const group = container.querySelector(
      `[role="group"][aria-label="${form.field.tags}"]`,
    ) as HTMLElement;
    const custom = group.querySelector('[data-testid="custom-tag-0"]') as HTMLElement;
    const fixed = group.querySelector('[role="checkbox"][aria-label="мечта"]') as HTMLElement;

    expect(custom.textContent).toContain("своё");
    expect(custom.querySelector('[data-testid="custom-tag-0-star"]')).not.toBeNull();
    expect(
      custom.compareDocumentPosition(fixed) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("UI4: клавиатура — Enter на «Свой тег» открывает поле, Enter в поле добавляет тег", async () => {
    await mount({ tagCatalog: catalog });

    const trigger = container.querySelector('[data-testid="custom-tag-trigger"]') as HTMLElement;
    await act(async () => {
      trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(customTagInput()).toBeDefined();

    await type(form.field.tagCustom, "своё");
    await act(async () => {
      customTagInput()?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });

    expect(button("Убрать тег своё")).toBeDefined();
  });

  it("удаление тега снимает ошибку дубля: после удаления его снова можно добавить", async () => {
    await mount({ tagCatalog: catalog });

    await openCustomTag();
    await type(form.field.tagCustom, "своё");
    await press(form.field.tagAdd);
    await type(form.field.tagCustom, "своё");
    await press(form.field.tagAdd);
    expect(fieldText(form.field.tagCustom)).toContain(form.error.tagDuplicate);

    await press("Убрать тег своё");
    expect(fieldText(form.field.tagCustom)).not.toContain(form.error.tagDuplicate);

    await press(form.field.tagAdd);
    expect(fieldText(form.field.tagCustom)).not.toContain(form.error.tagDuplicate);
    expect(text()).toContain("своё");
  });

  it("30 эмодзи принимаются: длина считается кодовыми точками, как в контракте", async () => {
    const onSubmit = await mount({ tagCatalog: catalog });
    const thirty = "😀".repeat(30);

    await type(form.field.title, "Свитер");
    await openCustomTag();
    await type(form.field.tagCustom, thirty);
    await press(form.field.tagAdd);
    expect(fieldText(form.field.tagCustom)).not.toContain(form.error.tagTooLong);

    await submit();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ tags: [{ text: thirty }] }),
    );
  });

  it("крестик убирает свой тег, фиксированный снимается повторным нажатием, пустой набор уходит как []", async () => {
    const onSubmit = await mount({
      tagCatalog: catalog,
      initialValues: {
        title: "Свитер",
        tags: [
          { catalogId: "tag_dream", label: "мечта" },
          { text: "своё" },
        ],
      },
    });

    await press("Убрать тег своё");
    expect(text()).not.toContain("своё");
    await press("мечта");
    expect(tagIsSelected("мечта")).toBe(false);

    await submit();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ tags: [] }));
  });

  it("недобавленный свой тег не теряется: отправка добавляет его", async () => {
    const onSubmit = await mount({ tagCatalog: catalog });

    await type(form.field.title, "Свитер");
    await openCustomTag();
    await type(form.field.tagCustom, "  своё  ");
    await submit();

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ tags: [{ text: "своё" }] }),
    );
    expect(field(form.field.tagCustom).value).toBe("");
  });

  it("негодный недобавленный свой тег блокирует отправку и объявляется", async () => {
    const onSubmit = await mount({ tagCatalog: catalog });

    await type(form.field.title, "Свитер");
    await openCustomTag();
    await type(form.field.tagCustom, "😀".repeat(31));
    await submit();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(fieldText(form.field.tagCustom)).toContain(
      form.error.tagTooLong.replace("{max}", "30"),
    );
    expect(announce).toHaveBeenCalledWith(form.error.tagTooLong.replace("{max}", "30"));
    // UI5: the invalid custom-tag field is focused and scrolled like any other field.
    const input = customTagInput() as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    expect(scrollIntoView.mock.instances[0]).toBe(input);
  });

  it("изменение набора тегов делает форму грязной, возврат к исходному — снова чистой", async () => {
    const onDirtyChange = vi.fn();
    await mount({
      tagCatalog: catalog,
      initialValues: {
        title: "Свитер",
        tags: [{ catalogId: "tag_dream", label: "мечта" }],
      },
      onDirtyChange,
    });

    expect(onDirtyChange).not.toHaveBeenCalled();
    await press("мечта");
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await press("мечта");
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it("ошибка сервера tags.N.* показывается в блоке тегов, а не общей ошибкой формы", async () => {
    await mount({
      tagCatalog: catalog,
      serverError: { field: "tags.0.text", message: "Что-то не так" },
    });

    const alerts = Array.from(container.querySelectorAll('[role="alert"]'));
    expect(
      alerts.some(
        (node) => node.textContent === form.error.tags.replace("{max}", "30"),
      ),
    ).toBe(true);
    const group = container.querySelector('[role="group"][aria-label="Теги (необязательно)"]');
    expect(group?.getAttribute("aria-invalid")).toBe("true");
    expect(group?.getAttribute("aria-describedby")).toBe(
      alerts.find((node) => node.getAttribute("id"))?.getAttribute("id"),
    );
    expect(text()).not.toContain(form.error.form);
    expect(text()).not.toContain("Что-то не так");
  });

  it("ошибка исчезнувшего фиксированного тега говорит об этом, а не о длине", async () => {
    await mount({ serverError: { field: "tags.0.catalogId", message: "Unknown tag" } });

    const alerts = Array.from(container.querySelectorAll('[role="alert"]'));
    expect(alerts.some((node) => node.textContent === form.error.tagUnavailable)).toBe(true);
    expect(text()).not.toContain(form.error.tags.replace("{max}", "30"));
  });

  /** Q-09: the number counts the submitted body, not the order of the catalogue chips. */
  it("ошибка tags.N подсвечивает чип, стоявший на этом месте в отправке", async () => {
    const initialValues = {
      title: "Свитер",
      tags: [
        { catalogId: "tag_need", label: "нужно сейчас" },
        { catalogId: "tag_dream", label: "мечта" },
      ],
    };
    await mount({ tagCatalog: catalog, initialValues });
    await submit();

    await update({
      tagCatalog: catalog,
      initialValues,
      serverError: { field: "tags.0.catalogId", message: "Unknown tag" },
    });

    const target = checkbox("нужно сейчас");
    expect(target?.getAttribute("aria-invalid")).toBe("true");
    const described = target?.getAttribute("aria-describedby");
    expect(document.getElementById(described as string)?.textContent).toBe(
      form.error.tagUnavailable,
    );
    expect(checkbox("мечта")?.getAttribute("aria-invalid")).toBeNull();
    expect(checkbox("когда-нибудь")?.getAttribute("aria-invalid")).toBeNull();
    // The group carries the message for a stale index only; one chip is enough here.
    const group = container.querySelector('[role="group"][aria-label="Теги (необязательно)"]');
    expect(group?.getAttribute("aria-invalid")).toBeNull();
    // The selected set and its order stay exactly as submitted.
    expect(tagIsSelected("нужно сейчас")).toBe(true);
    expect(tagIsSelected("мечта")).toBe(true);
    expect(tagIsSelected("когда-нибудь")).toBe(false);
  });

  it("ошибка tags.N без суффикса находит свой тег, добавленный при отправке", async () => {
    const initialValues = {
      title: "Свитер",
      tags: [{ catalogId: "tag_dream", label: "мечта" }],
    };
    await mount({ tagCatalog: catalog, initialValues });
    await openCustomTag();
    await type(form.field.tagCustom, "своё");
    // Submitting moves the pending text into the tag set at the end.
    await submit();

    await update({
      tagCatalog: catalog,
      initialValues,
      serverError: { field: "tags.1", message: "Invalid input" },
    });

    const remove = button("Убрать тег своё");
    expect(remove?.getAttribute("aria-invalid")).toBe("true");
    expect(remove?.getAttribute("aria-describedby")).toBeTruthy();
    expect(checkbox("мечта")?.getAttribute("aria-invalid")).toBeNull();
  });

  it("снятие и повторный выбор тега не сбивают ошибку с него", async () => {
    const initialValues = {
      title: "Свитер",
      tags: [
        { catalogId: "tag_dream", label: "мечта" },
        { catalogId: "tag_need", label: "нужно сейчас" },
      ],
    };
    await mount({ tagCatalog: catalog, initialValues });
    await submit();
    await update({
      tagCatalog: catalog,
      initialValues,
      serverError: { field: "tags.0.catalogId", message: "Unknown tag" },
    });
    expect(checkbox("мечта")?.getAttribute("aria-invalid")).toBe("true");

    // Remove and re-add the first tag: the set order becomes the second, first.
    await press("мечта");
    await press("мечта");

    expect(checkbox("мечта")?.getAttribute("aria-invalid")).toBe("true");
    expect(checkbox("нужно сейчас")?.getAttribute("aria-invalid")).toBeNull();
  });

  it("удаление отвергнутого тега оставляет общую ошибку и не подсвечивает чужой чип", async () => {
    const initialValues = {
      title: "Свитер",
      tags: [
        { catalogId: "tag_dream", label: "мечта" },
        { text: "своё" },
      ],
    };
    await mount({ tagCatalog: catalog, initialValues });
    await submit();
    await update({
      tagCatalog: catalog,
      initialValues,
      serverError: { field: "tags.1.text", message: "Invalid input" },
    });
    expect(button("Убрать тег своё")?.getAttribute("aria-invalid")).toBe("true");

    await press("Убрать тег своё");

    const invalid = container.querySelectorAll('[aria-invalid="true"]');
    expect(invalid).toHaveLength(1);
    expect(invalid[0]?.getAttribute("role")).toBe("group");
    expect(text()).toContain(form.error.tags.replace("{max}", "30"));
  });

  it("номер вне отправленного набора не подсвечивает ни один чип", async () => {
    const initialValues = {
      title: "Свитер",
      tags: [{ catalogId: "tag_dream", label: "мечта" }],
    };
    await mount({ tagCatalog: catalog, initialValues });
    await submit();
    await update({
      tagCatalog: catalog,
      initialValues,
      serverError: { field: "tags.5.text", message: "Invalid input" },
    });

    expect(container.querySelectorAll('[role="checkbox"][aria-invalid="true"]')).toHaveLength(0);
    const group = container.querySelector('[role="group"][aria-label="Теги (необязательно)"]');
    expect(group?.getAttribute("aria-invalid")).toBe("true");
  });
});

describe("GiftForm: первый невалидный (UI5)", () => {
  it("submit без названия фокусирует название, прокручивает и показывает ошибку с красной рамкой", async () => {
    await mount({ tagCatalog: catalog });

    await submit();

    const title = field(form.field.title);
    expect(document.activeElement).toBe(title);
    expect(title.getAttribute("aria-invalid")).toBe("true");
    expect(fieldText(form.field.title)).toContain(form.error.titleRequired);
    expect(getComputedStyle(title).borderColor).toBe("#B42318");
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "center",
      inline: "nearest",
      behavior: "auto",
    });
    expect(scrollIntoView.mock.instances[0]).toBe(title);
  });

  it("заполненное название пропускает фокус к первой невалидной ссылке", async () => {
    await mount({ tagCatalog: catalog });
    await type(form.field.title, "Свитер");
    await type(form.field.link, "ftp://example.test/x");

    await submit();

    const link = field(form.field.link);
    expect(document.activeElement).toBe(link);
    expect(link.getAttribute("aria-invalid")).toBe("true");
    expect(fieldText(form.field.link)).toContain(form.error.linkInvalid);
    expect(scrollIntoView.mock.instances[0]).toBe(link);
  });

  it("ошибка сервера фокусирует своё поле", async () => {
    await mount({
      tagCatalog: catalog,
      serverError: { field: "title", message: "Что-то не так" },
    });

    const title = field(form.field.title);
    expect(document.activeElement).toBe(title);
    expect(scrollIntoView.mock.instances[0]).toBe(title);
  });

  it("ошибка тегов фокусирует полосу тегов", async () => {
    await mount({
      tagCatalog: catalog,
      serverError: { field: "tags", message: "Invalid input" },
    });

    const group = container.querySelector(
      `[role="group"][aria-label="${form.field.tags}"]`,
    ) as HTMLElement;
    expect(document.activeElement).toBe(group);
    expect(group.getAttribute("aria-invalid")).toBe("true");
    expect(scrollIntoView.mock.instances[0]).toBe(group);
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

  it("без onCancel нет и строки действий: форма как раньше", async () => {
    await mount();

    expect(container.querySelector('[data-testid="gift-form-actions"]')).toBeNull();
    expect(submitButton()).toBeDefined();
  });

  it("secondaryAction в одной строке с «Отмена» и «Сохранить», первым по порядку", async () => {
    await mount({
      onCancel: vi.fn(),
      secondaryAction: (
        <span role="button" aria-label="Удалить желание">
          Удалить желание
        </span>
      ),
    });

    const row = container.querySelector('[data-testid="gift-form-actions"]');
    expect(row).not.toBeNull();
    const names = Array.from(
      row?.querySelectorAll<HTMLElement>('button, [role="button"]') ?? [],
    ).map((node) => node.getAttribute("aria-label") ?? node.textContent?.trim());
    // Reading order of the row: the screen's own action, then cancel, then save.
    expect(names).toEqual(["Удалить желание", form.action.cancel, form.action.save]);
    // The cancel/save pair is one group inside the same row, not a sibling of it.
    expect(row?.lastElementChild?.querySelectorAll("button")).toHaveLength(2);
  });
});
