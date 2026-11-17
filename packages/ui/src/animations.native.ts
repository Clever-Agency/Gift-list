import { createAnimations } from "@tamagui/animations-react-native";

export const animations = createAnimations({
  quick: { type: "timing", duration: 160 },
  medium: { type: "timing", duration: 240 },
  // W12.7, «уменьшить движение» (`DESIGN.md` → Движение): у слоя нет сдвига,
  // остаётся только fade непрозрачности — он укладывается в 100 мс.
  reduceFade: { type: "timing", duration: 100 },
  // W12.7: слой без движения (шторка при reduce) меняет позицию мгновенно,
  // иначе `Sheet` без `transition` уходит нативной пружиной за ~0.5–0.8 с.
  instant: { type: "timing", duration: 0 },
});
