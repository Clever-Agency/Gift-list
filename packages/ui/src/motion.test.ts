import { describe, expect, it } from "vitest";
import { animations } from "./animations";
import {
  LAYER_INSTANT,
  LAYER_QUICK,
  LAYER_QUICK_MS,
  LAYER_REDUCE_FADE,
  LAYER_REDUCE_FADE_MS,
  layerExitMs,
  layerFade,
  sheetMotion,
} from "./motion";

const presets = animations.animations as Record<string, { type: string; duration: number }>;

describe("Движение слоёв: пресеты и выбор", () => {
  it("quick 160 мс и medium 240 мс остаются как были", () => {
    expect(presets.quick).toEqual({ type: "timing", duration: 160 });
    expect(presets.medium).toEqual({ type: "timing", duration: 240 });
  });

  it("reduce-fade не длиннее 100 мс, instant — без движения", () => {
    expect(presets.reduceFade).toEqual({ type: "timing", duration: 100 });
    expect(presets.instant).toEqual({ type: "timing", duration: 0 });
  });

  it("обычный путь — quick, reduce — только короткий fade", () => {
    expect(layerFade(false)).toBe(LAYER_QUICK);
    expect(layerFade(true)).toBe(LAYER_REDUCE_FADE);
    expect(layerExitMs(false)).toBe(LAYER_QUICK_MS);
    expect(layerExitMs(true)).toBe(LAYER_REDUCE_FADE_MS);
    expect(layerExitMs(true)).toBeLessThanOrEqual(100);
  });

  it("шторка едет quick, при reduce прыгает без сдвига", () => {
    expect(sheetMotion(false)).toBe(LAYER_QUICK);
    expect(sheetMotion(true)).toBe(LAYER_INSTANT);
  });
});
