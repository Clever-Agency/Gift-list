import type { JSX, SVGProps } from "react";

export type SearchIconProps = Omit<SVGProps<SVGSVGElement>, "color"> & {
  size?: number;
  color?: string;
  testID?: string;
};

/**
 * Lucide `Search` for the web and the DOM-based tests. The native twin is
 * `Search.native.tsx` on top of `react-native-svg`.
 */
export function Search({
  size = 24,
  color = "currentColor",
  testID,
  ...rest
}: SearchIconProps): JSX.Element {
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
      <circle cx="11" cy="11" r="8" stroke={color} />
      <path d="m21 21-4.3-4.3" stroke={color} />
    </svg>
  );
}

Search.displayName = "Search";
