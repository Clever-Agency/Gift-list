// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readSubscriptionView, writeSubscriptionView } from "@/friends/subscription-view";
import {
  DEFAULT_SUBSCRIPTION_VIEW,
  isSubscriptionView,
  subscriptionViewKey,
} from "@/friends/subscription-view.types";

beforeEach(() => {
  window.localStorage.clear();
});

describe("переключатель подписок", () => {
  it("по умолчанию — «Я подписан»", () => {
    expect(DEFAULT_SUBSCRIPTION_VIEW).toBe("subscribed");
  });

  it("запоминает выбор под ником человека", async () => {
    await writeSubscriptionView("AnyA", "subscribers");

    await expect(readSubscriptionView("anya")).resolves.toBe("subscribers");
    expect(window.localStorage.getItem(subscriptionViewKey("ANYA"))).toBe("subscribers");
  });

  it("не подмешивает выбор одного человека другому", async () => {
    await writeSubscriptionView("anya", "subscribers");

    await expect(readSubscriptionView("oleg")).resolves.toBeNull();
  });

  it("неизвестное значение считается отсутствующим", async () => {
    window.localStorage.setItem(subscriptionViewKey("anya"), "friends");

    await expect(readSubscriptionView("anya")).resolves.toBeNull();
  });

  it("недоступное хранилище не ломает вкладку", async () => {
    const getItem = vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const setItem = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    await expect(readSubscriptionView("anya")).resolves.toBeNull();
    await expect(writeSubscriptionView("anya", "subscribers")).resolves.toBeUndefined();

    getItem.mockRestore();
    setItem.mockRestore();
  });

  it("знает только два значения", () => {
    expect(isSubscriptionView("subscribed")).toBe(true);
    expect(isSubscriptionView("subscribers")).toBe(true);
    expect(isSubscriptionView("friends")).toBe(false);
    expect(isSubscriptionView(null)).toBe(false);
  });
});
