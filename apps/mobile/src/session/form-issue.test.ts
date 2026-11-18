import { describe, expect, it } from "vitest";
import {
  confirmPasswordText,
  formIssue,
  issueFromError,
  loginPasswordFieldIssue,
  mutationErrorMessage,
  nickErrorText,
  passwordFieldIssue,
} from "./form-issue";

function t(key: string) {
  return key;
}
function common(key: string, values?: Record<string, string | number>) {
  return values ? `common:${key}:${values.unit}:${values.count}` : `common:${key}`;
}

describe("issueFromError", () => {
  it("keeps RESET_LINK_STALE so the reset screen can offer a new letter", () => {
    expect(
      issueFromError(
        { ok: false, code: "VALIDATION", message: "Reset link is stale", reason: "RESET_LINK_STALE" },
        t,
        common,
        "reset",
      ),
    ).toEqual({
      reason: "RESET_LINK_STALE",
      text: "common:errors.reason.RESET_LINK_STALE",
    });
  });

  it("keeps PAYLOAD_TOO_LARGE so the form says the request was too large", () => {
    expect(
      issueFromError(
        {
          ok: false,
          code: "VALIDATION",
          message: "Payload too large",
          reason: "PAYLOAD_TOO_LARGE",
        },
        t,
        common,
        "register",
      ),
    ).toEqual({
      reason: "PAYLOAD_TOO_LARGE",
      text: "common:errors.reason.PAYLOAD_TOO_LARGE",
    });
  });

  it("passes the remaining window to the rate-limit copy", () => {
    expect(
      issueFromError(
        {
          ok: false,
          code: "RATE_LIMITED",
          message: "Too many password reset attempts",
          params: { unit: "minute", count: 3 },
        },
        t,
        common,
        "forgot",
      ).text,
    ).toBe("common:errors.code.RATE_LIMITED:minute:3");
  });

  it("keeps the generic rate-limit copy when the wait is missing", () => {
    expect(
      issueFromError(
        { ok: false, code: "RATE_LIMITED", message: "Too many registration attempts" },
        t,
        common,
        "register",
      ).text,
    ).toBe("common:errors.code.RATE_LIMITED:other:undefined");
  });
});

function fake(key: string) {
  return key;
}
function err(extra: Record<string, unknown>) {
  return { ok: false, message: "", ...extra } as never;
}

describe("formIssue", () => {
  it("network", () => {
    expect(formIssue({ ok: false, network: true }, fake, fake, "login")).toEqual({
      text: "form.network",
    });
  });

  it("login UNAUTHENTICATED", () => {
    expect(formIssue(err({ code: "UNAUTHENTICATED" }), fake, fake, "login").text).toBe(
      "login.invalid",
    );
  });

  it("EMAIL_TAKEN uses reason text and field", () => {
    expect(
      formIssue(
        err({ code: "CONFLICT", reason: "EMAIL_TAKEN", field: "email" }),
        fake,
        fake,
        "register",
      ),
    ).toEqual({ field: "email", reason: "EMAIL_TAKEN", text: "errors.reason.EMAIL_TAKEN" });
  });

  it("VALIDATION on nick is not the rule list; the screen names the reason of the value", () => {
    expect(formIssue(err({ code: "VALIDATION", field: "nick" }), fake, fake, "register")).toEqual({
      field: "nick",
      text: "errors.code.VALIDATION",
    });
  });

  it("VALIDATION on password stays on the code text until the screen knows the length", () => {
    expect(formIssue(err({ code: "VALIDATION", field: "password" }), fake, fake, "register")).toEqual({
      field: "password",
      text: "errors.code.VALIDATION",
    });
  });

  it("PASSWORD_PWNED keeps the breach sentence on the password field", () => {
    expect(
      formIssue(
        err({ code: "VALIDATION", field: "password", reason: "PASSWORD_PWNED" }),
        fake,
        fake,
        "register",
      ),
    ).toEqual({ field: "password", reason: "PASSWORD_PWNED", text: "errors.reason.PASSWORD_PWNED" });
  });

  it("passwordFieldIssue states the rule on both bounds and the generic text between them", () => {
    expect(passwordFieldIssue("1234567", fake, fake)).toEqual({
      field: "password",
      reason: "PASSWORD_TOO_SHORT",
      text: "form.passwordRules",
    });
    expect(passwordFieldIssue("12345678901", fake, fake).reason).toBe("PASSWORD_TOO_SHORT");
    expect(passwordFieldIssue("123456789012", fake, fake).text).toBe("errors.code.VALIDATION");
    expect(passwordFieldIssue("password1234", fake, fake).text).toBe("errors.code.VALIDATION");
    expect(passwordFieldIssue("x".repeat(127), fake, fake).text).toBe("errors.code.VALIDATION");
    expect(passwordFieldIssue("x".repeat(128), fake, fake).text).toBe("errors.code.VALIDATION");
    expect(passwordFieldIssue("x".repeat(129), fake, fake)).toEqual({
      field: "password",
      reason: "PASSWORD_TOO_LONG",
      text: "form.passwordTooLong",
    });
  });

  it("passwordFieldIssue counts UTF-16 units, as the contract and Better Auth do", () => {
    // 64 emoji are 128 UTF-16 units: inside the cap.
    expect(passwordFieldIssue("🎁".repeat(64), fake, fake).text).toBe("errors.code.VALIDATION");
    // 65 emoji are 130 units: over it, while both are 65 code points.
    expect(passwordFieldIssue("🎁".repeat(65), fake, fake)).toEqual({
      field: "password",
      reason: "PASSWORD_TOO_LONG",
      text: "form.passwordTooLong",
    });
    expect("🎁".repeat(65).length).toBe(130);
  });

  it("passwordFieldIssue measures the value as typed: no trim, no normalisation", () => {
    // Twelve UTF-16 units inside the padding pass the minimum.
    expect(passwordFieldIssue("  password12  ", fake, fake).text).toBe("errors.code.VALIDATION");
    expect(passwordFieldIssue("  1234   ", fake, fake).reason).toBe("PASSWORD_TOO_SHORT");
    expect(passwordFieldIssue(" ".repeat(11), fake, fake).reason).toBe("PASSWORD_TOO_SHORT");
    expect(passwordFieldIssue(" ".repeat(12), fake, fake).text).toBe("errors.code.VALIDATION");
    expect(passwordFieldIssue(`  ${"x".repeat(127)}  `, fake, fake).text).toBe(
      "form.passwordTooLong",
    );
  });

  it("loginPasswordFieldIssue keeps the minimum out of sign-in and names only the cap", () => {
    expect(loginPasswordFieldIssue("", fake, fake).text).toBe("errors.code.VALIDATION");
    expect(loginPasswordFieldIssue("1234567", fake, fake).text).toBe("errors.code.VALIDATION");
    expect(loginPasswordFieldIssue("x".repeat(128), fake, fake).text).toBe(
      "errors.code.VALIDATION",
    );
    expect(loginPasswordFieldIssue("x".repeat(129), fake, fake)).toEqual({
      field: "password",
      text: "form.passwordTooLong",
    });
    expect(loginPasswordFieldIssue("🎁".repeat(65), fake, fake).text).toBe("form.passwordTooLong");
  });

  it("falls back to errors.code", () => {
    expect(formIssue(err({ code: "FORBIDDEN" }), fake, fake, "register")).toEqual({
      text: "errors.code.FORBIDDEN",
    });
  });

  it("keeps the field for other errors", () => {
    expect(formIssue(err({ code: "CONFLICT", field: "x" }), fake, fake, "register")).toEqual({
      field: "x",
      text: "errors.code.CONFLICT",
    });
  });
});

