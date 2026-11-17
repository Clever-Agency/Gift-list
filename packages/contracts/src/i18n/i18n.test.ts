import { describe, expect, it } from "vitest";
import { PRODUCT_NAME } from "../brand";
import { ERROR_CODES, ERROR_REASONS } from "../index";
import {
  compareForSort,
  formatDate,
  formatPrice,
  getMessages,
  negotiateLocale,
  normalizeForSearch,
  preferredFromAcceptLanguage,
} from "./index";

describe("negotiateLocale", () => {
  it("returns ru for an empty list", () => {
    expect(negotiateLocale([])).toBe("ru");
  });

  it("returns ru when nothing is supported", () => {
    expect(negotiateLocale(["en-US"])).toBe("ru");
  });

  it("matches the language subtag of a regional tag", () => {
    expect(negotiateLocale(["ru-BY"])).toBe("ru");
  });

  it("negotiates ru out of an Accept-Language header that also lists English", () => {
    expect(negotiateLocale(preferredFromAcceptLanguage("en-US,ru;q=0.8"))).toBe("ru");
  });

  it("falls back when the header is only English", () => {
    expect(negotiateLocale(preferredFromAcceptLanguage("en;q=0.9"))).toBe("ru");
  });

  it("treats a missing header as no preference", () => {
    expect(preferredFromAcceptLanguage(null)).toEqual([]);
    expect(negotiateLocale(preferredFromAcceptLanguage(null))).toBe("ru");
  });
});

describe("normalizeForSearch", () => {
  it("folds ё and an NFD spelling of the same name", () => {
    expect(normalizeForSearch("Алёна")).toBe("алена");
    expect(normalizeForSearch("Алёна".normalize("NFD"))).toBe("алена");
  });

  it("keeps й", () => {
    expect(normalizeForSearch("Йога")).toBe("йога");
  });
});

describe("formatDate", () => {
  it("formats a calendar date without shifting the day", () => {
    expect(formatDate("2026-10-31", "ru")).toBe("31.10.2026");
  });

  it("formats an instant in the requested time zone", () => {
    expect(formatDate("2026-10-31T23:30:00.000Z", "ru", { timeZone: "Europe/Minsk" })).toBe(
      "01.11.2026",
    );
  });
});

describe("formatPrice", () => {
  it("formats BYN from minor units with the currency code", () => {
    expect(formatPrice(1050, "BYN", "ru")).toBe("10,50\u00a0BYN");
  });

  it("formats RUB with the ruble sign", () => {
    expect(formatPrice(250000, "RUB", "ru")).toBe("2\u00a0500,00\u00a0₽");
  });

  it("throws for a currency outside the closed set", () => {
    expect(() => formatPrice(100, "GBP", "ru")).toThrow();
  });
});

describe("compareForSort", () => {
  it("orders Алена, Алёна, then Яна", () => {
    const names = ["Яна", "Алёна", "Алена"];
    names.sort((left, right) => compareForSort("ru", left, right));
    expect(names).toEqual(["Алена", "Алёна", "Яна"]);
  });
});

describe("catalogs", () => {
  it("does not embed the product name, neither the current nor the old one", () => {
    const catalog = JSON.stringify(getMessages("ru"));
    expect(catalog.includes(PRODUCT_NAME)).toBe(false);
    expect(catalog.includes("Gift List")).toBe(false);
  });
});

describe("not-found copy", () => {
  /**
   * CLE-102: a not-found state is one and the same sentence on the web page and
   * in the app, and a sentence ends with a period (`EXPERIENCE.md` → State
   * Patterns: «Список не найден.», «Приглашение не найдено.»).
   */
  it("is the same sentence with a final period on the web and in the app", () => {
    const { web, app } = getMessages("ru");
    const pairs: ReadonlyArray<readonly [string, string]> = [
      [web.wishlist.notFound, app.myWishlist.listNotFound],
      [web.invite.notFound, app.invite.notFound],
    ];

    for (const [webText, appText] of pairs) {
      expect(webText).toBe(appText);
      expect(webText.endsWith(".")).toBe(true);
    }
  });

  /** A page title is not a sentence: it drops the final period before the brand. */
  it("keeps the document titles without the final period", () => {
    const { web } = getMessages("ru");

    expect(web.wishlist.notFoundTitle).toBe(`${web.wishlist.notFound.slice(0, -1)} — {brand}`);
    expect(web.invite.notFoundTitle).toBe(`${web.invite.notFound.slice(0, -1)} — {brand}`);
  });
});

describe("error catalog", () => {
  it("covers every error code and reason with non-empty text", () => {
    const { code, reason } = getMessages("ru").common.errors;
    expect(Object.keys(code).sort()).toEqual([...ERROR_CODES].sort());
    expect(Object.keys(reason).sort()).toEqual([...ERROR_REASONS].sort());
    for (const text of [...Object.values(code), ...Object.values(reason)]) {
      expect(text.length).toBeGreaterThan(0);
    }
  });
});
