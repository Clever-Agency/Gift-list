import { breakpoints } from "@gift-list/ui";
import { describe, expect, it } from "vitest";
import { isInstallHintAside } from "./install-hint-placement";

/**
 * UX-DR11: the one place of the hint follows the window classes of `DESIGN.md` —
 * a right column from `wide`, a card below it.
 */
describe("место подсказки установки", () => {
  it("до wide — карточка, от wide — правая колонка", () => {
    expect(isInstallHintAside(breakpoints.wide - 1)).toBe(false);
    expect(isInstallHintAside(breakpoints.wide)).toBe(true);
    expect(isInstallHintAside(1440)).toBe(true);
  });
});
