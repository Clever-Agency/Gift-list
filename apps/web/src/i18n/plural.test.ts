import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { getMessages } from "@gift-list/contracts";

describe("app.smoke.wishes", () => {
  it("formats the four Russian plural forms", () => {
    const t = createTranslator({
      locale: "ru",
      namespace: "app",
      messages: getMessages("ru"),
    });
    const line = [1, 3, 5, 21].map((count) => t("smoke.wishes", { count })).join(" · ");
    expect(line).toBe("1 желание · 3 желания · 5 желаний · 21 желание");
  });
});
