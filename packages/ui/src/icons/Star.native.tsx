import { themed, type IconProps } from "@tamagui/helpers-icon";
import { memo, type JSX } from "react";
import { Polygon, Svg, type SvgProps } from "react-native-svg";

/**
 * The Lucide `Star` glyph from the official Tamagui v3 command
 * (`npx @tamagui/cli icons add Star`). Wrapped in a named function so React
 * DevTools shows `Star`; the web twin in `Star.tsx` avoids pulling
 * `react-native-svg` into the browser bundle.
 */
const ThemedStar = themed(
  memo(function StarGlyph(props: IconProps) {
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
        <Polygon
          points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
          stroke={color}
        />
      </Svg>
    );
  }),
);

export function Star(props: IconProps): JSX.Element {
  return <ThemedStar accessible={false} {...props} />;
}

Star.displayName = "Star";
