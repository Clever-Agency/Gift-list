import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import { formatUnionType, propDoc } from "../../../.storybook/argTypes";
import { BUTTON_TYPES, BUTTON_VARIANTS, Button, type ButtonVariant } from "./button";
import { Text } from "./text";

/** The catalog copy is a fixture, not a product string (`packages/ui` has no translations). */
function noop() {}

/**
 * Hover, press and focus are CSS states Tamagui paints from media queries: hover the
 * button, hold it, press Tab. A mouse click leaves no ring (`:focus-visible` only);
 * a phone paints the same `$ring` on `focus` (W12.9). On hover the fill of `primary`, `reserve` and
 * `destructive` darkens by 8% (`primary-hover`, `accent-hover`,
 * `destructive-hover` in `DESIGN.md` → Colors); `secondary` darkens its frame and
 * `ghost` takes the `muted` fill. A disabled or busy button keeps its 40% / 60% dim
 * and does not react to hover or press at all (`DESIGN.md` → Состояния кнопок,
 * DECISION 2026-11-10): it is painted by a variant value without those states. A
 * busy button also shows the 16 px spinner (`UI/Spinner`) in a slot centred over
 * the frame: the paddings stay the resting ones and the label keeps its place at
 * opacity 0, so neither the width nor the height jumps (`t343u`, `t344u`).
 */
