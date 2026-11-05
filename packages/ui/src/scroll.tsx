import { ScrollView as TamaguiScrollView } from "@tamagui/scroll-view";

/**
 * A scrolling area: a `div` with `overflow` on the web, the native ScrollView on the
 * phone. Layout props are Tamagui props; `contentContainerStyle` takes plain values.
 */
export const ScrollView = TamaguiScrollView;
export type { ScrollViewProps } from "@tamagui/scroll-view";
