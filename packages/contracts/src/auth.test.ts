import { describe, expect, it } from "vitest";
import {
  DISPLAY_NAME_MAX,
  EMAIL_MAX,
  INVITE_TOKEN_MAX,
  NICK_MAX,
  NICK_MIN,
  NICK_PATTERN,
  newPasswordLengthReason,
  PASSWORD_MAX,
  PASSWORD_MIN,
  emailChangeBodySchema,
  loginBodySchema,
  nickIssue,
  nickUpdateBodySchema,
  nameUpdateBodySchema,
  hideFromSearchUpdateBodySchema,
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
      password: "password1234",
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
      password: "password1234",
      displayName: "Анна",
      nick: "ан",
    });
    expect(parsed.success).toBe(false);
  });

  it("keeps the optional invite token and checks only its length", () => {
    // AD-21: the token travels with registration but its format is the server's
    // business — a stale or foreign value must never fail the registration.
    const withToken = registerBodySchema.parse({
      email: "a@example.com",
      password: "password1234",
      displayName: "Анна",
      nick: "anna",
      inviteToken: "  tok_1  ",
    });
    expect(withToken.inviteToken).toBe("tok_1");

    const oddToken = registerBodySchema.safeParse({
      email: "a@example.com",
      password: "password1234",
      displayName: "Анна",
      nick: "anna",
      inviteToken: "../не-токен",
    });
    expect(oddToken.success).toBe(true);

    const withoutToken = registerBodySchema.parse({
      email: "a@example.com",
      password: "password1234",
      displayName: "Анна",
      nick: "anna",
    });
    expect(withoutToken).not.toHaveProperty("inviteToken");

    expect(
      registerBodySchema.safeParse({
        email: "a@example.com",
        password: "password1234",
        displayName: "Анна",
        nick: "anna",
        inviteToken: "a".repeat(INVITE_TOKEN_MAX),
      }).success,
    ).toBe(true);
    expect(
      registerBodySchema.safeParse({
        email: "a@example.com",
        password: "password1234",
        displayName: "Анна",
        nick: "anna",
        inviteToken: "a".repeat(INVITE_TOKEN_MAX + 1),
      }).success,
    ).toBe(false);
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

describe("nameUpdateBodySchema", () => {
  it("trims the name and keeps an inner space", () => {
    expect(nameUpdateBodySchema.parse({ name: "  Анна Ковалёва  " })).toEqual({
      name: "Анна Ковалёва",
    });
  });

  it("rejects an empty, blank or missing name on the name field", () => {
    for (const body of [{ name: "" }, { name: "   " }, {}]) {
      const parsed = nameUpdateBodySchema.safeParse(body);
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["name"]);
    }
  });

  it("accepts the cap in code points and rejects one more", () => {
    const atCap = nameUpdateBodySchema.safeParse({ name: "я".repeat(DISPLAY_NAME_MAX) });
    expect(atCap.success).toBe(true);

    const overCap = nameUpdateBodySchema.safeParse({ name: "я".repeat(DISPLAY_NAME_MAX + 1) });
    expect(overCap.success).toBe(false);
    if (!overCap.success) expect(overCap.error.issues[0]?.path).toEqual(["name"]);
  });
});

describe("emailChangeBodySchema", () => {
  it("trims and lower-cases the new address like registration", () => {
    expect(emailChangeBodySchema.parse({ email: "  New.Address@Example.COM " })).toEqual({
      email: "new.address@example.com",
    });
  });

  it("rejects an invalid or over-long address on the email field", () => {
    for (const email of ["", "anna", "a@", `${"a".repeat(EMAIL_MAX)}@example.com`]) {
      const parsed = emailChangeBodySchema.safeParse({ email });
      expect(parsed.success, JSON.stringify(email)).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["email"]);
    }
    expect(emailChangeBodySchema.safeParse({}).success).toBe(false);
  });

  it("accepts an address at the cap", () => {
    expect(emailChangeBodySchema.safeParse({ email: emailOfLength(EMAIL_MAX) }).success).toBe(true);
  });
});

