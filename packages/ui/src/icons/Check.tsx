import type { JSX, SVGProps } from "react";

export type CheckIconProps = Omit<SVGProps<SVGSVGElement>, "color"> & {
  size?: number;
  color?: string;
  testID?: string;
};

/**
 * Lucide `Check` for the web and for the DOM-based tests: the accept glyph of the
 * friends requests (`DESIGN.md` → PersonRow → Запросы). The native twin is
 * `Check.native.tsx`, built like the other icons on `react-native-svg`.
 */
export function Check({ size = 24, color = "currentColor", testID, ...rest }: CheckIconProps): JSX.Element {
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
      <path d="M20 6 9 17l-5-5" stroke={color} />
    </svg>
  );
}

Check.displayName = "Check";
