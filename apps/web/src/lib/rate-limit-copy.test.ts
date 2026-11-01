import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { getMessages, rateLimitedError } from "@gift-list/contracts";

const t = createTranslator({
  locale: "ru",
  messages: getMessages("ru"),
  namespace: "common",
});

function text(seconds: number): string {
  return t("errors.code.RATE_LIMITED", rateLimitedError("Too many attempts", seconds).params);
}

describe("RATE_LIMITED copy", () => {
  it("says how long to wait and keeps the old sentence when the unit is absent", () => {
    expect(text(1)).toBe("Слишком много попыток. Попробуйте через 1 секунду.");
    expect(text(2)).toBe("Слишком много попыток. Попробуйте через 2 секунды.");
    expect(text(45)).toBe("Слишком много попыток. Попробуйте через 45 секунд.");
    expect(text(60)).toBe("Слишком много попыток. Попробуйте через 1 минуту.");
    expect(text(125)).toBe("Слишком много попыток. Попробуйте через 3 минуты.");
    expect(text(5 * 60)).toBe("Слишком много попыток. Попробуйте через 5 минут.");
    expect(t("errors.code.RATE_LIMITED", { unit: "other" })).toBe(
      "Слишком много попыток. Попробуйте позже.",
    );
  });
});
