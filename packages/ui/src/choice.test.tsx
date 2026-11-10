// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { Choice, ChoiceList } from "./choice";
import { createMount, errorMessages, nativeOnlyAttributes } from "./test-utils";

const mounted = createMount();

function noop() {}

function group(container: HTMLElement): HTMLElement {
  const node = container.querySelector('[role="radiogroup"]');
  expect(node).not.toBeNull();
  return node as HTMLElement;
}

function byId(id: string | null): HTMLElement | null {
  expect(id).toBeTruthy();
  return document.getElementById(id as string);
}

describe("ChoiceList: ошибка и описание группы", () => {
  it("ошибка связана с radiogroup, объявлена как alert и помечает группу невалидной", async () => {
    const { container, render } = mounted();
    await render(
      <ChoiceList label="Кто видит" variant="row" error="Выберите видимость">
        <Choice variant="row" label="Всем" selected={false} onPress={noop} />
      </ChoiceList>,
    );

    const radiogroup = group(container);
    expect(radiogroup.getAttribute("aria-invalid")).toBe("true");

    const errorId = radiogroup.getAttribute("aria-describedby");
    const error = byId(errorId);
    expect(error?.textContent).toBe("Выберите видимость");
    expect(error?.getAttribute("role")).toBe("alert");
    // UI5: the invalid group also has the visible red outline.
    expect(getComputedStyle(radiogroup).borderColor).toBe("#B42318");
  });

  it("без ошибки группа валидна и не ссылается на отсутствующий текст", async () => {
    const { container, render } = mounted();
    await render(
      <ChoiceList label="Кто видит" variant="row">
        <Choice variant="row" label="Всем" selected onPress={noop} />
      </ChoiceList>,
    );

    const radiogroup = group(container);
    expect(radiogroup.getAttribute("aria-invalid")).toBeNull();
    expect(radiogroup.getAttribute("aria-describedby")).toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("описание блокировки связано с группой и не объявляется как alert", async () => {
    const { container, render } = mounted();
    await render(
      <ChoiceList
        label="Сколько раз можно дарить"
        variant="row"
        description="Меняется только у открытого желания"
      >
        <Choice variant="row" label="Один раз" selected onPress={noop} disabled />
      </ChoiceList>,
    );

    const radiogroup = group(container);
    expect(radiogroup.getAttribute("aria-invalid")).toBeNull();
    const description = byId(radiogroup.getAttribute("aria-describedby"));
    expect(description?.textContent).toBe("Меняется только у открытого желания");
    expect(description?.getAttribute("role")).toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("при ошибке и описании группа ссылается на оба текста, ошибка идёт первой", async () => {
    const { container, render } = mounted();
    await render(
      <ChoiceList
        label="Кто видит"
        variant="row"
        error="Выберите видимость"
        description="Меняется только у открытого желания"
      >
        <Choice variant="row" label="Всем" selected={false} onPress={noop} />
      </ChoiceList>,
    );

    const radiogroup = group(container);
    const describedBy = radiogroup.getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(describedBy).toHaveLength(2);
    expect(byId(describedBy[0])?.textContent).toBe("Выберите видимость");
    expect(byId(describedBy[1])?.textContent).toBe("Меняется только у открытого желания");
  });

  it("у двух групп на экране разные id описаний", async () => {
    const { container, render } = mounted();
    await render(
      <>
        <ChoiceList label="Кто видит" variant="row" description="Первое описание">
          <Choice variant="row" label="Всем" selected onPress={noop} />
        </ChoiceList>
        <ChoiceList label="Сколько раз" variant="row" description="Второе описание">
          <Choice variant="row" label="Один раз" selected onPress={noop} />
        </ChoiceList>
      </>,
    );

    const [first, second] = Array.from(container.querySelectorAll('[role="radiogroup"]'));
    const firstId = first.getAttribute("aria-describedby");
    const secondId = second.getAttribute("aria-describedby");
    expect(firstId).toBeTruthy();
    expect(secondId).toBeTruthy();
    expect(firstId).not.toBe(secondId);
    expect(byId(firstId)?.textContent).toBe("Первое описание");
    expect(byId(secondId)?.textContent).toBe("Второе описание");
  });

  it("вариант chip тоже связывает описание с группой", async () => {
    const { container, render } = mounted();
    await render(
      <ChoiceList label="Валюта" variant="chip" description="Пять кодов">
        <Choice variant="chip" label="RUB" selected onPress={noop} />
      </ChoiceList>,
    );

    const radiogroup = group(container);
    expect(byId(radiogroup.getAttribute("aria-describedby"))?.textContent).toBe("Пять кодов");
  });

  it("радио сохраняет выбор и недоступность", async () => {
    const onPress = vi.fn();
    const { container, render } = mounted();
    await render(
      <ChoiceList label="Кто видит" variant="row">
        <Choice variant="row" label="Всем" selected={false} onPress={onPress} />
        <Choice variant="row" label="Друзьям" selected onPress={noop} disabled />
      </ChoiceList>,
    );

    const radios = container.querySelectorAll('[role="radio"]');
    expect(radios).toHaveLength(2);
    expect(radios[0].getAttribute("aria-checked")).toBe("false");
    expect(radios[1].getAttribute("aria-checked")).toBe("true");
    expect(radios[1].getAttribute("aria-disabled")).toBe("true");
  });
});

describe("ChoiceList: на вебе нет нативных a11y-пропсов", () => {
  it("подсказка строки связана с радио через свой aria-describedby, в DOM нет accessibility*", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(noop);
    try {
      const { container, render } = mounted();
      await render(
        <ChoiceList label="Кто видит" variant="row" description="Меняется только у открытого желания">
          <Choice variant="row" label="Всем" hint="Видно всем" selected onPress={noop} />
          <Choice variant="row" label="Друзьям" hint="Видно друзьям" selected={false} onPress={noop} />
        </ChoiceList>,
      );

      expect(nativeOnlyAttributes(container)).toEqual([]);
      expect(errorMessages(errors)).not.toContain("does not recognize");

      const [first, second] = Array.from(
        container.querySelectorAll('[role="radio"]'),
        (radio) => radio.getAttribute("aria-describedby"),
      );
      expect(first).toBeTruthy();
      expect(second).toBeTruthy();
      expect(first).not.toBe(second);
      expect(byId(first)?.textContent).toBe("Видно всем");
      expect(byId(second)?.textContent).toBe("Видно друзьям");
      // Описание группы по-прежнему одно и то же для всех радио — на группе.
      expect(byId(group(container).getAttribute("aria-describedby"))?.textContent).toBe(
        "Меняется только у открытого желания",
      );
    } finally {
      errors.mockRestore();
    }
  });

  it("чип без видимой подсказки не ставит висячий aria-describedby", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(noop);
    try {
      const { container, render } = mounted();
      await render(
        <ChoiceList label="Валюта" variant="chip" description="Пять кодов">
          <Choice variant="chip" label="RUB" selected onPress={noop} />
          <Choice variant="chip" label="USD" selected={false} onPress={noop} />
        </ChoiceList>,
      );

      expect(nativeOnlyAttributes(container)).toEqual([]);
      expect(errorMessages(errors)).not.toContain("does not recognize");
      const radios = Array.from(container.querySelectorAll('[role="radio"]'));
      expect(radios.map((radio) => radio.getAttribute("aria-describedby"))).toEqual([null, null]);
      expect(byId(group(container).getAttribute("aria-describedby"))?.textContent).toBe("Пять кодов");
    } finally {
      errors.mockRestore();
    }
  });
});
