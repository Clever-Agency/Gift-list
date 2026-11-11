import { describe, expect, it } from "vitest";
import { AUTHOR_EMAIL, AUTHOR_MAILTO, PRODUCT_NAME, authorMailto } from "./brand";

describe("brand constants", () => {
  it("names the product WishMoon", () => {
    expect(PRODUCT_NAME).toBe("WishMoon");
  });

  it("uses the owner's public author address", () => {
    expect(AUTHOR_EMAIL).toBe("clever.web.agency@gmail.com");
  });

  it("builds the bare mailto link from the address", () => {
    expect(AUTHOR_MAILTO).toBe(`mailto:${AUTHOR_EMAIL}`);
    expect(AUTHOR_MAILTO).not.toMatch(/\s/);
  });
});

describe("authorMailto", () => {
  it("returns the bare link without a subject", () => {
    expect(authorMailto()).toBe(AUTHOR_MAILTO);
    expect(authorMailto("   ")).toBe(AUTHOR_MAILTO);
  });

  it("encodes a Cyrillic subject", () => {
    const link = authorMailto("Сброс пароля");
    expect(link).toBe(`${AUTHOR_MAILTO}?subject=%D0%A1%D0%B1%D1%80%D0%BE%D1%81%20%D0%BF%D0%B0%D1%80%D0%BE%D0%BB%D1%8F`);
    expect(link).not.toMatch(/[\u0400-\u04FF]/);
  });

  it("encodes & ? and spaces so the query cannot break", () => {
    const subject = "Вопрос & ответ?";
    const link = authorMailto(subject);
    expect(link).toBe(`${AUTHOR_MAILTO}?subject=${encodeURIComponent(subject)}`);
    expect(link).toContain("%26");
    expect(link).toContain("%3F");
    expect(link).toContain("%20");
    expect(link.split("?")).toHaveLength(2);
  });

  it("trims the ends of a subject before encoding", () => {
    expect(authorMailto("  Вопрос  ")).toBe(authorMailto("Вопрос"));
  });
});