describe("confirmPasswordText", () => {
  it("is silent until the field is settled", () => {
    expect(confirmPasswordText("password1", "password2", false, t)).toBeUndefined();
    expect(confirmPasswordText("password1", "", false, t)).toBeUndefined();
  });

  it("names the mismatch once settled, an empty confirmation included", () => {
    expect(confirmPasswordText("password1", "password2", true, t)).toBe("form.passwordMismatch");
    expect(confirmPasswordText("password1", "", true, t)).toBe("form.passwordMismatch");
  });

  it("clears the line for equal values, after settling too", () => {
    expect(confirmPasswordText("password1", "password1", true, t)).toBeUndefined();
    expect(confirmPasswordText("", "", true, t)).toBeUndefined();
  });

  it("compares the values as typed: no trim, no normalisation", () => {
    expect(confirmPasswordText("password1", " password1", true, t)).toBe("form.passwordMismatch");
    expect(confirmPasswordText("Пароль", "пароль", true, t)).toBe("form.passwordMismatch");
  });
});

describe("nickErrorText", () => {
  it("names the reason of the value instead of a server rule list", () => {
    expect(nickErrorText("аня", t, "generic")).toBe("form.nickCyrillic");
    expect(nickErrorText("an na", t, "generic")).toBe("form.nickSpace");
    expect(nickErrorText("an#a", t, "generic")).toBe("form.nickChar");
    expect(nickErrorText("ab", t, "generic")).toBe("form.nickShort");
    expect(nickErrorText("a".repeat(25), t, "generic")).toBe("form.nickLong");
  });

  it("keeps the fallback when the client sees nothing wrong", () => {
    expect(nickErrorText("newnick", t, "generic")).toBe("generic");
  });
});

describe("mutationErrorMessage", () => {
  it("maps PAYLOAD_TOO_LARGE to the catalog reason instead of the code text", () => {
    expect(
      mutationErrorMessage({ code: "VALIDATION", reason: "PAYLOAD_TOO_LARGE" }, common),
    ).toBe("common:errors.reason.PAYLOAD_TOO_LARGE");
  });

  /**
   * CLE-82/S23.3: a closed and an archived wish share one sentence, and it comes from
   * `errors.reason.*` rather than the generic VALIDATION text of the code.
   */
  it.each(["GIFT_ARCHIVED", "GIFT_CLOSED"] as const)(
    "maps %s to its own catalog sentence",
    (reason) => {
      expect(mutationErrorMessage({ code: "VALIDATION", reason }, common)).toBe(
        `common:errors.reason.${reason}`,
      );
    },
  );

  it("keeps a reason that needs params out: its screen interpolates them", () => {
    expect(mutationErrorMessage({ code: "RATE_LIMITED", reason: "INVITE_COOLDOWN" }, common)).toBe(
      "common:errors.code.RATE_LIMITED",
    );
  });

  it("falls back to the code text; the server message has no path here", () => {
    expect(mutationErrorMessage({ code: "CONFLICT" }, common)).toBe(
      "common:errors.code.CONFLICT",
    );
  });
});
