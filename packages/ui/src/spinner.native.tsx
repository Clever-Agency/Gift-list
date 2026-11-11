import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import { Path, Svg } from "react-native-svg";
import { spinnerA11yProps } from "./spinner-a11y";
import { SPINNER_PERIOD_MS, SPINNER_SIZE } from "./spinner-motion";
import { colors } from "./tokens";
import { useReduceMotion } from "./use-reduce";

export type SpinnerProps = {
  /** Edge of the square box; `DESIGN.md` → busy: 16 px. */
  size?: number;
  /**
   * The colour of the arc. The phone has no CSS `currentColor`: the value is
   * handed in, `Button` passes the label token of its variant. A standalone
   * spinner falls back to the `foreground` token, the colour of the text
   * around it on the web.
   */
  color?: string;
  /** A stable hook for tests; the drawing is decorative, so it has no other handle. */
  testID?: string;
};

/**
 * The waiting indicator of `DESIGN.md` → Состояния кнопок → busy, phone half.
 *
 * Same glyph (`LoaderCircle`), size and a11y intent as `spinner.tsx`; only the
 * rotation differs: `react-native-svg` has no SMIL, so the whole `Svg` is turned
 * by a native `Animated` loop on the UI thread (`useNativeDriver`), linearly and
 * without a jump between turns. With «уменьшить движение» (`useReduceMotion`,
 * read from `AccessibilityInfo` by the Tamagui media driver) the loop never
 * starts and the arc stands still; the button's `aria-busy` still announces the
 * wait (`DESIGN.md`:407).
 */
export function Spinner({
  size = SPINNER_SIZE,
  color = colors.foreground,
  testID = "spinner",
}: SpinnerProps) {
  const reduce = useReduceMotion();
  const turn = useRef(new Animated.Value(0)).current;

  useEffect(
    function turnWhileBusy() {
      if (reduce) {
        turn.setValue(0);
        return;
      }
      const loop = Animated.loop(
        Animated.timing(turn, {
          toValue: 1,
          duration: SPINNER_PERIOD_MS,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return function stopTurning() {
        loop.stop();
      };
    },
    [reduce, turn],
  );

  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Animated.View
      style={{ width: size, height: size, transform: [{ rotate }] }}
      testID={testID}
      {...spinnerA11yProps()}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M21 12a9 9 0 1 1-6.219-8.56"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}

Spinner.displayName = "Spinner";
