import { describe, expect, it } from "vitest";
import { textLength } from "./text";

/**
 * The unit every text cap of the contract is measured in (Zod 4
 * `codePointLength`) and the unit of PostgreSQL `VARCHAR(n)`. The clients must
 * use this helper instead of `String#length`, which counts UTF-16 units.
 */
describe("textLength", () => {
  it("counts ASCII, Cyrillic and combining marks as their code points", () => {
    expect(textLength("")).toBe(0);
    expect(textLength("wish")).toBe(4);
    expect(textLength("желание")).toBe(7);
    // A combining mark is a code point of its own: PostgreSQL counts it too.
    expect(textLength("и\u0306")).toBe(2);
    expect(textLength("и\u0306".repeat(60))).toBe(120);
  });

  it("counts a character outside the BMP as one, where String#length counts two", () => {
    const emoji = "🎁";
    expect(emoji.length).toBe(2);
    expect(textLength(emoji)).toBe(1);
    expect(textLength(emoji.repeat(120))).toBe(120);
    expect(emoji.repeat(120).length).toBe(240);
  });

  it("counts a lone surrogate as it is stored, the same way the schema does", () => {
    expect(textLength("\ud83c")).toBe(1);
    expect(textLength("a\ud83cb")).toBe(3);
  });

  it("agrees with the code-point count Zod 4 applies to the same caps", () => {
    // `packages/contracts/src/gift.test.ts` pins the schema side; both must match.
    const text = "🎁".repeat(30);
    expect(text.length).toBe(60);
    expect(textLength(text)).toBe(30);
  });
});
