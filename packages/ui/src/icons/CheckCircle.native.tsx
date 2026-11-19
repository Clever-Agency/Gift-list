import { themed, type IconProps } from "@tamagui/helpers-icon";
import { memo, type JSX } from "react";
import { Circle, Path, Svg, type SvgProps } from "react-native-svg";

/**
 * The Lucide `CircleCheck` glyph on `react-native-svg`, built like the other native
 * twins (see `Star.native.tsx`). Wrapped in a named function so React DevTools shows
 * `CheckCircle`; the web twin in `CheckCircle.tsx` avoids pulling `react-native-svg`
 * into the browser bundle.
 */
const ThemedCheckCircle = themed(
  memo(function CheckCircleGlyph(props: IconProps) {
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
        <Path d="m9 12 2 2 4-4" stroke={color} />
      </Svg>
    );
  }),
);

export function CheckCircle(props: IconProps): JSX.Element {
  return <ThemedCheckCircle accessible={false} {...props} />;
}

CheckCircle.displayName = "CheckCircle";
