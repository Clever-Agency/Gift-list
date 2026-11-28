// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { DateField } from "./date-field";
import { createMount, declarationsFor, stateOf } from "./test-utils";

const mounted = createMount();

function noop() {}

function input(container: HTMLElement): HTMLInputElement {
  const node = container.querySelector("input");
  expect(node, "input").not.toBeNull();
  return node as HTMLInputElement;
}

describe("DateField (web): доступность", () => {
  it("связывает input с видимой подписью через htmlFor", async () => {
    const { container, render } = mounted();
    await render(<DateField label="Срок желания" value="" onChange={noop} clearLabel="Сбросить" />);

    const field = input(container);
    const label = container.querySelector("label");
    expect(label?.textContent).toBe("Срок желания");
    expect(label?.getAttribute("for")).toBe(field.id);
    expect(field.getAttribute("aria-label")).toBeNull();
  });

  it("описывает input подсказкой, а при ошибке — текстом ошибки с role=alert", async () => {
    const { container, render } = mounted();
    await render(
      <DateField
        label="Срок желания"
        value=""
        onChange={noop}
        clearLabel="Сбросить"
        hint="После этого дня желание уйдёт в архив"
      />,
    );
    const hinted = input(container);
    const hintId = hinted.getAttribute("aria-describedby");
    expect(hintId).toBeTruthy();
    expect(container.querySelector(`[id="${hintId}"]`)?.textContent).toBe(
      "После этого дня желание уйдёт в архив",
    );

    await render(
      <DateField
        label="Срок желания"
        value=""
        onChange={noop}
        clearLabel="Сбросить"
        hint="Подсказка"
        error="Дата в прошлом"
      />,
    );
    const invalid = input(container);
    expect(invalid.getAttribute("aria-invalid")).toBe("true");
    const errorNode = container.querySelector(
      `[id="${invalid.getAttribute("aria-describedby")}"]`,
    );
    expect(errorNode?.textContent).toBe("Дата в прошлом");
    expect(errorNode?.getAttribute("role")).toBe("alert");
    // The alert role is already assertive: no polite live region next to it.
    expect(errorNode?.getAttribute("aria-live")).toBeNull();

    await render(
      <DateField
        label="Срок желания"
        value=""
        onChange={noop}
        clearLabel="Сбросить"
        hint="После этого дня желание уйдёт в архив"
      />,
    );
    const hintNode = container.querySelector(
      `[id="${input(container).getAttribute("aria-describedby")}"]`,
    );
    expect(hintNode?.getAttribute("role")).toBeNull();
    expect(hintNode?.getAttribute("aria-live")).toBe("polite");
  });

  it("видимый фокус — кольцо $ring 2 px с отступом 2, как у полей", async () => {
    const { container, render } = mounted();
    await render(<DateField label="Подарю до" value="" onChange={noop} clearLabel="Убрать" />);

    const field = input(container);
    const ring = declarationsFor(field)
      .filter((one) => one.property.startsWith("outline") && stateOf(one) === "focus-visible")
      .map((one) => `${one.property}:${one.value}`)
      .sort();
    expect(ring).toEqual(
      ["outline-color:var(--ring)", "outline-style:solid", "outline-width:2px"].sort(),
    );
    expect(declarationsFor(field, "outline-offset").map((one) => one.value)).toEqual(["2px"]);
  });
});

describe("DateField (web): границы и кнопка очистки", () => {
  it("переносит min и max в поле ввода", async () => {
    const { container, render } = mounted();
    await render(
      <DateField
        label="Подарю до"
        value="2026-12-10"
        onChange={noop}
        clearLabel="Убрать дату"
        min="2026-11-26"
        max="2026-12-26"
      />,
    );

    const field = input(container);
    expect(field.getAttribute("type")).toBe("date");
    expect(field.getAttribute("min")).toBe("2026-11-26");
    expect(field.getAttribute("max")).toBe("2026-12-26");
  });

  it("clearable={false} прячет кнопку очистки у заполненного поля", async () => {
    const { container, render } = mounted();
    await render(
      <DateField
        label="Подарю до"
        value="2026-12-10"
        onChange={noop}
        clearable={false}
      />,
    );

    expect(container.querySelector('[role="button"]')).toBeNull();
  });

  it("по умолчанию кнопка очистки есть, пока выбрана дата", async () => {
    const { container, render } = mounted();
    await render(
      <DateField label="Подарю до" value="2026-12-10" onChange={noop} clearLabel="Убрать дату" />,
    );

    const clear = container.querySelector('[role="button"]');
    expect(clear?.getAttribute("aria-label")).toBe("Убрать дату");
    expect(clear?.textContent).toBe("Убрать дату");
  });
});
