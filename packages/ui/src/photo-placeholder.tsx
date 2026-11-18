import { View } from "@tamagui/core";
import { YStack } from "@tamagui/stacks";
import { Moon } from "./icons";
import { Text } from "./text";
import { useThemeColor } from "./theme-color";

/** Two calm tints, never at random: the same seed always paints the same plate. */
const TINTS = ["$accent", "$muted"] as const;

function placeholderTint(seed: string): string {
  const sum = Array.from(seed).reduce(function codePoint(total, char) {
    return total + (char.codePointAt(0) ?? 0);
  }, 0);
  return TINTS[sum % TINTS.length] ?? TINTS[0];
}

export type PhotoPlaceholderProps = {
  /** Text the tint is derived from — a title, a store name, a collection name. */
  seed?: string;
  /** Letters instead of the moon mark (a store cover), e.g. «СЛ». */
  monogram?: string;
  testID?: string;
};

/**
 * The v8 stand-in for a missing photo (`blocks/14-photo-placeholders.png`): a calm
 * themed plate with a soft light spot and the moon of the product — or the store's
 * monogram — and never any text over a picture. The tint is derived from the seed, so
 * a grid of placeholders never flashes one colour.
 */
export function PhotoPlaceholder({ seed = "", monogram, testID }: PhotoPlaceholderProps) {
  const ink = useThemeColor("accent-foreground");
  return (
    <YStack
      testID={testID}
      width="100%"
      height="100%"
      alignItems="center"
      justifyContent="center"
      backgroundColor={placeholderTint(seed)}
    >
      <View
        position="absolute"
        width={72}
        height={72}
        borderRadius="$full"
        backgroundColor="$surface"
        opacity={0.6}
        aria-hidden
      />
      {monogram ? (
        <Text kind="display" color="$accent-foreground" aria-hidden>
          {monogram}
        </Text>
      ) : (
        <Moon size={28} color={ink} />
      )}
    </YStack>
  );
}

PhotoPlaceholder.displayName = "PhotoPlaceholder";
