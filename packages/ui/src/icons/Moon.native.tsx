import { themed, type IconProps } from "@tamagui/helpers-icon";
import { memo, type JSX } from "react";
import { Path, Svg, type SvgProps } from "react-native-svg";

/**
 * The Lucide `Moon` glyph on `react-native-svg`, built like the other native twins
 * (see `Star.native.tsx`). Wrapped in a named function so React DevTools shows
 * `Moon`; the web twin in `Moon.tsx` avoids pulling `react-native-svg` into the
 * browser bundle.
 */
const ThemedMoon = themed(
  memo(function MoonGlyph(props: IconProps) {
    const { color = "black", size = 24, ...otherProps } = props as SvgProps & {
      color?: string;
      size?: number;
    };
    return (
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...otherProps}
      >
        <Path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" stroke={color} />
      </Svg>
    );
  }),
);

export function Moon(props: IconProps): JSX.Element {
  return <ThemedMoon accessible={false} {...props} />;
}

Moon.displayName = "Moon";
