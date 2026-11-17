import { spinnerA11yProps } from "./spinner-a11y";
import { SPINNER_PERIOD_MS, SPINNER_SIZE } from "./spinner-motion";
import { useReduceMotion } from "./use-reduce";

export type SpinnerProps = {
  /** Edge of the square box; `DESIGN.md` → busy: 16 px. */
  size?: number;
  /**
   * The colour of the arcs. `currentColor` follows the text around the spinner;
   * `Button` passes the label token of its variant as a value, because the
   * indicator is drawn over the button fill rather than inside its text.
   */
  color?: string;
  /** A stable hook for tests; the drawing is decorative, so it has no other handle. */
  testID?: string;
};

/**
 * The waiting indicator of `DESIGN.md` → Состояния кнопок → busy: the Lucide
 * `LoaderCircle` arc (the same glyph family as `src/icons`), 16 px, in the
 * colour of the label, turning linearly. With «уменьшить движение»
 * (`useReduceMotion`) the arc does not turn at all — the state is still
 * announced by the button's `aria-busy`, as DESIGN.md:407 asks.
 *
 * Web half. The phone twin is `spinner.native.tsx`: `react-native-svg` has no
 * SMIL, so the rotation there is a native `Animated` loop; the size, the period
 * and the a11y props come from the same modules.
 *
 * The rotation is an SVG `<animateTransform>` rather than a CSS `@keyframes`
 * animation: the project has no global stylesheet of its own (`packages/ui`
 * ships sources only), a keyframes rule would have to be injected document-wide
 * from the component, while SMIL travels with the markup, adds no dependency,
 * and the reduce branch stays a plain React condition in both runtimes.
 */
export function Spinner({ size = SPINNER_SIZE, color = "currentColor", testID = "spinner" }: SpinnerProps) {
  const reduce = useReduceMotion();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      // `color` on this element is what the arcs' `currentColor` resolves to.
      style={{ color, display: "block" }}
      {...spinnerA11yProps()}
      focusable="false"
      data-testid={testID}
    >
      <g>
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        {reduce ? null : (
          <animateTransform
            attributeName="transform"
            attributeType="XML"
            type="rotate"
            from="0 12 12"
            to="360 12 12"
            dur={`${SPINNER_PERIOD_MS}ms`}
            calcMode="linear"
            repeatCount="indefinite"
          />
        )}
      </g>
    </svg>
  );
}

Spinner.displayName = "Spinner";
