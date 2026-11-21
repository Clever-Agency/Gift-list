import type { JSX, SVGProps } from "react";

export type UsersIconProps = Omit<SVGProps<SVGSVGElement>, "color"> & {
  size?: number;
  color?: string;
  testID?: string;
};

/**
 * Lucide `Users` for the web and the DOM-based tests — the «Друзья» section.
 * The native twin is `Users.native.tsx` on top of `react-native-svg`.
 */
export function Users({
  size = 24,
  color = "currentColor",
  testID,
  ...rest
}: UsersIconProps): JSX.Element {
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
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke={color} />
      <circle cx="9" cy="7" r="4" stroke={color} />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke={color} />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke={color} />
    </svg>
  );
}

Users.displayName = "Users";
