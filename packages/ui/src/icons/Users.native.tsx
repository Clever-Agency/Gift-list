import { themed, type IconProps } from "@tamagui/helpers-icon";
import { memo, type JSX } from "react";
import { Circle, Path, Svg, type SvgProps } from "react-native-svg";

/**
 * The Lucide `Users` glyph for the phone. Wrapped in a named function so React
 * DevTools shows `Users`; the web twin in `Users.tsx` avoids pulling
 * `react-native-svg` into the browser bundle.
 */
const ThemedUsers = themed(
  memo(function UsersGlyph(props: IconProps) {
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
        <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke={color} />
        <Circle cx="9" cy="7" r="4" stroke={color} />
        <Path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke={color} />
        <Path d="M16 3.13a4 4 0 0 1 0 7.75" stroke={color} />
      </Svg>
    );
  }),
);

export function Users(props: IconProps): JSX.Element {
  return <ThemedUsers accessible={false} {...props} />;
}

Users.displayName = "Users";
