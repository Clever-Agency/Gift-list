import { themed, type IconProps } from "@tamagui/helpers-icon";
import { memo, type JSX } from "react";
import { Path, Svg, type SvgProps } from "react-native-svg";

/**
 * The Lucide `Bell` glyph for the phone. Wrapped in a named function so React
 * DevTools shows `Bell`; the web twin in `Bell.tsx` avoids pulling
 * `react-native-svg` into the browser bundle. `color` is set by the host
 * (`NavItem` tints it), as in the other native twins.
 */
const ThemedBell = themed(
  memo(function BellGlyph(props: IconProps) {
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
        <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" stroke={color} />
      </Svg>
    );
  }),
);

export function Bell(props: IconProps): JSX.Element {
  return <ThemedBell accessible={false} {...props} />;
}

Bell.displayName = "Bell";
