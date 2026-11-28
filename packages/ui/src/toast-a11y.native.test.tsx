// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `DESIGN.md` → Доступность → ToastHost: all toasts are announced on a phone.
 * Vitest resolves `./toast-a11y` to the web module, so the mock swaps in the
 * `.native` variant before the component loads (as `spinner-a11y.native.test.ts`
 * does); `react-native` is mocked with the two pieces the phone half uses. This
 * is a unit check of the props and of the one-off announcement — not a
 * TalkBack/VoiceOver run on a device.
 */
const native = vi.hoisted(() => ({
  announceForAccessibility: vi.fn(),
  platform: { OS: "ios" as string },
}));

vi.mock("react-native", () => ({
  AccessibilityInfo: { announceForAccessibility: native.announceForAccessibility },
  Platform: native.platform,
}));
vi.mock("./toast-a11y", async () => await import("./toast-a11y.native"));
vi.mock("./use-reduce", () => ({ useReduceMotion: () => false }));

import { Toast } from "./toast";
import { toastA11yProps } from "./toast-a11y";
import { createMount } from "./test-utils";

const mounted = createMount();

function noop() {}

beforeEach(function resetPlatform() {
  native.platform.OS = "ios";
  native.announceForAccessibility.mockClear();
});

describe("toast-a11y (native): live-регион", () => {
  it("error и warning — assertive, info и success — polite", () => {
    expect(toastA11yProps(true)).toEqual({ accessibilityLiveRegion: "assertive" });
    expect(toastA11yProps(false)).toEqual({ accessibilityLiveRegion: "polite" });
  });

  it("на телефоне не отдаёт веб-атрибут aria-live", () => {
    expect(toastA11yProps(true)).not.toHaveProperty("aria-live");
  });
});

describe("Toast (native): iOS объявляет новый текст один раз", () => {
  it("iOS читает сообщение при появлении тоста", async () => {
    const { render } = mounted();
    await render(<Toast message="Ссылка скопирована" closeLabel="Закрыть" onClose={noop} />);

    expect(native.announceForAccessibility).toHaveBeenCalledTimes(1);
    expect(native.announceForAccessibility).toHaveBeenCalledWith("Ссылка скопирована");
  });

  it("тот же текст при повторной отрисовке не читается снова", async () => {
    const { render } = mounted();
    await render(<Toast tone="info" message="Сохранено" closeLabel="Закрыть" onClose={noop} />);
    await render(<Toast tone="info" message="Сохранено" closeLabel="Закрыть" onClose={noop} />);

    expect(native.announceForAccessibility).toHaveBeenCalledTimes(1);
  });

  it("новый текст тоста объявляется заново", async () => {
    const { render } = mounted();
    await render(<Toast tone="info" message="Сохранено" closeLabel="Закрыть" onClose={noop} />);
    await render(<Toast tone="info" message="Удалено" closeLabel="Закрыть" onClose={noop} />);

    expect(native.announceForAccessibility).toHaveBeenCalledTimes(2);
    expect(native.announceForAccessibility).toHaveBeenLastCalledWith("Удалено");
  });

  it("заголовок входит в объявление: карточка читается целиком", async () => {
    const { render } = mounted();
    await render(
      <Toast
        tone="success"
        title="Желание забронировано"
        message="Владелец не узнает, кто его выбрал."
        closeLabel="Закрыть"
        onClose={noop}
      />,
    );

    expect(native.announceForAccessibility).toHaveBeenCalledWith(
      "Желание забронировано. Владелец не узнает, кто его выбрал.",
    );
  });

  it("Android не зовёт announceForAccessibility: там говорит live-регион", async () => {
    native.platform.OS = "android";
    const { render } = mounted();
    await render(<Toast message="Сохранено" closeLabel="Закрыть" onClose={noop} />);

    expect(native.announceForAccessibility).not.toHaveBeenCalled();
  });
});
