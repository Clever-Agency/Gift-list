import { themed, type IconProps } from "@tamagui/helpers-icon";
import { memo, type JSX } from "react";
import { Circle, Line, Svg, type SvgProps } from "react-native-svg";

/**
 * The Lucide `CircleAlert` glyph on `react-native-svg`, built like the other native
 * twins (see `Star.native.tsx`). Wrapped in a named function so React DevTools shows
 * `CircleAlert`; the web twin in `CircleAlert.tsx` avoids pulling `react-native-svg`
 * into the browser bundle.
 */
const ThemedCircleAlert = themed(
  memo(function CircleAlertGlyph(props: IconProps) {
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
        <Line x1="12" x2="12" y1="8" y2="12" stroke={color} />
        <Line x1="12" x2="12.01" y1="16" y2="16" stroke={color} />
      </Svg>
    );
  }),
);

export function CircleAlert(props: IconProps): JSX.Element {
  return <ThemedCircleAlert accessible={false} {...props} />;
}

CircleAlert.displayName = "CircleAlert";
