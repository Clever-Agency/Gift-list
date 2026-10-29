import { describe, expect, it } from "vitest";
import { isValidNick, normalizeNick } from "./nick";

describe("normalizeNick", () => {
  it("trims and lowercases", () => {
    expect(normalizeNick("  Anna_01 ")).toBe("anna_01");
  });
});

describe("isValidNick", () => {
  it.each(["abc", "a_1", "user_name_123", "a".repeat(24)])("accepts %s", (nick) => {
    expect(isValidNick(nick)).toBe(true);
  });

  it.each(["ab", "a".repeat(25), "Anna", "ан_на", "a-b", "a b", ""])(
    "rejects %j",
    (nick) => {
      expect(isValidNick(nick)).toBe(false);
    },
  );
});
