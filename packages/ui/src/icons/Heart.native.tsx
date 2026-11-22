import { themed, type IconProps } from "@tamagui/helpers-icon";
import { memo, type JSX } from "react";
import { Path, Svg, type SvgProps } from "react-native-svg";

/**
 * The Lucide `Heart` glyph for the phone. Wrapped in a named function so React
 * DevTools shows `Heart`; the web twin in `Heart.tsx` avoids pulling
 * `react-native-svg` into the browser bundle.
 */
const ThemedHeart = themed(
  memo(function HeartGlyph(props: IconProps) {
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
        <Path
          d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
          stroke={color}
        />
      </Svg>
    );
  }),
);

export function Heart(props: IconProps): JSX.Element {
  return <ThemedHeart accessible={false} {...props} />;
}

Heart.displayName = "Heart";
