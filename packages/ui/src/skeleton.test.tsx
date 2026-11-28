// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { WishCardSkeleton } from "./skeleton";
import { createMount } from "./test-utils";

const mounted = createMount();

/**
 * CLE-129, T4.1/T4.4: the wish card has no chip row since D-54, so its skeleton
 * must end with the text lines. The removed `$chip-height` spacer kept the card
 * skeleton ~36 px taller than the real card.
 */
describe("WishCardSkeleton: высота как у карточки", () => {
  it("состоит из плитки и блока текста — пустой полосы под чип нет", async () => {
    const { render } = mounted();
    await render(<WishCardSkeleton width={320} testID="card-skeleton" />);

    const card = document.querySelector<HTMLElement>('[data-testid="card-skeleton"]');
    expect(card, "скелет карточки").not.toBeNull();
    // Two blocks only: the 4:5 plate and the text stack; no empty third block.
    expect(card?.children).toHaveLength(2);
    expect(card?.firstElementChild?.getAttribute("data-testid")).toBe(
      "wish-card-skeleton-photo",
    );
    // The text stack is the end of the skeleton: title, price and pill lines.
    expect(card?.lastElementChild?.children).toHaveLength(3);
  });
});
