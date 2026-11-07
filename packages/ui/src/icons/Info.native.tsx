import { themed, type IconProps } from "@tamagui/helpers-icon";
import { memo, type JSX } from "react";
import { Circle, Path, Svg, type SvgProps } from "react-native-svg";

/**
 * The Lucide `Info` glyph from the official Tamagui v3 command
 * (`npx @tamagui/cli icons add Info`). Wrapped in a named function so React
 * DevTools shows `Info`; the web twin in `Info.tsx` avoids pulling
 * `react-native-svg` into the browser bundle.
 */
const ThemedInfo = themed(
  memo(function InfoGlyph(props: IconProps) {
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
        <Circle cx="12" cy="12" r="10" stroke={color} />
        <Path d="M12 16v-4" stroke={color} />
        <Path d="M12 8h.01" stroke={color} />
      </Svg>
    );
  }),
);

export function Info(props: IconProps): JSX.Element {
  return <ThemedInfo accessible={false} {...props} />;
}

Info.displayName = "Info";
