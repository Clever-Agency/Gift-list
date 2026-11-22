import { themed, type IconProps } from "@tamagui/helpers-icon";
import { memo, type JSX } from "react";
import { Path, Rect, Svg, type SvgProps } from "react-native-svg";

/**
 * The Lucide `CalendarCheck` glyph for the phone. Wrapped in a named function so
 * React DevTools shows `CalendarCheck`; the web twin in `CalendarCheck.tsx`
 * avoids pulling `react-native-svg` into the browser bundle.
 */
const ThemedCalendarCheck = themed(
  memo(function CalendarCheckGlyph(props: IconProps) {
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
        <Path d="M8 2v4" stroke={color} />
        <Path d="M16 2v4" stroke={color} />
        <Rect width={18} height={18} x={3} y={4} rx={2} stroke={color} />
        <Path d="M3 10h18" stroke={color} />
        <Path d="m9 16 2 2 4-4" stroke={color} />
      </Svg>
    );
  }),
);

export function CalendarCheck(props: IconProps): JSX.Element {
  return <ThemedCalendarCheck accessible={false} {...props} />;
}

CalendarCheck.displayName = "CalendarCheck";
