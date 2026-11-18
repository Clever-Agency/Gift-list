import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { defaultDueOn } from "./reserve-confirm";

const catalog = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../../..", "packages/contracts/src/i18n/ru/app.json"),
    "utf8",
  ),
) as {
  gift: {
    reserveConfirm: Record<string, string>;
    reserveNoButton: Record<string, string>;
    reserveCta: string;
  };
};

describe("reserve confirm defaults", () => {
  it("offers today+7 in the giver's zone", () => {
    const now = new Date("2026-06-15T21:30:00.000Z");
    expect(defaultDueOn("Europe/Moscow", now)).toBe("2026-06-23");
    expect(defaultDueOn("UTC", now)).toBe("2026-06-22");
  });

  it("uses the spec copy for the two switches, the bought hint and the missing button", () => {
    expect(catalog.gift.reserveCta).toBe("Куплю сам");
    expect(catalog.gift.reserveConfirm.showOwner).toBe("Показать владельцу, что это я");
    expect(catalog.gift.reserveConfirm.showOthers).toBe("Показать другим, кто берёт");
    expect(catalog.gift.reserveConfirm.boughtHint).toBe(
      "Если купите заранее, отметьте «Купил» — бронь не снимется сама",
    );
    expect(catalog.gift.reserveNoButton).toEqual({
      UNLIMITED: "Можно дарить без брони",
      RESERVED: "Уже забронирован",
      CLOSED: "Уже подарено",
    });
  });
});