describe("nick uniqueness (CLE-94)", () => {
  function body(nick: string) {
    return { email: "a@example.com", password: "password1234", displayName: "Анна", nick };
  }

  it("maps every case and padding variant onto one stored value", () => {
    // AD-13: uniqueness is case-insensitive, so the stored `nick` must already be
    // the canonical form — otherwise the unique index on `nickNormalized` would
    // accept "Anna" beside "anna".
    for (const nick of ["anna", "Anna", "ANNA", "  Anna\t", "\u00a0anna\u00a0"]) {
      expect(registerBodySchema.parse(body(nick)).nick, JSON.stringify(nick)).toBe("anna");
      expect(nickUpdateBodySchema.parse({ nick }).nick, JSON.stringify(nick)).toBe("anna");
    }
  });

  it("refuses look-alikes that do not fold onto the ASCII pattern", () => {
    // Full width, a Cyrillic homoglyph, a combining accent, a zero-width space
    // and mathematical bold: none of them can become a second "anna".
    const rejected = ["ａｎｎａ", "аnna", "anna\u0301", "an\u200bna", "𝐚𝐧𝐧𝐚"];
    for (const nick of rejected) {
      expect(nickUpdateBodySchema.safeParse({ nick }).success, JSON.stringify(nick)).toBe(false);
      expect(registerBodySchema.safeParse(body(nick)).success, JSON.stringify(nick)).toBe(false);
    }
  });

  it("folds a Unicode letter whose lower case is ASCII onto that ASCII nick", () => {
    // KELVIN SIGN lower-cases to "k": the value can only land on the one nick "ank".
    expect(registerBodySchema.parse(body("An\u212a")).nick).toBe("ank");
  });

  it("strips a nickNormalized the client tries to preset", () => {
    const register = registerBodySchema.parse({ ...body("anna"), nickNormalized: "free" });
    expect(register).not.toHaveProperty("nickNormalized");
    expect(nickUpdateBodySchema.parse({ nick: "anna", nickNormalized: "free" })).toEqual({
      nick: "anna",
    });
  });
});

describe("nickIssue", () => {
  it("names Cyrillic before anything else, mixed with Latin too", () => {
    expect(nickIssue("аня")).toEqual({ code: "cyrillic" });
    expect(nickIssue("anna_аня")).toEqual({ code: "cyrillic" });
    expect(nickIssue("ан на")).toEqual({ code: "cyrillic" });
  });

  it("names a space anywhere, including both edges", () => {
    for (const value of ["an na", " anna", "anna "]) {
      expect(nickIssue(value)).toEqual({ code: "space" });
    }
  });

  it.each(["-", ".", "@"])("names the first forbidden character: %s", (char) => {
    expect(nickIssue(`an${char}na`)).toEqual({ code: "char", char });
  });

  it("keeps a whole emoji, not half of a surrogate pair", () => {
    expect(nickIssue("anna😀")).toEqual({ code: "char", char: "😀" });
  });

  it("takes upper-case Latin as valid", () => {
    expect(nickIssue("Anna_1")).toBeNull();
  });

  it("checks the length after the characters", () => {
    expect(nickIssue("a".repeat(NICK_MIN - 1))).toEqual({ code: "short" });
    expect(nickIssue("a".repeat(NICK_MIN))).toBeNull();
    expect(nickIssue("a".repeat(NICK_MAX))).toBeNull();
    expect(nickIssue("a".repeat(NICK_MAX + 1))).toEqual({ code: "long" });
  });

  it("calls an empty value short and a Cyrillic pair Cyrillic, not short", () => {
    expect(nickIssue("")).toEqual({ code: "short" });
    expect(nickIssue("ан")).toEqual({ code: "cyrillic" });
  });
});

