import { describe, expect, it } from "vitest";
import {
  DISPLAY_NAME_MAX,
  EMAIL_MAX,
  NICK_MAX,
  NICK_MIN,
  NICK_PATTERN,
  PASSWORD_MAX,
  PASSWORD_MIN,
  loginBodySchema,
  nickUpdateBodySchema,
  passwordForgotBodySchema,
  passwordResetBodySchema,
  registerBodySchema,
  safeNextPath,
} from "./auth";

/** A syntactically valid address of exactly `length` UTF-16 units. */
function emailOfLength(length: number): string {
  const local = "a".repeat(60);
  const suffix = ".com";
  return `${local}@${"b".repeat(length - local.length - 1 - suffix.length)}${suffix}`;
}

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

describe("nickUpdateBodySchema", () => {
  it("normalizes a padded nick the same way registration does", () => {
    expect(nickUpdateBodySchema.parse({ nick: "  Anna_1 " })).toEqual({ nick: "anna_1" });
  });

  it("rejects a nick outside the pattern", () => {
    for (const nick of ["a".repeat(NICK_MIN - 1), "a".repeat(NICK_MAX + 1), "anna-1", "аня", ""]) {
      expect(nickUpdateBodySchema.safeParse({ nick }).success).toBe(false);
    }
  });

  it("rejects a body with no nick", () => {
    expect(nickUpdateBodySchema.safeParse({}).success).toBe(false);
  });

  it("accepts the shortest and the longest nick", () => {
    expect(NICK_PATTERN.test("a".repeat(NICK_MIN))).toBe(true);
    expect(NICK_PATTERN.test("a".repeat(NICK_MAX))).toBe(true);
    expect(nickUpdateBodySchema.safeParse({ nick: "a".repeat(NICK_MIN) }).success).toBe(true);
    expect(nickUpdateBodySchema.safeParse({ nick: "a".repeat(NICK_MAX) }).success).toBe(true);
  });
});

