// @vitest-environment happy-dom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReserveDateField } from "@/reserve/reserve-date-field.native";

/** `AccessibilityInfo` lives in the React Native mock below; the announcement is asserted. */
const native = vi.hoisted(() => ({ announceForAccessibility: vi.fn() }));
/** Every `hint` the date button was rendered with: the phone reads it as a hint. */
const hints = vi.hoisted(() => ({ values: [] as (string | undefined)[] }));

vi.mock("react-native", () => ({
  AccessibilityInfo: { announceForAccessibility: native.announceForAccessibility },
  Platform: { OS: "ios" },
}));

vi.mock("@react-native-community/datetimepicker", () => ({
  default: function DateTimePickerStub() {
    return null;
  },
}));

vi.mock("@gift-list/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@gift-list/ui")>();
  function ButtonWithHint(props: ComponentProps<typeof actual.Button>) {
    hints.values.push(props.hint);
    return <actual.Button {...props} />;
  }
  ButtonWithHint.displayName = "ButtonWithHint";
  return { ...actual, Button: ButtonWithHint };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  native.announceForAccessibility.mockClear();
  hints.values.length = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

type FieldProps = ComponentProps<typeof ReserveDateField>;

const baseProps: FieldProps = {
  dueOn: "2026-12-01",
  minDue: "2026-11-28",
  maxDue: "2026-12-28",
  label: "Подарю до, 01.12.2026",
  hint: "Выбрать дату",
  caption: "Не позже 28.12.2026",
  onChange: function noop() {},
};

async function mount(props: Partial<FieldProps> = {}) {
  await act(async () => {
    root.render(<ReserveDateField {...baseProps} {...props} />);
  });
}

async function update(props: Partial<FieldProps> = {}) {
  await act(async () => {
    root.render(<ReserveDateField {...baseProps} {...props} />);
  });
}

/**
 * Story 6.4: the system picker keeps the field's hint, and the error under the
 * date is spoken once — the phone has no live region around a plain caption.
 */
describe("ReserveDateField (native): подсказка и ошибка даты", () => {
  it("кнопка даты получает подсказку поля", async () => {
    await mount();

    expect(hints.values).toContain("Выбрать дату");
    const button = container.querySelector<HTMLElement>('[aria-label="Подарю до, 01.12.2026"]');
    expect(button).not.toBeNull();
  });

  it("новая ошибка объявляется один раз, повтор и очистка — нет", async () => {
    await mount({ dateError: "Выберите дату не позже 28.12.2026." });
    expect(native.announceForAccessibility).toHaveBeenCalledTimes(1);
    expect(native.announceForAccessibility).toHaveBeenCalledWith(
      "Выберите дату не позже 28.12.2026.",
    );

    await update({ dateError: "Выберите дату не позже 28.12.2026." });
    expect(native.announceForAccessibility).toHaveBeenCalledTimes(1);

    await update({ dateError: undefined });
    expect(native.announceForAccessibility).toHaveBeenCalledTimes(1);

    await update({ dateError: "Дата уже прошла." });
    expect(native.announceForAccessibility).toHaveBeenCalledTimes(2);
    expect(native.announceForAccessibility).toHaveBeenLastCalledWith("Дата уже прошла.");
  });
});
