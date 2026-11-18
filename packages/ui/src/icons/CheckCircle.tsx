import type { JSX, SVGProps } from "react";

export type CheckCircleIconProps = Omit<SVGProps<SVGSVGElement>, "color"> & {
  size?: number;
  color?: string;
  testID?: string;
};

/**
 * Lucide `CircleCheck` for the web and for the DOM-based tests: the success tone of
 * the toast (`DESIGN.md` → Toast). The native twin is `CheckCircle.native.tsx`.
 */
export function CheckCircle({ size = 24, color = "currentColor", testID, ...rest }: CheckCircleIconProps): JSX.Element {
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
      <path d="m9 12 2 2 4-4" stroke={color} />
    </svg>
  );
}

CheckCircle.displayName = "CheckCircle";
