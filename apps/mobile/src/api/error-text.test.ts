import { describe, expect, it } from "vitest";
import { ERROR_CODES, ERROR_REASONS, getMessages } from "@gift-list/contracts";
import { errorTextKey } from "./error-text";

function lookup(key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      getMessages("ru").common,
    );
}

describe("errorTextKey", () => {
  it("prefers the reason", () => {
    const error = {
      ok: false as const,
      code: "VALIDATION" as const,
      message: "",
      reason: "EMAIL_TAKEN" as const,
    };
    expect(errorTextKey({ ok: false, kind: "api", error })).toBe("errors.reason.EMAIL_TAKEN");
  });

  it("falls back to the code", () => {
    const error = { ok: false as const, code: "FORBIDDEN" as const, message: "" };
    expect(errorTextKey({ ok: false, kind: "api", error })).toBe("errors.code.FORBIDDEN");
  });

  it("maps network", () => {
    expect(errorTextKey({ ok: false, kind: "network" })).toBe("errors.network");
  });

  it("every key resolves in the ru catalog", () => {
    const keys = [
      "errors.network",
      ...ERROR_CODES.map((code) => `errors.code.${code}`),
      ...ERROR_REASONS.map((reason) => `errors.reason.${reason}`),
    ];
    for (const key of keys) expect(typeof lookup(key)).toBe("string");
  });
});