describe("loginBodySchema", () => {
  it("rejects an empty password", () => {
    expect(loginBodySchema.safeParse({ email: "a@example.com", password: "" }).success).toBe(false);
  });

  it("accepts a one-character password of a stored legacy account and rejects one over the hash cap", () => {
    expect(loginBodySchema.safeParse({ email: "a@example.com", password: "x" }).success).toBe(true);
    expect(loginBodySchema.safeParse({ email: "a@example.com", password: "x".repeat(PASSWORD_MAX) }).success).toBe(
      true,
    );
    expect(
      loginBodySchema.safeParse({ email: "a@example.com", password: "x".repeat(PASSWORD_MAX + 1) }).success,
    ).toBe(false);
  });

  it("does not cap the length of a stored address, so an older account is never locked out", () => {
    // Registration caps a new address at EMAIL_MAX; sign-in only looks one up.
    const legacy = emailOfLength(EMAIL_MAX + 40);
    const parsed = loginBodySchema.safeParse({ email: legacy, password: "password1" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe(legacy);
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
    expect(
      passwordResetBodySchema.safeParse({ token: "tok", password: "x".repeat(PASSWORD_MAX) }).success,
    ).toBe(true);
  });

  it("rejects a short or oversized password without blaming the token", () => {
    for (const password of ["x".repeat(PASSWORD_MIN - 1), "x".repeat(PASSWORD_MAX + 1)]) {
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

/**
 * The caps registration applies to a new account. The units are UTF-16 units,
 * the same as the form's `maxLength`, and the boundaries are pinned here so a
 * change of a number is a change of this test too.
 */
describe("registration caps", () => {
  function body(overrides: Partial<Record<string, string>> = {}) {
    return {
      email: "a@example.com",
      password: "password1",
      displayName: "Анна",
      nick: "anna",
      ...overrides,
    };
  }

  it("accepts an email of exactly 254 units and rejects 255", () => {
    const atCap = emailOfLength(EMAIL_MAX);
    expect(atCap).toHaveLength(EMAIL_MAX);
    const parsed = registerBodySchema.safeParse(body({ email: atCap }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe(atCap);

    const overCap = registerBodySchema.safeParse(body({ email: emailOfLength(EMAIL_MAX + 1) }));
    expect(overCap.success).toBe(false);
    if (!overCap.success) expect(overCap.error.issues[0]?.path).toEqual(["email"]);
  });

  it("trims an email before applying the cap", () => {
    const atCap = emailOfLength(EMAIL_MAX);
    expect(registerBodySchema.parse(body({ email: `  ${atCap}  ` })).email).toBe(atCap);
  });

  it("accepts a display name of 50 units and rejects 51", () => {
    expect(
      registerBodySchema.safeParse(body({ displayName: "я".repeat(DISPLAY_NAME_MAX) })).success,
    ).toBe(true);
    const overCap = registerBodySchema.safeParse(body({ displayName: "я".repeat(DISPLAY_NAME_MAX + 1) }));
    expect(overCap.success).toBe(false);
    if (!overCap.success) expect(overCap.error.issues[0]?.path).toEqual(["displayName"]);
  });

  it("counts an emoji display name as one code point, while maxLength counts two units", () => {
    const emoji = "😀";
    expect(
      registerBodySchema.safeParse(body({ displayName: emoji.repeat(DISPLAY_NAME_MAX) })).success,
    ).toBe(true);
    expect(
      registerBodySchema.safeParse(body({ displayName: emoji.repeat(DISPLAY_NAME_MAX + 1) })).success,
    ).toBe(false);
    expect(emoji.repeat(DISPLAY_NAME_MAX).length).toBe(DISPLAY_NAME_MAX * 2);
  });

  it("accepts a password of 8 to 128 code points and rejects 7 or 129", () => {
    expect(
      registerBodySchema.safeParse(body({ password: "x".repeat(PASSWORD_MIN) })).success,
    ).toBe(true);
    expect(
      registerBodySchema.safeParse(body({ password: "x".repeat(PASSWORD_MAX) })).success,
    ).toBe(true);

    for (const password of ["x".repeat(PASSWORD_MIN - 1), "x".repeat(PASSWORD_MAX + 1)]) {
      const parsed = registerBodySchema.safeParse(body({ password }));
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["password"]);
    }
  });

  it("measures the password cap in code points, a unit Better Auth's own limit does not share", () => {
    // Pinned on purpose: 128 emoji are 128 code points here and 256 UTF-16 units
    // for Better Auth, which is why this discrepancy is reported as a risk and
    // neither number was changed.
    const emojiPassword = "😀".repeat(PASSWORD_MAX);
    expect(emojiPassword.length).toBe(PASSWORD_MAX * 2);
    expect(registerBodySchema.safeParse(body({ password: emojiPassword })).success).toBe(true);
    expect(
      registerBodySchema.safeParse(body({ password: "😀".repeat(PASSWORD_MAX + 1) })).success,
    ).toBe(false);
  });

  it("accepts a nick from 3 to 24 characters", () => {
    expect(registerBodySchema.safeParse(body({ nick: "a".repeat(NICK_MIN) })).success).toBe(true);
    expect(registerBodySchema.safeParse(body({ nick: "a".repeat(NICK_MAX) })).success).toBe(true);
    expect(registerBodySchema.safeParse(body({ nick: "a".repeat(NICK_MIN - 1) })).success).toBe(false);
    expect(registerBodySchema.safeParse(body({ nick: "a".repeat(NICK_MAX + 1) })).success).toBe(false);
  });
});

describe("passwordForgotBodySchema legacy address", () => {
  it("does not cap an address that was stored before the registration cap", () => {
    const legacy = emailOfLength(EMAIL_MAX + 40);
    const parsed = passwordForgotBodySchema.safeParse({ email: legacy });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe(legacy);
  });
});

