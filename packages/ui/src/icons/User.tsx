import type { JSX, SVGProps } from "react";

export type UserIconProps = Omit<SVGProps<SVGSVGElement>, "color"> & {
  size?: number;
  color?: string;
  testID?: string;
};

/**
 * Lucide `User` for the web and the DOM-based tests — the «Профиль» section.
 * The native twin is `User.native.tsx` on top of `react-native-svg`.
 */
export function User({
  size = 24,
  color = "currentColor",
  testID,
  ...rest
}: UserIconProps): JSX.Element {
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
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" stroke={color} />
      <circle cx="12" cy="7" r="4" stroke={color} />
    </svg>
  );
}

User.displayName = "User";
