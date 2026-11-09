// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

const pageScroll = vi.hoisted(() => ({
  registerPageScroll: vi.fn<(registration: unknown) => () => void>(
    () => function unregisterPageScroll() {},
  ),
}));

vi.mock("./field-scroll", () => pageScroll);

import { PageScroll, pageViewportHeight } from "./page-scroll";
import { createMount } from "./test-utils";

/**
 * A DOM test of the shared `PageScroll`, not a device run: it proves the page
 * publishes its ScrollView and viewport height to the shared scroll module.
 */
describe("PageScroll: страница для прокрутки к ошибкам", () => {
  const mounted = createMount();

  it("публикует свой ScrollView и высоту окна через общий модуль", async () => {
    const view = mounted();
    await view.render(
      <PageScroll testID="page">
        <span>content</span>
      </PageScroll>,
    );

    expect(pageScroll.registerPageScroll).toHaveBeenCalledTimes(1);
    const registration = pageScroll.registerPageScroll.mock.calls[0]?.[0] as unknown as {
      scrollView: { scrollTo?: unknown };
      viewportHeight: () => number;
    };
    expect(registration.scrollView).not.toBeNull();
    expect(typeof registration.scrollView.scrollTo).toBe("function");
    expect(registration.viewportHeight()).toBe(0);
  });

  it("снимает регистрацию при размонтировании страницы", async () => {
    const unregister = vi.fn();
    pageScroll.registerPageScroll.mockReturnValue(unregister);
    const view = mounted();
    await view.render(
      <PageScroll testID="page">
        <span>content</span>
      </PageScroll>,
    );

    await view.render(<span>next screen</span>);

    expect(unregister).toHaveBeenCalledTimes(1);
  });

  it("читает высоту окна из layout-события ScrollView", () => {
    expect(pageViewportHeight({ nativeEvent: { layout: { height: 640 } } })).toBe(640);
    expect(pageViewportHeight({ nativeEvent: { layout: { height: 0 } } })).toBe(0);
  });
});
