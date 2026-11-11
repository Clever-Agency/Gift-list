// @vitest-environment node
import { mediaObjectToString } from "@tamagui/core";
import { describe, expect, it } from "vitest";
import { createGiftListConfig } from "./config";
import { breakpoints } from "./tokens";

const config = createGiftListConfig({ body: "Manrope", heading: "Lora" });
const media = config.media as Record<string, Record<string, string | number>>;

describe("config: media", () => {
  it("ключ reduce — «уменьшить движение», ровно (prefers-reduced-motion: reduce)", () => {
    expect(media.reduce).toEqual({ prefersReducedMotion: "reduce" });
    // Tamagui camelCase → kebab (mediaObjectToString): the exact query string.
    expect(mediaObjectToString(media.reduce)).toBe("(prefers-reduced-motion: reduce)");
  });

  it("брейкпоинты на месте", () => {
    expect(media.medium).toEqual({ minWidth: breakpoints.medium });
    expect(media.expanded).toEqual({ minWidth: breakpoints.expanded });
    expect(media.wide).toEqual({ minWidth: breakpoints.wide });
  });
});
