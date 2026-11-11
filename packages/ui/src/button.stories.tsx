import type { Meta, StoryObj } from "@storybook/react";
import { XStack, YStack } from "@tamagui/stacks";
import { formatUnionType, propDoc } from "../../../.storybook/argTypes";
import { BUTTON_TYPES, BUTTON_VARIANTS, Button } from "./button";
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
 * busy button also shows the 16 px spinner right before its label, inside the same
 * row (`UI/Spinner`, W12.8): the paddings shrink by the room the spinner and its
 * 8 px gap take, so the width does not change.
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
- \`label\` is required and always visible. It is also the accessible name unless \`ariaLabel\` says more.
- A blocked button (\`disabled\` or \`busy\`) keeps its resting look: no hover, no press. Blocking swaps the variant for a copy without those states; \`disabled\` dims to 40%, \`busy\` to 60%.
- \`busy\` adds a 16 px spinner before the label in the same row instead of replacing the text. It takes no second press, is announced with \`aria-busy\`, and stays in the Tab order. While busy the web \`type\` is reset to \`button\`, so a form is not submitted twice.
- \`disabled\` is a native disabled button and leaves the Tab order (\`tabIndex=-1\`). \`focusableWhenDisabled\` keeps it in the Tab order and uses \`aria-disabled\` instead; it still takes no press.
- Height follows the variant, not a prop: \`primary\`, \`reserve\`, \`secondary\` and \`destructive\` are at least 48 px tall (\`$control-height\`); \`ghost\` is at least 44 × 44 px (\`$touch-target\`). There is no \`size\` prop.
- \`fullWidth\` stretches the button to its parent; the row stays centred.
- Hover, press and focus are CSS states (media queries), not props.

| \`disabled\` | \`busy\` | \`focusableWhenDisabled\` | Result |
| --- | --- | --- | --- |
| — | — | — | Live: a press calls \`onPress\`; hover and press paint. |
| \`true\` | — | — | Native \`disabled\`, \`tabIndex=-1\`, \`aria-disabled\`, 40% opacity, no hover or press. |
| \`true\` | — | \`true\` | \`aria-disabled\` instead of \`disabled\`, stays in the Tab order, 40%, no press. |
| — | \`true\` | — | \`aria-busy\`, stays in the Tab order, 60%, spinner, no press and no submit. |

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
- The spinner is decorative (\`aria-hidden\`); \`aria-busy\` announces the wait.
- The touch target is at least 44 px; the filled variants are also 48 px tall.
- Reduced motion: the spinner stops as a static ring and \`aria-busy\` still announces the wait.

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
        "The visible text and the accessible name. Required: a button always shows its label, the busy spinner never replaces it.",
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
        "The action is running: dims to 60%, is announced busy, takes no second press and does not submit a form. The 16 px spinner sits before the label.",
      type: "boolean",
      defaultValue: "false",
    }),
    fullWidth: propDoc({
      description: "Stretches the button to its parent's width; the spinner and the label stay centred.",
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

/** `primary`: the one action of a screen. Hover it: the fill goes to `primary-hover`, 8.04:1 for the label. */
export const Primary: Story = {
  args: { variant: "primary" },
};

export const PrimaryDisabled: Story = {
  args: { variant: "primary", disabled: true },
};

export const PrimaryBusy: Story = {
  args: { variant: "primary", busy: true },
};

/** `secondary`: a side action next to the primary one. */
export const Secondary: Story = {
  args: { variant: "secondary", label: "Отмена" },
};

export const SecondaryDisabled: Story = {
  args: { variant: "secondary", label: "Отмена", disabled: true },
};

export const SecondaryBusy: Story = {
  args: { variant: "secondary", label: "Отмена", busy: true },
};

/** `ghost`: a quiet action, e.g. a secondary control inside a card. */
export const Ghost: Story = {
  args: { variant: "ghost", label: "Поделиться" },
};

export const GhostDisabled: Story = {
  args: { variant: "ghost", label: "Поделиться", disabled: true },
};

export const GhostBusy: Story = {
  args: { variant: "ghost", label: "Поделиться", busy: true },
};

/** `reserve`: only «Куплю сам» and «Подтвердить» in the reservation confirm. Hover: `accent-hover`, 5.65:1. */
export const Reserve: Story = {
  args: { variant: "reserve", label: "Куплю сам" },
};

export const ReserveDisabled: Story = {
  args: { variant: "reserve", label: "Куплю сам", disabled: true },
};

export const ReserveBusy: Story = {
  args: { variant: "reserve", label: "Куплю сам", busy: true },
};

/** `destructive`: an action that cannot be undone. Hover: `destructive-hover`, 7.40:1. */
export const Destructive: Story = {
  args: { variant: "destructive", label: "Удалить желание" },
};

export const DestructiveDisabled: Story = {
  args: { variant: "destructive", label: "Удалить желание", disabled: true },
};

export const DestructiveBusy: Story = {
  args: { variant: "destructive", label: "Удалить желание", busy: true },
};

/**
 * Every public variant side by side at 360 px. Height comes from the variant:
 * `ghost` is the 44 px touch target, the filled variants are 48 px tall. The
 * internal `*Blocked` values are not part of the public API and are not offered
 * as options.
 */
export const AllVariants: Story = {
  render: function AllVariantsStory() {
    return (
      <YStack width={360} gap="$3" alignItems="flex-start">
        <Button label="Добавить желание" variant="primary" onPress={noop} />
        <Button label="Куплю сам" variant="reserve" onPress={noop} />
        <Button label="Отмена" variant="secondary" onPress={noop} />
        <Button label="Поделиться" variant="ghost" onPress={noop} />
        <Button label="Удалить желание" variant="destructive" onPress={noop} />
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
 * Hover and press are CSS states Tamagui paints from media queries; hover the button
 * or hold it to see them. There is no prop that forces them.
 */
export const PrimaryFullWidth: Story = {
  args: { variant: "primary", fullWidth: true },
};

/**
 * Every variant in the `busy` state at 360 px (`DESIGN.md` → busy): the 16 px
 * spinner sits right before the label, in the label colour of the variant, and the
 * button keeps the width it has at rest — the spinner joins the button's own row
 * and the horizontal paddings shrink from 16 to 4 px, exactly the 16 + 8 px the
 * spinner and its gap take (W12.8, W12.8-fix). On a stretched button the group
 * stays centred, so the indicator is next to the text rather than at the edge.
 * The last button has the longest Cyrillic label of the app.
 *
 * «Уменьшить движение» has no emulation addon here: turn the OS setting on or pick
 * `prefers-reduced-motion: reduce` in DevTools → Rendering → Emulate CSS media
 * feature. The arc then stops turning and stays a static ring, the wait is still
 * announced by `aria-busy` (`DESIGN.md` → Движение).
 */
export const BusyMatrixNarrow: Story = {
  render: function BusyMatrixNarrowStory() {
    return (
      <YStack width={360} gap="$3">
        <Button label="Сохраняем…" variant="primary" onPress={noop} busy />
        <Button label="Бронируем…" variant="reserve" onPress={noop} busy />
        <Button label="Сохраняем…" variant="secondary" onPress={noop} busy />
        <Button label="Поделиться" variant="ghost" onPress={noop} busy />
        <Button label="Удаляем…" variant="destructive" onPress={noop} busy />
        <Button label="Сохранить изменения в вишлисте" variant="primary" onPress={noop} busy />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/**
 * The same content-sized button at rest and busy, side by side: the two widths are
 * equal. The spinner joins the row before the label and the paddings go 16 → 4 px
 * on each side, which is exactly the 16 px spinner plus the 8 px gap (W12.8-fix).
 * The label shifts 12 px to the right; the button's own box does not change.
 */
export const BusyKeepsWidth: Story = {
  render: function BusyKeepsWidthStory() {
    return (
      <XStack gap="$3" alignItems="center">
        <Button label="Добавить желание" variant="primary" onPress={noop} />
        <Button label="Добавить желание" variant="primary" onPress={noop} busy />
      </XStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/**
 * The three hover fills side by side at 360 px: hover each button in turn —
 * `primary` `#2F5D3A` → `primary-hover` `#2B5635`, `reserve` `#D4A017` →
 * `accent-hover` `#C39315`, `destructive` `#B42318` → `destructive-hover` `#A62016`.
 * The rows under them show the same fills dimmed by `disabled` and `busy`: hover and
 * hold those — the fill stays as it is (DECISION 2026-11-10, t312u).
 */
export const HoverMatrixNarrow: Story = {
  render: function HoverMatrixNarrowStory() {
    return (
      <YStack width={360} gap="$3">
        <XStack gap="$2" flexWrap="wrap">
          <Button label="Сохранить" variant="primary" onPress={noop} />
          <Button label="Куплю сам" variant="reserve" onPress={noop} />
          <Button label="Удалить" variant="destructive" onPress={noop} />
        </XStack>
        <XStack gap="$2" flexWrap="wrap">
          <Button label="Сохранить" variant="primary" onPress={noop} disabled />
          <Button label="Куплю сам" variant="reserve" onPress={noop} disabled />
          <Button label="Удалить" variant="destructive" onPress={noop} disabled />
        </XStack>
        <XStack gap="$2" flexWrap="wrap">
          <Button label="Сохраняем…" variant="primary" onPress={noop} busy />
          <Button label="Бронируем…" variant="reserve" onPress={noop} busy />
          <Button label="Удаляем…" variant="destructive" onPress={noop} busy />
        </XStack>
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
