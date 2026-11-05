import { describe, expect, it } from "vitest";
import { isGiftFormDirty, type GiftFormDirtyValues } from "@/ui/gift-form-dirty";

/** A filled edit form: the values `GiftForm` was opened with. */
const initial: GiftFormDirtyValues = {
  title: "Наушники",
  description: "Чёрные, с шумоподавлением",
  link: "https://example.com/wh-1000xm5",
  price: "250,50",
  currency: "RUB",
  visibility: "FRIENDS",
  quantity: "UNLIMITED",
};

function changed(overrides: Partial<GiftFormDirtyValues>): GiftFormDirtyValues {
  return { ...initial, ...overrides };
}

describe("isGiftFormDirty: чистая форма", () => {
  it("те же значения — не черновик", () => {
    expect(isGiftFormDirty(initial, changed({}))).toBe(false);
  });

  it("пробелы вокруг значений не считаются правкой", () => {
    expect(
      isGiftFormDirty(
        initial,
        changed({
          title: "  Наушники  ",
          description: " Чёрные, с шумоподавлением ",
          link: " https://example.com/wh-1000xm5 ",
          price: " 250,50 ",
        }),
      ),
    ).toBe(false);
  });

  it("пустое поле и одни пробелы — одно и то же", () => {
    const empty: GiftFormDirtyValues = {
      title: "",
      description: "",
      link: "",
      price: "",
      currency: "USD",
      visibility: "PUBLIC",
      quantity: "SINGLE",
    };
    expect(isGiftFormDirty(empty, changed({ ...empty, title: "   " }))).toBe(false);
  });
});

describe("isGiftFormDirty: правка любого поля", () => {
  it.each([
    { field: "title", value: "Свитер" },
    { field: "description", value: "Синий" },
    { field: "link", value: "https://example.com/sviter" },
    { field: "price", value: "300" },
    { field: "currency", value: "USD" },
    { field: "visibility", value: "PUBLIC" },
    { field: "quantity", value: "SINGLE" },
  ] as const)("поле $field делает форму грязной", ({ field, value }) => {
    const overrides: Partial<GiftFormDirtyValues> = { [field]: value };
    expect(isGiftFormDirty(initial, changed(overrides))).toBe(true);
  });

  it("очистка поля — тоже правка", () => {
    expect(isGiftFormDirty(initial, changed({ title: "" }))).toBe(true);
  });
});
