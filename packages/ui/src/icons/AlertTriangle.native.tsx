import { themed, type IconProps } from "@tamagui/helpers-icon";
import { memo, type JSX } from "react";
import { Path, Svg, type SvgProps } from "react-native-svg";

/**
 * The Lucide `TriangleAlert` glyph on `react-native-svg`, built like the other native
 * twins (see `Star.native.tsx`). Wrapped in a named function so React DevTools shows
 * `AlertTriangle`; the web twin in `AlertTriangle.tsx` avoids pulling
 * `react-native-svg` into the browser bundle.
 */
const ThemedAlertTriangle = themed(
  memo(function AlertTriangleGlyph(props: IconProps) {
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
          d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"
          stroke={color}
        />
        <Path d="M12 9v4" stroke={color} />
        <Path d="M12 17h.01" stroke={color} />
      </Svg>
    );
  }),
);

export function AlertTriangle(props: IconProps): JSX.Element {
  return <ThemedAlertTriangle accessible={false} {...props} />;
}

AlertTriangle.displayName = "AlertTriangle";
