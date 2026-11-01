import { describe, expect, it } from "vitest";
import { rateLimitedError, rateLimitedParams } from "./rate-limit";

describe("rateLimitedParams", () => {
  it("uses seconds under a minute and whole minutes after that", () => {
    expect(rateLimitedParams(0)).toEqual({ unit: "second", count: 1 });
    expect(rateLimitedParams(1)).toEqual({ unit: "second", count: 1 });
    expect(rateLimitedParams(45.2)).toEqual({ unit: "second", count: 46 });
    expect(rateLimitedParams(59)).toEqual({ unit: "second", count: 59 });
    expect(rateLimitedParams(60)).toEqual({ unit: "minute", count: 1 });
    expect(rateLimitedParams(61)).toEqual({ unit: "minute", count: 2 });
    expect(rateLimitedParams(125)).toEqual({ unit: "minute", count: 3 });
  });

  it("puts those values on an AD-12 error", () => {
    expect(rateLimitedError("Too many attempts", 125)).toEqual({
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many attempts",
      params: { unit: "minute", count: 3 },
    });
  });
});
