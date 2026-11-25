import { themed, type IconProps } from "@tamagui/helpers-icon";
import { Path, Svg, type SvgProps } from "react-native-svg";

const ThemedBell = Object.assign(themed(function BellGlyph(props: IconProps) {
  const { size = 24, color = "black" } = props as SvgProps & { size?: number; color?: string };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" accessible={false}
    >
      <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </Svg>
  );
}), { displayName: "ThemedBell" });

export function Bell(props: IconProps) {
  return <ThemedBell {...props} />;
}

Bell.displayName = "Bell";
