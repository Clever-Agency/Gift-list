import { themed, type IconProps } from "@tamagui/helpers-icon";
import { memo, type JSX } from "react";
import { Circle, Path, Svg, type SvgProps } from "react-native-svg";

/**
 * The Lucide `Eye` glyph from the official Tamagui v3 command
 * (`npx @tamagui/cli icons add Eye`). Wrapped in a named function so React
 * DevTools shows `Eye`; the web twin in `Eye.tsx` avoids pulling
 * `react-native-svg` into the browser bundle.
 */
const ThemedEye = themed(
  memo(function EyeGlyph(props: IconProps) {
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
        <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke={color} />
        <Circle cx="12" cy="12" r="3" stroke={color} />
      </Svg>
    );
  }),
);

export function Eye(props: IconProps): JSX.Element {
  return <ThemedEye accessible={false} {...props} />;
}

Eye.displayName = "Eye";
