import type { JSX, SVGProps } from "react";

export type BellIconProps = Omit<SVGProps<SVGSVGElement>, "color"> & {
  size?: number;
  color?: string;
  testID?: string;
};

/**
 * Lucide `Bell` for the web and the DOM-based tests — the «Уведомления»
 * section. The native twin is `Bell.native.tsx` on top of `react-native-svg`.
 * `color` is set by the host (`NavItem` tints it), so the glyph never inherits
 * the browser link colours of its anchor.
 */
export function Bell({
  size = 24,
  color = "currentColor",
  testID,
  ...rest
}: BellIconProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
      aria-hidden="true"
      focusable="false"
      data-testid={testID}
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" stroke={color} />
    </svg>
  );
}

Bell.displayName = "Bell";
