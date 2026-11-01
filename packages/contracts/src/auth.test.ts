import { describe, expect, it } from "vitest";
import { loginBodySchema, registerBodySchema, safeNextPath } from "./auth";

describe("safeNextPath", () => {
  it("keeps a relative wishlist path and its query", () => {
    expect(safeNextPath("/wishlist/abc?confirm=1")).toBe("/wishlist/abc?confirm=1");
  });

  it("rewrites a public list link and an invite link onto app paths", () => {
    expect(safeNextPath("/l/tok_1")).toBe("/wishlist/tok_1");
    expect(safeNextPath("/i/tok_1")).toBe("/invite/tok_1");
  });

  it.each([undefined, "", "https://evil.test/l/a", "//evil.test", "/\\evil", "/l/%2e%2e", "javascript:alert(1)"])(
    "rejects %j",
    (input) => {
      expect(safeNextPath(input)).toBe("/");
    },
  );

  it("collapses traversal before rewriting", () => {
    expect(safeNextPath("/l/abc/../../admin")).toBe("/admin");
  });
});

describe("registerBodySchema", () => {
  it("normalizes email and nick", () => {
    const parsed = registerBodySchema.parse({
      email: "  A@Example.com ",
      password: "password1",
      displayName: " Анна ",
      nick: " Anna_1 ",
    });
    expect(parsed.email).toBe("a@example.com");
    expect(parsed.nick).toBe("anna_1");
    expect(parsed.displayName).toBe("Анна");
  });

  it("rejects a nick outside the pattern", () => {
    const parsed = registerBodySchema.safeParse({
      email: "a@example.com",
      password: "password1",
      displayName: "Анна",
      nick: "ан",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("loginBodySchema", () => {
  it("rejects an empty password", () => {
    expect(loginBodySchema.safeParse({ email: "a@example.com", password: "" }).success).toBe(false);
  });
});
