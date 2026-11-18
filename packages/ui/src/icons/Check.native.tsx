import { themed, type IconProps } from "@tamagui/helpers-icon";
import { memo, type JSX } from "react";
import { Path, Svg, type SvgProps } from "react-native-svg";

/**
 * The Lucide `Check` glyph on `react-native-svg`, built like the other native twins
 * (see `Star.native.tsx`). Wrapped in a named function so React DevTools shows
 * `Check`; the web twin in `Check.tsx` avoids pulling `react-native-svg` into the
 * browser bundle.
 */
const ThemedCheck = themed(
  memo(function CheckGlyph(props: IconProps) {
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
        <Path d="M20 6 9 17l-5-5" stroke={color} />
      </Svg>
    );
  }),
);

export function Check(props: IconProps): JSX.Element {
  return <ThemedCheck accessible={false} {...props} />;
}

Check.displayName = "Check";
