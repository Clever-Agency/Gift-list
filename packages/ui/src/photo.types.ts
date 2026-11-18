import type { ReactNode } from "react";

export type PhotoProps = {
  /** The picture to draw; without it the `placeholder` fills the box. */
  url?: string | null;
  /** The calm stand-in when there is no photo (a tinted plate with the product mark). */
  placeholder?: ReactNode;
  testID?: string;
};
