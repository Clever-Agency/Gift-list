import { styled } from "@tamagui/core";
import { XStack, YStack } from "@tamagui/stacks";
import { Photo } from "./photo";
import { PhotoPlaceholder } from "./photo-placeholder";
import { Pressable } from "./pressable";
import { Text } from "./text";

/** The v8 card skin of a partner store: surface, 1 px frame, radius 16, card shadow. */
const cardSkin = {
  width: "100%",
  backgroundColor: "$surface",
  borderWidth: 1,
  borderColor: "$border",
  borderRadius: "$lg",
  boxShadow: "$shadow-card",
} as const;

/** The same skin for a card that is a button: the frame and the shadow answer the pointer. */
const cardHover = {
  borderColor: "$border hover:$border-strong",
  boxShadow: "$shadow-card hover:$shadow-card-hover",
} as const;

const CardView = styled(YStack, { name: "GLPartnerStoreCard", ...cardSkin });

export type PartnerStoreCardProps = {
  /** The store name, one line with an ellipsis. */
  name: string;
  /** The category line, e.g. «дом и уют». */
  category: string;
  /** The promo chip, e.g. «−15% по промокоду». Never red, never gold. */
  promo?: string | null;
  /** The store cover photo; without it a tinted plate with the monogram. */
  coverUrl?: string | null;
  /** The store logo; without it the monogram stands in the circle. */
  logoUrl?: string | null;
  /** The letters of the logo circle and of the cover placeholder, e.g. «СЛ». */
  monogram: string;
  /** The card width; the rail slides cards of one width. */
  width?: number | string;
  onPress?: () => void;
  /** The accessible name, e.g. «Северная лавка, дом и уют, −15% по промокоду». */
  pressLabel?: string;
  testID?: string;
};

/**
 * The partner store card of v8, variant C (`blocks/13-partners-collections.png`):
 * the store cover on top, the logo circle overlapping its bottom edge, then the name,
 * the category and the promo chip. Text never sits on the photo; the cover placeholder
 * is the store's monogram on a calm tint. Presentational: the rail decides the width,
 * the caller supplies every string.
 */
export function PartnerStoreCard({
  name,
  category,
  promo,
  coverUrl,
  logoUrl,
  monogram,
  width = 200,
  onPress,
  pressLabel,
  testID,
}: PartnerStoreCardProps) {
  const content = (
    <>
      <YStack
        width="100%"
        aspectRatio={16 / 9}
        overflow="hidden"
        borderTopLeftRadius="$lg"
        borderTopRightRadius="$lg"
        backgroundColor="$muted"
      >
        <Photo
          url={coverUrl}
          testID={testID ? `${testID}-cover` : undefined}
          placeholder={<PhotoPlaceholder seed={name} monogram={monogram} />}
        />
      </YStack>
      {/* The logo sits on the edge of the cover: a surface ring with the sign inside. */}
      <XStack marginTop={-28} paddingLeft="$3">
        <XStack
          width={56}
          height={56}
          borderRadius="$full"
          backgroundColor="$surface"
          alignItems="center"
          justifyContent="center"
        >
          <XStack
            width={48}
            height={48}
            borderRadius="$full"
            overflow="hidden"
            backgroundColor="$accent"
            alignItems="center"
            justifyContent="center"
            testID={testID ? `${testID}-logo` : undefined}
          >
            {logoUrl ? (
              <Photo url={logoUrl} />
            ) : (
              <Text kind="body-strong" color="$accent-foreground">
                {monogram}
              </Text>
            )}
          </XStack>
        </XStack>
      </XStack>
      <YStack paddingHorizontal="$card-padding" paddingTop="$1" paddingBottom="$card-padding" gap="$1">
        <Text kind="body-strong" numberOfLines={1}>
          {name}
        </Text>
        <Text kind="caption" tone="muted" numberOfLines={1}>
          {category}
        </Text>
        {promo ? (
          <XStack
            alignSelf="flex-start"
            marginTop="$1"
            height={26}
            paddingHorizontal={10}
            alignItems="center"
            borderRadius="$md"
            backgroundColor="$accent"
          >
            <Text kind="caption" fontWeight="600" color="$accent-foreground" numberOfLines={1}>
              {promo}
            </Text>
          </XStack>
        ) : null}
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
    <Pressable
      {...cardSkin}
      {...cardHover}
      width={width}
      aria-label={pressLabel}
      onPress={onPress}
      testID={testID}
      role="button"
      cursor="pointer"
      // The card lifts its own shadow; the shared muted fill would paint over the
      // `$surface` of the card.
      hoverFill={false}
    >
      {content}
    </Pressable>
  );
}

PartnerStoreCard.displayName = "PartnerStoreCard";
