import { styled } from "@tamagui/core";
import { YStack } from "@tamagui/stacks";
import { Photo } from "./photo";
import { PhotoPlaceholder } from "./photo-placeholder";
import { Pressable } from "./pressable";
import { Text } from "./text";

const CardView = styled(YStack, { name: "GLCollectionCard", gap: "$1" });
const CardButton = styled(Pressable, {
  name: "GLCollectionCardButton",
  gap: "$1",
  cursor: "pointer",
});

export type CollectionCardProps = {
  /** The editorial title, one line with an ellipsis (Lora, like the other headings). */
  title: string;
  /** The idea count line, already pluralised by the caller: «24 идеи». */
  count: string;
  /** The 3:4 cover photo; without it a tinted plate with the moon mark. */
  coverUrl?: string | null;
  width?: number | string;
  onPress?: () => void;
  /** The accessible name, e.g. «На Новый год, 24 идеи». */
  pressLabel?: string;
  testID?: string;
};

/**
 * The collection card of v8, variant A (`blocks/13-partners-collections.png`): a tall
 * 3:4 cover with the card shadow, and under it — on the page background, never on the
 * photo — the title and the idea count. Presentational and string-free: the count is
 * already pluralised by the caller.
 */
export function CollectionCard({
  title,
  count,
  coverUrl,
  width = 150,
  onPress,
  pressLabel,
  testID,
}: CollectionCardProps) {
  const content = (
    <>
      <YStack
        width="100%"
        aspectRatio={3 / 4}
        borderRadius="$lg"
        overflow="hidden"
        backgroundColor="$muted"
        boxShadow="$shadow-card"
      >
        <Photo
          url={coverUrl}
          testID={testID ? `${testID}-cover` : undefined}
          placeholder={<PhotoPlaceholder seed={title} />}
        />
      </YStack>
      <YStack paddingHorizontal="$1" gap="$1">
        <Text kind="heading" numberOfLines={1}>
          {title}
        </Text>
        <Text kind="caption" tone="muted" numberOfLines={1}>
          {count}
        </Text>
      </YStack>
    </>
  );

  if (onPress === undefined) {
    return (
      <CardView width={width} testID={testID}>
        {content}
      </CardView>
    );
  }

  return (
    <CardButton width={width} role="button" aria-label={pressLabel} onPress={onPress} testID={testID}>
      {content}
    </CardButton>
  );
}

CollectionCard.displayName = "CollectionCard";
