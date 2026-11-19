import type { JSX, SVGProps } from "react";

export type MoonIconProps = Omit<SVGProps<SVGSVGElement>, "color"> & {
  size?: number;
  color?: string;
  testID?: string;
};

/**
 * Lucide `Moon` for the web and for the DOM-based tests: the wish-photo placeholder
 * glyph of v8 (`DESIGN.md` → WishCard, «фото нет»). The native twin is
 * `Moon.native.tsx`, built the same way as the other icons on `react-native-svg`.
 */
export function Moon({ size = 24, color = "currentColor", testID, ...rest }: MoonIconProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
      aria-hidden="true"
      focusable="false"
      data-testid={testID}
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" stroke={color} />
    </svg>
  );
}

Moon.displayName = "Moon";
