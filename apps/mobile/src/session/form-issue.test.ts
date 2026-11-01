import { describe, expect, it } from "vitest";
import { formIssue } from "./form-issue";

const fake = (key: string) => key;
const err = (extra: Record<string, unknown>) => ({ ok: false, message: "", ...extra }) as never;

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
