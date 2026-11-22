import { themed, type IconProps } from "@tamagui/helpers-icon";
import { memo, type JSX } from "react";
import { Circle, Path, Svg, type SvgProps } from "react-native-svg";

/**
 * The Lucide `User` glyph for the phone. Wrapped in a named function so React
 * DevTools shows `User`; the web twin in `User.tsx` avoids pulling
 * `react-native-svg` into the browser bundle.
 */
const ThemedUser = themed(
  memo(function UserGlyph(props: IconProps) {
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
        <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" stroke={color} />
        <Circle cx="12" cy="7" r="4" stroke={color} />
      </Svg>
    );
  }),
);

export function User(props: IconProps): JSX.Element {
  return <ThemedUser accessible={false} {...props} />;
}

User.displayName = "User";