describe("hideFromSearchUpdateBodySchema", () => {
  it("accepts both switch states", () => {
    expect(hideFromSearchUpdateBodySchema.parse({ hideFromSearch: true })).toEqual({
      hideFromSearch: true,
    });
    expect(hideFromSearchUpdateBodySchema.parse({ hideFromSearch: false })).toEqual({
      hideFromSearch: false,
    });
  });

  it("rejects a missing flag, a non-boolean flag and extra keys", () => {
    expect(hideFromSearchUpdateBodySchema.safeParse({}).success).toBe(false);
    expect(hideFromSearchUpdateBodySchema.safeParse({ hideFromSearch: "true" }).success).toBe(false);
    expect(hideFromSearchUpdateBodySchema.safeParse({ hideFromSearch: 1 }).success).toBe(false);
    expect(
      hideFromSearchUpdateBodySchema.safeParse({ hideFromSearch: true, nick: "anna" }).success,
    ).toBe(false);
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

  it("measures the password cap in UTF-16 units, like Better Auth at sign-in", () => {
    expect(
      loginBodySchema.safeParse({ email: "a@example.com", password: "😀".repeat(PASSWORD_MAX / 2) }).success,
    ).toBe(true);
    expect(
      loginBodySchema.safeParse({ email: "a@example.com", password: "😀".repeat(PASSWORD_MAX / 2 + 1) }).success,
    ).toBe(false);
  });

  it("does not cap the length of a stored address, so an older account is never locked out", () => {
    // Registration caps a new address at EMAIL_MAX; sign-in only looks one up.
    const legacy = emailOfLength(EMAIL_MAX + 40);
    const parsed = loginBodySchema.safeParse({ email: legacy, password: "password1234" });
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

describe("newPasswordLengthReason", () => {
  it("classifies short, long and acceptable lengths in UTF-16 units", () => {
    expect(newPasswordLengthReason("x".repeat(PASSWORD_MIN - 1))).toBe("PASSWORD_TOO_SHORT");
    expect(newPasswordLengthReason("x".repeat(PASSWORD_MIN))).toBe(null);
    expect(newPasswordLengthReason("x".repeat(PASSWORD_MAX))).toBe(null);
    expect(newPasswordLengthReason("x".repeat(PASSWORD_MAX + 1))).toBe("PASSWORD_TOO_LONG");
    expect(newPasswordLengthReason("😀".repeat(64))).toBe(null);
    expect(newPasswordLengthReason("😀".repeat(65))).toBe("PASSWORD_TOO_LONG");
  });
});

describe("passwordResetBodySchema", () => {
  it("accepts a token and a password of 12 to 128 characters", () => {
    expect(passwordResetBodySchema.parse({ token: "tok", password: "password1234" })).toEqual({
      token: "tok",
      password: "password1234",
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

  it("measures the reset password cap in UTF-16 units, like Better Auth", () => {
    expect(
      passwordResetBodySchema.safeParse({ token: "tok", password: "😀".repeat(PASSWORD_MAX / 2) }).success,
    ).toBe(true);

    const overCap = passwordResetBodySchema.safeParse({
      token: "tok",
      password: "😀".repeat(PASSWORD_MAX / 2 + 1),
    });
    expect(overCap.success).toBe(false);
    if (!overCap.success) expect(overCap.error.issues[0]?.path).toEqual(["password"]);
  });

  it("rejects a missing or blank token before the password", () => {
    for (const body of [{ password: "password1234" }, { token: "  ", password: "short" }, {}]) {
      const parsed = passwordResetBodySchema.safeParse(body);
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["token"]);
    }
  });
});

/**
 * The caps registration applies to a new account. Boundaries are pinned here so
 * a change of a number is a change of this test too. Each test names its unit:
 * Zod 4 counts code points for the text fields, while a password is measured in
 * UTF-16 units — the unit Better Auth uses.
 */
describe("registration caps", () => {
  function body(overrides: Partial<Record<string, string>> = {}) {
    return {
      email: "a@example.com",
      password: "password1234",
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

  it("counts an emoji display name as one code point, as the clients' textLength does", () => {
    const emoji = "😀";
    expect(
      registerBodySchema.safeParse(body({ displayName: emoji.repeat(DISPLAY_NAME_MAX) })).success,
    ).toBe(true);
    expect(
      registerBodySchema.safeParse(body({ displayName: emoji.repeat(DISPLAY_NAME_MAX + 1) })).success,
    ).toBe(false);
    expect(emoji.repeat(DISPLAY_NAME_MAX).length).toBe(DISPLAY_NAME_MAX * 2);
  });

  it("accepts a password of 8 to 128 UTF-16 units and rejects 7 or 129", () => {
    for (const length of [PASSWORD_MIN, 127, PASSWORD_MAX]) {
      expect(registerBodySchema.safeParse(body({ password: "x".repeat(length) })).success).toBe(true);
    }

    for (const password of ["x".repeat(PASSWORD_MIN - 1), "x".repeat(PASSWORD_MAX + 1)]) {
      const parsed = registerBodySchema.safeParse(body({ password }));
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(["password"]);
    }
  });

  it("measures the password cap in UTF-16 units, the unit Better Auth checks", () => {
    const emoji = "😀";
    // 64 emoji are 64 code points and 128 units: at the cap. 65 are 130 units.
    expect(emoji.repeat(PASSWORD_MAX / 2)).toHaveLength(PASSWORD_MAX);
    expect(
      registerBodySchema.safeParse(body({ password: emoji.repeat(PASSWORD_MAX / 2) })).success,
    ).toBe(true);
    const overEmoji = registerBodySchema.safeParse(
      body({ password: emoji.repeat(PASSWORD_MAX / 2 + 1) }),
    );
    expect(overEmoji.success).toBe(false);
    if (!overEmoji.success) expect(overEmoji.error.issues[0]?.path).toEqual(["password"]);

    // "и" + U+0306 is a combining mark: two code points, two units.
    const combining = "и\u0306";
    expect(combining).toHaveLength(2);
    expect(
      registerBodySchema.safeParse({ ...body(), password: combining.repeat(PASSWORD_MAX / 2) }).success,
    ).toBe(true);
    expect(
      registerBodySchema.safeParse({ ...body(), password: combining.repeat(PASSWORD_MAX / 2 + 1) }).success,
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

