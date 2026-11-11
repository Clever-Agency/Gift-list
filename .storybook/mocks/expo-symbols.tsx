import { View, type StyleProp, type ViewStyle } from "react-native";

/**
 * The app draws its icons with `expo-symbols`, which loads a Material Symbols
 * font through `expo-font` and a native module. Neither exists in a web catalog,
 * so icons become a neutral outlined square in the tone the app would paint: the
 * word next to an icon carries the meaning (`DESIGN.md` → VisibilityChip), and a
 * fake glyph would claim a shape the catalog cannot guarantee.
 */

type SymbolViewProps = {
  name?: unknown;
  size?: number;
  tintColor?: string;
  style?: StyleProp<ViewStyle>;
  [key: string]: unknown;
};

export function SymbolView({ name: _name, size = 24, tintColor, style, ...rest }: SymbolViewProps) {
  return (
    <View
      {...rest}
      style={[
        {
          width: size,
          height: size,
          borderRadius: Math.max(2, size / 8),
          borderWidth: 1.5,
          borderColor: tintColor ?? "#4f5a51",
        },
        style,
      ]}
    />
  );
}

SymbolView.displayName = "SymbolView";
