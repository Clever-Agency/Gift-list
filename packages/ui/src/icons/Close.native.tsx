import { themed, type IconProps } from "@tamagui/helpers-icon";
import { memo, type JSX } from "react";
import { Path, Svg, type SvgProps } from "react-native-svg";

/**
 * The Lucide `X` glyph for the phone: the clear button of `SearchField`. The
 * web twin in `Close.tsx` avoids pulling `react-native-svg` into the browser
 * bundle.
 */
const ThemedClose = themed(
  memo(function CloseGlyph(props: IconProps) {
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
        <Path d="M18 6 6 18" stroke={color} />
        <Path d="m6 6 12 12" stroke={color} />
      </Svg>
    );
  }),
);

export function Close(props: IconProps): JSX.Element {
  return <ThemedClose accessible={false} {...props} />;
}

Close.displayName = "Close";
