import { themed, type IconProps } from "@tamagui/helpers-icon";
import { memo, type JSX } from "react";
import { Line, Path, Svg, type SvgProps } from "react-native-svg";

/**
 * The Lucide `EyeOff` glyph from the official Tamagui v3 command
 * (`npx @tamagui/cli icons add EyeOff`). Wrapped in a named function so React
 * DevTools shows `EyeOff`; the web twin in `EyeOff.tsx` avoids pulling
 * `react-native-svg` into the browser bundle.
 */
const ThemedEyeOff = themed(
  memo(function EyeOffGlyph(props: IconProps) {
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
        <Path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" stroke={color} />
        <Path
          d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"
          stroke={color}
        />
        <Path
          d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"
          stroke={color}
        />
        <Line x1="2" x2="22" y1="2" y2="22" stroke={color} />
      </Svg>
    );
  }),
);

export function EyeOff(props: IconProps): JSX.Element {
  return <ThemedEyeOff accessible={false} {...props} />;
}

EyeOff.displayName = "EyeOff";
