import { describe, expect, it } from "vitest";
import { formIssue, issueFromError, passwordFieldIssue } from "./form-issue";

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

  it("VALIDATION on nick", () => {
    expect(formIssue(err({ code: "VALIDATION", field: "nick" }), fake, fake, "register")).toEqual({
      field: "nick",
      text: "register.nickRules",
    });
  });

  it("VALIDATION on password stays on the code text until the screen knows the length", () => {
    expect(formIssue(err({ code: "VALIDATION", field: "password" }), fake, fake, "register")).toEqual({
      field: "password",
      text: "errors.code.VALIDATION",
    });
  });

  it("passwordFieldIssue states the minimum only while the password is shorter than 8", () => {
    expect(passwordFieldIssue("1234567", fake, fake)).toEqual({
      field: "password",
      text: "form.passwordRules",
    });
    expect(passwordFieldIssue("12345678", fake, fake).text).toBe("errors.code.VALIDATION");
    expect(passwordFieldIssue("x".repeat(129), fake, fake).text).toBe("errors.code.VALIDATION");
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
