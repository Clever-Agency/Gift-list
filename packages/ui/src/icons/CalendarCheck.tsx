import type { JSX, SVGProps } from "react";

export type CalendarCheckIconProps = Omit<SVGProps<SVGSVGElement>, "color"> & {
  size?: number;
  color?: string;
  testID?: string;
};

/**
 * Lucide `CalendarCheck` for the web and the DOM-based tests — the «Брони»
 * section. The native twin is `CalendarCheck.native.tsx` on top of
 * `react-native-svg`.
 */
export function CalendarCheck({
  size = 24,
  color = "currentColor",
  testID,
  ...rest
}: CalendarCheckIconProps): JSX.Element {
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
      <path d="M8 2v4" stroke={color} />
      <path d="M16 2v4" stroke={color} />
      <rect width="18" height="18" x="3" y="4" rx="2" stroke={color} />
      <path d="M3 10h18" stroke={color} />
      <path d="m9 16 2 2 4-4" stroke={color} />
    </svg>
  );
}

CalendarCheck.displayName = "CalendarCheck";
