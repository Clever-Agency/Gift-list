import { describe, expect, it } from "vitest";
import {
  loginBodySchema,
  passwordForgotBodySchema,
  passwordResetBodySchema,
  registerBodySchema,
  safeNextPath,
} from "./auth";

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

describe("passwordForgotBodySchema", () => {
  it("normalizes email", () => {
    expect(passwordForgotBodySchema.parse({ email: "  A@Example.com " }).email).toBe("a@example.com");
  });

  it("rejects an email that is not an address", () => {
    const parsed = passwordForgotBodySchema.safeParse({ email: "not-an-email" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["email"]);
  });
});

describe("passwordResetBodySchema", () => {
  it("accepts a token and a password of 8 to 128 characters", () => {
    expect(passwordResetBodySchema.parse({ token: "tok", password: "12345678" })).toEqual({
      token: "tok",
      password: "12345678",
    });
    expect(passwordResetBodySchema.safeParse({ token: "tok", password: "x".repeat(128) }).success).toBe(
      true,
    );
  });

  it("rejects a short or oversized password without blaming the token", () => {
    for (const password of ["1234567", "x".repeat(129)]) {
      const parsed = passwordResetBodySchema.safeParse({ token: "live", password });
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["password"]);
    }
  });

  it("rejects a missing or blank token before the password", () => {
    for (const body of [{ password: "password1" }, { token: "  ", password: "short" }, {}]) {
      const parsed = passwordResetBodySchema.safeParse(body);
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["token"]);
    }
  });
});
