import { themed, type IconProps } from "@tamagui/helpers-icon";
import { memo, type JSX } from "react";
import { Circle, Path, Svg, type SvgProps } from "react-native-svg";

/**
 * The Lucide `Search` glyph for the phone. Wrapped in a named function so React
 * DevTools shows `Search`; the web twin in `Search.tsx` avoids pulling
 * `react-native-svg` into the browser bundle.
 */
const ThemedSearch = themed(
  memo(function SearchGlyph(props: IconProps) {
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
        <Circle cx="11" cy="11" r="8" stroke={color} />
        <Path d="m21 21-4.3-4.3" stroke={color} />
      </Svg>
    );
  }),
);

export function Search(props: IconProps): JSX.Element {
  return <ThemedSearch accessible={false} {...props} />;
}

Search.displayName = "Search";
