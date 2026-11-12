import type { JSX, SVGProps } from "react";

export type CloseIconProps = Omit<SVGProps<SVGSVGElement>, "color"> & {
  size?: number;
  color?: string;
  testID?: string;
};

/**
 * Lucide `X` for the web and the DOM-based tests: the clear button of
 * `SearchField`. The native twin is `Close.native.tsx`.
 */
export function Close({
  size = 24,
  color = "currentColor",
  testID,
  ...rest
}: CloseIconProps): JSX.Element {
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
      <path d="M18 6 6 18" stroke={color} />
      <path d="m6 6 12 12" stroke={color} />
    </svg>
  );
}

Close.displayName = "Close";
