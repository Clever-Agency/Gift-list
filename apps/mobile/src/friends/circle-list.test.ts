import type { CircleCard } from "@gift-list/contracts";
import { describe, expect, it } from "vitest";
import {
  appendCirclePage,
  focusNeighbour,
  isNearListEnd,
  readScrollEdge,
  removeCircleCard,
  replaceCircleCard,
} from "@/friends/circle-list";

function card(nick: string): CircleCard {
  return {
    displayName: nick,
    nick,
    relationship: "FRIENDS",
    subscribed: false,
    followsYou: false,
  };
}

describe("appendCirclePage", () => {
  it("добавляет новую страницу в порядке сервера", () => {
    const loaded = [card("a"), card("b")];

    expect(appendCirclePage(loaded, [card("c"), card("d")]).map((item) => item.nick)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("не повторяет человека, пришедшего на границе страниц", () => {
    const loaded = [card("a"), card("b")];

    expect(appendCirclePage(loaded, [card("b"), card("c")]).map((item) => item.nick)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("removeCircleCard и replaceCircleCard", () => {
  it("убирает одного человека, не трогая порядок", () => {
    expect(removeCircleCard([card("a"), card("b"), card("c")], "b").map((item) => item.nick)).toEqual([
      "a",
      "c",
    ]);
  });

  it("меняет поля одной строки", () => {
    const changed = replaceCircleCard([card("a"), card("b")], "b", (item) => ({
      ...item,
      subscribed: true,
    }));

    expect(changed[1].subscribed).toBe(true);
    expect(changed[0].subscribed).toBe(false);
  });
});

describe("focusNeighbour", () => {
  it("после исчезнувшей строки берёт следующую", () => {
    expect(focusNeighbour(["a", "b", "c"], "b")).toBe("c");
  });

  it("у последней строки — предыдущую", () => {
    expect(focusNeighbour(["a", "b"], "b")).toBe("a");
  });

  it("в опустевшем списке цели нет: экран ведёт фокус на h1", () => {
    expect(focusNeighbour(["a"], "a")).toBeNull();
  });
});

describe("readScrollEdge и isNearListEnd", () => {
  it("читает событие телефона", () => {
    const event = {
      nativeEvent: {
        contentOffset: { y: 300 },
        contentSize: { height: 1200 },
        layoutMeasurement: { height: 700 },
      },
    };

    expect(readScrollEdge(event)).toEqual({ remaining: 200 });
    expect(isNearListEnd(event)).toBe(true);
  });

  it("читает событие браузера", () => {
    const event = { target: { scrollTop: 100, scrollHeight: 900, clientHeight: 600 } };

    expect(readScrollEdge(event)).toEqual({ remaining: 200 });
    expect(isNearListEnd(event)).toBe(true);
  });

  it("200 px — ещё запас, 201 px — уже далеко от конца", () => {
    const at = { target: { scrollTop: 100, scrollHeight: 900, clientHeight: 600 } };
    const beyond = { target: { scrollTop: 100, scrollHeight: 901, clientHeight: 600 } };

    expect(isNearListEnd(at)).toBe(true);
    expect(isNearListEnd(beyond)).toBe(false);
  });

  it("короткий список целиком ближе порога", () => {
    expect(isNearListEnd({ target: { scrollTop: 0, scrollHeight: 200, clientHeight: 600 } })).toBe(
      true,
    );
  });

  it("событие без чисел не запускает подгрузку", () => {
    expect(readScrollEdge({})).toBeNull();
    expect(isNearListEnd({})).toBe(false);
  });
});
