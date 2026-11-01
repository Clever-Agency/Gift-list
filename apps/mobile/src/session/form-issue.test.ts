import { describe, expect, it } from "vitest";
import { issueFromError } from "./form-issue";

const t = (key: string) => key;
const common = (key: string, values?: Record<string, string | number>) =>
  values ? `common:${key}:${values.unit}:${values.count}` : `common:${key}`;

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
