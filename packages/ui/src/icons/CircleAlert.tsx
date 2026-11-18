import type { JSX, SVGProps } from "react";

export type CircleAlertIconProps = Omit<SVGProps<SVGSVGElement>, "color"> & {
  size?: number;
  color?: string;
  testID?: string;
};

/**
 * Lucide `CircleAlert` for the web and for the DOM-based tests: the error tone of the
 * toast (`DESIGN.md` → Toast). The native twin is `CircleAlert.native.tsx`.
 */
export function CircleAlert({ size = 24, color = "currentColor", testID, ...rest }: CircleAlertIconProps): JSX.Element {
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
      <circle cx="12" cy="12" r="10" stroke={color} />
      <line x1="12" x2="12" y1="8" y2="12" stroke={color} />
      <line x1="12" x2="12.01" y1="16" y2="16" stroke={color} />
    </svg>
  );
}

CircleAlert.displayName = "CircleAlert";
