import type { ReactNode } from "react";

export type PhotoProps = {
  /** The picture to draw; without it the `placeholder` fills the box. */
  url?: string | null;
  /** The calm stand-in when there is no photo (a tinted plate with the product mark). */
  placeholder?: ReactNode;
  testID?: string;
};

/**
 * A photo inside a box the parent sizes and clips (`aspectRatio` + `overflow="hidden"`).
 * Web half of the platform pair: an `<img>` with `object-fit: cover`; the phone takes
 * `photo.native.tsx`. The picture is always decorative — the name next to it carries
 * the meaning, so `alt` is empty.
 */
export function Photo({ url, placeholder, testID }: PhotoProps) {
  if (!url) return <>{placeholder ?? null}</>;
  return (
    <img
      src={url}
      alt=""
      data-testid={testID}
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
    />
  );
}

Photo.displayName = "Photo";
