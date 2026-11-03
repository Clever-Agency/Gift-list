import { describe, expect, it } from "vitest";
import { cardGrid } from "@/ui/card-grid";

describe("cardGrid", () => {
  it("keeps one column on a phone", () => {
    expect(cardGrid(375)).toEqual({ columns: 1, cardWidth: 343 });
  });

  it("keeps one column at the 600 breakpoint", () => {
    expect(cardGrid(600).columns).toBe(1);
  });

  it("fits two columns from 640", () => {
    expect(cardGrid(640)).toEqual({ columns: 2, cardWidth: 288 });
  });

  it("stops at three columns and at max-wide", () => {
    expect(cardGrid(1440)).toEqual({ columns: 3, cardWidth: (1120 - 48 - 32) / 3 });
  });

  it("never goes below the card minimum on a very narrow window", () => {
    expect(cardGrid(300)).toEqual({ columns: 1, cardWidth: 280 });
  });
});
