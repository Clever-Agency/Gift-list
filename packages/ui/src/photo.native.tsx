import { Image } from "react-native";
import type { PhotoProps } from "./photo.types";

/**
 * The phone half of `Photo`: React Native's `Image` with `resizeMode="cover"` inside
 * the same clipped box the web half fills with an `<img>`.
 */
export function Photo({ url, placeholder, testID }: PhotoProps) {
  if (!url) return <>{placeholder ?? null}</>;
  return (
    <Image
      source={{ uri: url }}
      testID={testID}
      accessibilityIgnoresInvertColors
      style={{ width: "100%", height: "100%" }}
      resizeMode="cover"
    />
  );
}

Photo.displayName = "Photo";
