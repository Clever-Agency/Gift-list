import { afterEach, describe, expect, it, vi } from "vitest";
import { registerPageScroll, scrollFieldIntoView } from "./field-scroll.native";

const INNER_VIEW = {};

const releases: Array<() => void> = [];

afterEach(function releasePages() {
  while (releases.length > 0) releases.pop()?.();
  vi.useRealTimers();
});

function register(options: { viewport?: number; inner?: object | null } = {}) {
  const scrollTo = vi.fn();
  const getInnerViewRef = vi.fn(function readInnerView() {
    return options.inner === undefined ? INNER_VIEW : options.inner;
  });
  const release = registerPageScroll({
    scrollView: { scrollTo, getInnerViewRef },
    viewportHeight: function readViewportHeight() {
      return options.viewport ?? 800;
    },
  });
  releases.push(release);
  return { scrollTo, getInnerViewRef, release };
}

function measurable(y: number, height: number) {
  return {
    measureLayout: vi.fn(function measure(
      _relative: object,
      onSuccess: (x: number, y: number, width: number, height: number) => void,
    ) {
      onSuccess(0, y, 320, height);
    }),
  };
}

describe("scrollFieldIntoView (native): прокрутка к полю", () => {
  it("центрирует поле в окне и прокручивает без анимации, затем продолжает", () => {
    const { scrollTo } = register({ viewport: 800 });
    const calls: string[] = [];
    scrollTo.mockImplementation(function recordScroll() {
      calls.push("scroll");
    });
    const onDone = vi.fn(function continueToFocus() {
      calls.push("focus");
    });

    scrollFieldIntoView(measurable(600, 48), onDone);

    expect(scrollTo).toHaveBeenCalledWith({ y: 224, animated: false });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["scroll", "focus"]);
  });

  it("поле у начала страницы не уводит прокрутку в минус", () => {
    const { scrollTo } = register({ viewport: 800 });

    scrollFieldIntoView(measurable(20, 48), vi.fn());

    expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
  });

  it("поле выше окна по высоте ставится у верхнего края", () => {
    const { scrollTo } = register({ viewport: 800 });

    scrollFieldIntoView(measurable(600, 900), vi.fn());

    expect(scrollTo).toHaveBeenCalledWith({ y: 600, animated: false });
  });

  it("до первого layout окно нулевое: поле всё равно прокручивается к верху", () => {
    const { scrollTo } = register({ viewport: 0 });

    scrollFieldIntoView(measurable(600, 48), vi.fn());

    expect(scrollTo).toHaveBeenCalledWith({ y: 600, animated: false });
  });

  it("без зарегистрированной страницы сразу продолжает", () => {
    const node = measurable(600, 48);
    const onDone = vi.fn();

    scrollFieldIntoView(node, onDone);

    expect(node.measureLayout).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("ошибка измерения не теряет фокус и не прокручивает", () => {
    const { scrollTo } = register({ viewport: 800 });
    const onDone = vi.fn();
    const node = {
      measureLayout: vi.fn(function fail(
        _relative: object,
        _onSuccess: () => void,
        onFail?: () => void,
      ) {
        onFail?.();
      }),
    };

    scrollFieldIntoView(node, onDone);

    expect(scrollTo).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("без внутреннего контейнера страницы сразу продолжает", () => {
    const { scrollTo, getInnerViewRef } = register({ inner: null });
    const node = measurable(600, 48);
    const onDone = vi.fn();

    scrollFieldIntoView(node, onDone);

    expect(getInnerViewRef).toHaveBeenCalledTimes(1);
    expect(node.measureLayout).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("узел без measureLayout получает фокус без прокрутки", () => {
    const { scrollTo } = register({ viewport: 800 });
    const onDone = vi.fn();

    scrollFieldIntoView({}, onDone);

    expect(scrollTo).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("после размонтирования страницы прокрутки нет, фокус остаётся", () => {
    const { scrollTo, release } = register({ viewport: 800 });
    release();
    const onDone = vi.fn();

    scrollFieldIntoView(measurable(600, 48), onDone);

    expect(scrollTo).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("верхняя страница прокручивает, а после её закрытия снова работает нижняя", () => {
    const first = register({ viewport: 800 });
    const second = register({ viewport: 800 });

    scrollFieldIntoView(measurable(600, 48), vi.fn());
    expect(second.scrollTo).toHaveBeenCalledTimes(1);
    expect(first.scrollTo).not.toHaveBeenCalled();

    second.release();

    scrollFieldIntoView(measurable(600, 48), vi.fn());
    expect(first.scrollTo).toHaveBeenCalledTimes(1);
  });

  it("снятие одной страницы не снимает чужую регистрацию", () => {
    const first = register({ viewport: 800 });
    const second = register({ viewport: 800 });

    first.release();
    scrollFieldIntoView(measurable(600, 48), vi.fn());

    expect(second.scrollTo).toHaveBeenCalledTimes(1);
  });

  it("если измерение не отвечает, фокус всё равно возвращается по таймауту", () => {
    vi.useFakeTimers();
    register({ viewport: 800 });
    const onDone = vi.fn();
    const node = { measureLayout: vi.fn() };

    scrollFieldIntoView(node, onDone);
    expect(onDone).not.toHaveBeenCalled();

    vi.advanceTimersByTime(250);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