const meta = {
  title: "UI/Button",
  component: Button,
  // Autodocs renders the Docs page of this one component; the description below is
  // the page itself, so every statement comes from `button.tsx` and `DESIGN.md`.
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The shared button of the app and the Next pages. On the web it is a real \`<button>\`; on a phone the same component renders through React Native.

**Rules**
- \`label\` is required. It is the accessible name unless \`ariaLabel\` says more; while busy it stays in the layout but is drawn at opacity 0 under the spinner.
- A blocked button (\`disabled\` or \`busy\`) keeps its resting look: no hover, no press. Blocking swaps the variant for a copy without those states; \`disabled\` dims to 40%, \`busy\` to 60%.
- \`busy\` keeps the resting paddings and the resting width: the label stays in the row at opacity 0 and a 16 px spinner is centred over the button in an absolute slot. It takes no second press, is announced with \`aria-busy\`, and stays in the Tab order. While busy the web \`type\` is reset to \`button\`, so a form is not submitted twice.
- \`disabled\` is a native disabled button and leaves the Tab order (\`tabIndex=-1\`). \`focusableWhenDisabled\` keeps it in the Tab order and uses \`aria-disabled\` instead; it still takes no press.
- Height follows the variant, not a prop: \`primary\`, \`reserve\`, \`secondary\` and \`destructive\` are at least 48 px tall (\`$control-height\`); \`ghost\` is at least 44 × 44 px (\`$touch-target\`). There is no \`size\` prop.
- \`fullWidth\` stretches the button to its parent; the row stays centred.
- Hover, press and focus are CSS states (media queries), not props.

| \`disabled\` | \`busy\` | \`focusableWhenDisabled\` | Result |
| --- | --- | --- | --- |
| — | — | — | Live: a press calls \`onPress\`; hover and press paint. |
| \`true\` | — | — | Native \`disabled\`, \`tabIndex=-1\`, \`aria-disabled\`, 40% opacity, no hover or press. |
| \`true\` | — | \`true\` | \`aria-disabled\` instead of \`disabled\`, stays in the Tab order, 40%, no press. |
| — | \`true\` | — | \`aria-busy\`, stays in the Tab order, 60%, centred spinner over the hidden label, same paddings and width, no press and no submit. |

**Visual states** (CSS, live button only)

| Variant | Resting | Hover | Press |
| --- | --- | --- | --- |
| \`primary\` | \`$primary\` fill | \`$primary-hover\` (8% darker) | 90% opacity |
| \`reserve\` | \`$accent\` fill | \`$accent-hover\` | 90% opacity |
| \`secondary\` | \`$surface\` fill, \`$border-strong\` border | \`$foreground\` border | 90% opacity |
| \`ghost\` | transparent | \`$muted\` fill | \`$muted\` fill |
| \`destructive\` | \`$destructive\` fill | \`$destructive-hover\` | 90% opacity |

**Accessibility**
- A real \`<button>\` on the web. The accessible name is \`aria-label\`, which defaults to \`label\`.
- \`aria-describedby\` links the button to the visible text that explains why it is disabled.
- \`aria-disabled\` is set whenever the button is blocked; \`aria-busy\` only while busy.
- The spinner is decorative (\`aria-hidden\`); \`aria-busy\` announces the wait. The label hidden at opacity 0 stays in the tree but is not a second name: \`aria-label\` is the only one.
- The touch target is at least 44 px; the filled variants are also 48 px tall.
- Reduced motion: the spinner stops as a static ring and \`aria-busy\` still announces the wait; its fade shortens to 100 ms (\`reduceFade\`).

**Web vs native**
- \`type="submit"\` submits its form in the browser; a phone ignores it.
- React Native has no \`currentColor\` inheritance, so the spinner takes the label token as a value.
- Focus paints \`$ring\` on \`:focus-visible\` on the web and on \`focus\` on a phone.
        `.trim(),
      },
    },
  },
  argTypes: {
    label: propDoc({
      description:
        "The text and the accessible name. Required: the busy spinner never replaces the label, it only covers it while the label keeps its room.",
      type: "string",
      required: true,
      control: "text",
    }),
    ariaLabel: propDoc({
      description:
        "The accessible name when it has to say more than the visible label, e.g. a disabled button's reason. Defaults to `label`.",
      type: "string",
      control: "text",
    }),
    ariaDescribedBy: propDoc({
      description: "The id of the visible text that explains a disabled button.",
      type: "string",
      control: "text",
    }),
    onPress: propDoc({
      description: "Called on a real press. Never called while the button is `disabled` or `busy`.",
      type: "() => void",
      control: false,
    }),
    variant: propDoc({
      description:
        "Visual style of the button. `reserve` is only «Куплю сам» and «Подтвердить» in the reservation confirm.",
      type: formatUnionType(BUTTON_VARIANTS),
      options: BUTTON_VARIANTS,
      defaultValue: "primary",
    }),
    disabled: propDoc({
      description:
        "Does not take a press and is announced as disabled; dims to 40% and leaves the Tab order unless `focusableWhenDisabled` is set.",
      type: "boolean",
      defaultValue: "false",
    }),
    focusableWhenDisabled: propDoc({
      description:
        "Keeps a disabled button in the Tab order (`aria-disabled` instead of the `disabled` attribute), so a keyboard user can find it and read why. It still takes no press.",
      type: "boolean",
      defaultValue: "false",
    }),
    busy: propDoc({
      description:
        "The action is running: dims to 60%, is announced busy, takes no second press and does not submit a form. A 16 px spinner is centred over the hidden label; the paddings and the width stay those of the resting button.",
      type: "boolean",
      defaultValue: "false",
    }),
    fullWidth: propDoc({
      description:
        "Stretches the button to its parent's width; the label stays centred and the busy spinner sits centred over it.",
      type: "boolean",
      defaultValue: "false",
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
    type: propDoc({
      description: "`submit` makes the web button submit its form; a phone ignores it. Reset to `button` while blocked.",
      type: formatUnionType(BUTTON_TYPES),
      options: BUTTON_TYPES,
      defaultValue: "button",
    }),
  },
  args: {
    label: "Добавить желание",
    onPress: noop,
    variant: "primary",
    disabled: false,
    focusableWhenDisabled: false,
    busy: false,
    fullWidth: false,
    type: "button",
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The canvas of the Docs page and the place to turn the props: every public prop
 * has a control (`argTypes`), and the code is the one the apps run. Start here,
 * then look at the matrix below for every variant and state at once.
 */
export const Playground: Story = {};

/** The catalogue label of each variant, the same fixtures the app screens show. */
const VARIANT_LABELS: Record<ButtonVariant, string> = {
  primary: "Добавить желание",
  reserve: "Куплю сам",
  secondary: "Отмена",
  ghost: "Поделиться",
  destructive: "Удалить желание",
};

/** The states the matrix shows for every public variant (`DESIGN.md` → Состояния кнопок). */
const MATRIX_STATES = [
  { caption: "Rest", disabled: false, busy: false },
  { caption: "Disabled", disabled: true, busy: false },
  { caption: "Busy", disabled: false, busy: true },
] as const;

/**
 * Every public variant × state at 360 px: the five variants in a row per state, the
 * same label repeated so the rows can be compared. Height comes from the variant:
 * `ghost` is the 44 px touch target, the filled variants are 48 px tall. `disabled`
 * dims to 40% and leaves the Tab order, `busy` dims to 60%, hides the label under a
 * centred 16 px spinner and keeps the paddings and the width of the resting button.
 * The internal `*Blocked` values are not part of the public API and are not offered
 * as options. Hover and press are CSS states: hover a live button to see the fill
 * change.
 */
export const AllVariants: Story = {
  name: "All variants",
  render: function AllVariantsStory() {
    return (
      <YStack width={360} gap="$4" alignItems="flex-start">
        {MATRIX_STATES.map((state) => (
          <YStack key={state.caption} gap="$2" alignItems="flex-start">
            <Text kind="caption" tone="muted">
              {state.caption}
            </Text>
            {BUTTON_VARIANTS.map((variant) => (
              <Button
                key={variant}
                label={VARIANT_LABELS[variant]}
                variant={variant}
                disabled={state.disabled}
                busy={state.busy}
                onPress={noop}
              />
            ))}
          </YStack>
        ))}
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/**
 * `focusableWhenDisabled` keeps a disabled button in the Tab order, so a keyboard
 * user can reach it and hear the reason linked with `aria-describedby`. Tab to the
 * button: the focus ring appears, the press still does nothing.
 */
export const FocusableWhenDisabled: Story = {
  name: "Focusable when disabled",
  render: function FocusableWhenDisabledStory() {
    return (
      <YStack gap="$2" alignItems="flex-start">
        <Text kind="caption" tone="muted" id="save-disabled-reason">
          Сначала выберите вишлист
        </Text>
        <Button
          label="Сохранить"
          onPress={noop}
          disabled
          focusableWhenDisabled
          ariaDescribedBy="save-disabled-reason"
        />
      </YStack>
    );
  },
};

/**
 * `fullWidth` stretches the button to its parent; the spinner and the label stay
 * centred. Hover and press are CSS states Tamagui paints from media queries; hover
 * the button or hold it to see them. There is no prop that forces them.
 */
export const PrimaryFullWidth: Story = {
  name: "Full width",
  args: { variant: "primary", fullWidth: true },
};

/**
 * The same content-sized button at rest and busy, one under the other: the two
 * widths are equal. Busy keeps the paddings (`t343u`): the label stays in the row
 * at opacity 0 and holds its place, while the 16 px spinner is centred over the
 * button in an absolute slot (`t344u`). Nothing shifts when the state flips.
 *
 * «Уменьшить движение» has no emulation addon here: turn the OS setting on or pick
 * `prefers-reduced-motion: reduce` in DevTools → Rendering → Emulate CSS media
 * feature. The arc then stops turning and stays a static ring, its fade shortens to
 * 100 ms, and the wait is still announced by `aria-busy` (`DESIGN.md` → Движение).
 */
export const BusyKeepsWidth: Story = {
  name: "Busy keeps width",
  render: function BusyKeepsWidthStory() {
    return (
      <YStack gap="$3" alignItems="flex-start">
        <YStack gap="$2" alignItems="flex-start">
          <Text kind="caption" tone="muted">
            Rest
          </Text>
          <Button label="Добавить желание" variant="primary" onPress={noop} />
        </YStack>
        <YStack gap="$2" alignItems="flex-start">
          <Text kind="caption" tone="muted">
            Busy
          </Text>
          <Button label="Добавить желание" variant="primary" onPress={noop} busy />
        </YStack>
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
