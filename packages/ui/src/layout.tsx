import { View, styled } from "@tamagui/core";
import { XStack, YStack, ZStack } from "@tamagui/stacks";

export { View, XStack, YStack, ZStack };

/** The page background; fills the window. */
export const Screen = styled(YStack, {
  name: "GLScreen",
  flex: 1,
  backgroundColor: "$background",
});

/**
 * A centred content column with the page gutter (`DESIGN.md` → spacing:
 * `max-form`, `max-content`, `max-wide`).
 */
export const Column = styled(YStack, {
  name: "GLColumn",
  width: "100%",
  alignSelf: "center",
  paddingHorizontal: "$page-gutter",
  variants: {
    size: {
      form: { maxWidth: "$max-form" },
      content: { maxWidth: "$max-content" },
      wide: { maxWidth: "$max-wide" },
    },
  } as const,
  defaultVariants: { size: "form" },
});
