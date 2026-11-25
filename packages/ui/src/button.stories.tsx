import type { Meta, StoryObj } from "@storybook/react";
import { XStack, YStack } from "@tamagui/stacks";
import { formatUnionType, propDoc } from "../../../.storybook/argTypes";
import {
  BUTTON_TYPES,
  BUTTON_VARIANTS,
  Button,
  type ButtonIconShape,
  type ButtonIconSize,
  type ButtonProps,
  type ButtonVariant,
} from "./button";
import { Check, Close, Info, Star } from "./icons";
import { InfoButton } from "./info-button";
import { Text } from "./text";

/** The catalog copy is a fixture, not a product string (`packages/ui` has no translations). */
function noop() {}

const ICON_SIZES = ["md", "sm"] as const satisfies readonly ButtonIconSize[];
const ICON_SHAPES = ["square", "round"] as const satisfies readonly ButtonIconShape[];

/**
 * Hover, press and focus are CSS states Tamagui paints from media queries: hover the
 * button, hold it, press Tab. A mouse click leaves no ring (`:focus-visible` only);
 * a phone paints the same `$ring` on `focus` (W12.9). On hover the fill of `primary`,
 * `reserve` and `destructive` darkens by 8% (`primary-hover`, `accent-hover`,
 * `destructive-hover` in `DESIGN.md` → Colors); `secondary` is the calm violet fill —
 * a translucent `accent-soft` (18 % of accent.8) that lifts to `accent-soft-hover`
 * (27 %) with its `accent-border` frame; `outline` takes the `muted` fill and a
 * `foreground` frame, `ghost` takes the `muted` fill. A disabled or
 * busy button keeps its 40% / 60% dim and does not react to hover or press at all
 * (`DESIGN.md` → Состояния кнопок, DECISION 2026-11-10): it is painted by a variant
 * value without those states. A busy button also shows the 16 px spinner
 * (`UI/Spinner`) in a slot centred over the frame: the paddings stay the resting ones
 * and the label keeps its place at opacity 0, so neither the width nor the height
 * jumps (`t343u`, `t344u`).
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
The shared button of the app and the Next pages. On the web it is a real \`<button>\`; with \`href\` it is a real \`<a href>\` with the same look, and on a phone the same component renders through React Native.

With \`icon\` the same button is the icon-only control of v8 (this is what \`IconButton\` wraps): the label is not drawn but stays the accessible name, the 44 × 44 target is transparent, and the box inside carries the look — \`outline\` keeps the 1 px \`$border\` frame, \`ghost\` drops it (the old \`plain\`), \`primary\` is the filled accept action. The explanatory «i» trigger (\`InfoButton\`) keeps its tooltip or dialog: it is shown below as a ready control, not as a Button prop.

The rules of each prop are in the table below. What is not a prop:

- No \`size\` prop for text: the height follows the \`variant\`. \`iconSize\` and \`shape\` only shape the box of an icon-only button.
- Hover, press and focus are CSS states (media queries), not props.
- Focus paints a 2 px \`$ring\`: \`:focus-visible\` on the web, \`focus\` on a phone (external keyboard, TalkBack/VoiceOver).
- The busy spinner is decorative (\`aria-hidden\`); \`aria-busy\` announces the wait.
- The touch target is at least 44 px, for a text and for an icon-only button.
- Reduced motion: the spinner stops as a static ring, and its fade shortens to 100 ms (\`reduceFade\`).
- React Native has no \`currentColor\`, so the spinner takes the label token as a value and matches the label in both themes. The icon box passes \`currentColor\` down to the glyph, so the icon inks with the box colour.
        `.trim(),
      },
    },
  },
  argTypes: {
    label: propDoc({
      description:
        "The visible text and the accessible name (unless `ariaLabel` says more). Required; the copy comes from the caller. While `busy` the label stays in the layout at opacity 0 under the spinner, so the width does not change. With `icon` it is not drawn: it is the accessible name only.",
      type: "string",
      required: true,
      control: "text",
    }),
    icon: propDoc({
      description:
        "An icon instead of the visible label: the button becomes the icon-only control — a 44 × 44 transparent target with the icon box inside. `label` stays the accessible name; the glyph is the picture. The catalog shows it with the «только иконка» handle and a ready `Star`.",
      type: "ReactNode",
      control: false,
    }),
    iconSize: propDoc({
      description:
        "The drawn box of an icon-only button: `md` is 44 × 44 (the default), `sm` is a 32 × 32 box inside the same 44 px target. Ignored by a text button.",
      type: formatUnionType(ICON_SIZES),
      options: ICON_SIZES,
      defaultValue: "md",
    }),
    shape: propDoc({
      description:
        "`square` (radius 8, the default) or `round` (a circle). Icon-only mode only: a text button keeps its radius.",
      type: formatUnionType(ICON_SHAPES),
      options: ICON_SHAPES,
      defaultValue: "square",
    }),
    ariaLabel: propDoc({
      description:
        "The accessible name (`aria-label`) when it has to say more than the visible label, e.g. a disabled button's reason. Defaults to `label`; the label hidden under the busy spinner is not a second name.",
      type: "string",
      control: "text",
    }),
    ariaDescribedBy: propDoc({
      description:
        "The id of visible text that explains why the button is disabled; reaches the web DOM as `aria-describedby`.",
      type: "string",
      control: "text",
    }),
    onPress: propDoc({
      description: "Called on a live press only — never while `disabled` or `busy`.",
      type: "() => void",
      control: false,
    }),
    variant: propDoc({
      description: `Visual style and height. \`primary\`, \`reserve\`, \`secondary\`, \`outline\` and \`destructive\` are at least 48 px tall (\`$control-height\`); \`ghost\` is at least 44 × 44 px (\`$touch-target\`). There is no \`size\` prop.

- \`primary\` — \`$primary\` fill → hover \`$primary-hover\` (8% darker) → press 90% opacity
- \`reserve\` — the same solid CTA as \`primary\` (only «Куплю сам» / «Подтвердить»)
- \`secondary\` — translucent \`$accent-soft\` fill with \`$accent-border\` frame → hover \`$accent-soft-hover\` → press 90% opacity
- \`outline\` — transparent with \`$border-strong\` frame → hover \`$muted\` fill and \`$foreground\` frame → press \`$muted\`
- \`ghost\` — transparent → hover \`$muted\` fill → press \`$muted\` fill
- \`destructive\` — \`$destructive\` fill → hover \`$destructive-hover\` → press 90% opacity

An icon-only button paints the same values on its box; \`outline\` there takes the 1 px \`$border\` token (the frame of an icon button), and \`ghost\` is the old borderless \`plain\`.`,
      type: formatUnionType(BUTTON_VARIANTS),
      options: BUTTON_VARIANTS,
      defaultValue: "primary",
    }),
    disabled: propDoc({
      description:
        "Native disabled button: leaves the Tab order (`tabIndex=-1`), is announced with `aria-disabled`, dims to 40%, and takes no hover or press — a blocked button keeps its resting look.",
      type: "boolean",
      defaultValue: "false",
    }),
    focusableWhenDisabled: propDoc({
      description:
        "Keeps a disabled button in the Tab order: `aria-disabled` instead of the `disabled` attribute, 40% opacity, no press.",
      type: "boolean",
      defaultValue: "false",
    }),
    busy: propDoc({
      description:
        "The action is running: keeps the resting paddings and width — the label stays in the row at opacity 0 while a 16 px spinner is centred in an absolute slot over it. Dims to 60%, is announced with `aria-busy`, stays in the Tab order, takes no second press, and on the web `type` is reset to `button` so a form is not submitted twice.",
      type: "boolean",
      defaultValue: "false",
    }),
    fullWidth: propDoc({
      description:
        "Stretches to the parent's width (`align-self: stretch`); the row stays centred, and the busy spinner stays centred over the button.",
      type: "boolean",
      defaultValue: "false",
    }),
    href: propDoc({
      description:
        "A navigation target: on the web the root becomes a real `<a href>` with the same look, so a page action that only navigates (registration, login, a public page) keeps the browser's own click, new tab and context menu. A blocked button stays a `<button>` and ignores the target. A phone has no anchor: the caller hands navigation to the router.",
      type: "string",
      control: "text",
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
    type: propDoc({
      description:
        "`submit` submits the web button's form; a phone ignores it. Reset to `button` while blocked, so a form is not submitted twice.",
      type: formatUnionType(BUTTON_TYPES),
      options: BUTTON_TYPES,
      defaultValue: "button",
    }),
    iconOnly: {
      name: "только иконка",
      description:
        "Ручка каталога: подставить готовый глиф `Star` в `icon` — кнопка становится иконкой без подписи, а `label` остаётся именем для диктора.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
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
    iconSize: "md",
    shape: "square",
    iconOnly: false,
  },
} satisfies Meta<ButtonProps & { iconOnly: boolean }>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The meta props plus the catalog handle «только иконка» (`iconOnly`). */
type ButtonCatalogArgs = ButtonProps & { iconOnly: boolean };

/**
 * The canvas of the Docs page and the place to turn the props: every public prop
 * has a control (`argTypes`), and the code is the one the apps run. The «только
 * иконка» handle swaps the visible label for a ready `Star`, so the icon-only mode
 * of v8 can be tried with the real variants, sizes and shapes. Start here, then
 * look at the matrix below for every variant and state at once.
 */
export const Playground: Story = {
  render: function PlaygroundStory(args) {
    const { iconOnly, ...buttonArgs } = args as ButtonCatalogArgs;
    return (
      <Button
        {...buttonArgs}
        icon={iconOnly ? <Star size={20} /> : undefined}
        testID="button-playground"
      />
    );
  },
};

/** The catalogue label of each variant, the same fixtures the app screens show. */
const VARIANT_LABELS: Record<ButtonVariant, string> = {
  primary: "Добавить желание",
  reserve: "Куплю сам",
  secondary: "Загадать",
  outline: "Поделиться",
  ghost: "Отмена",
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
  // The matrix is a Docs illustration; the sidebar keeps Playground and Busy.
  tags: ["!dev"],
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
  tags: ["!dev"],
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
  tags: ["!dev"],
  args: { variant: "primary", fullWidth: true },
};

/**
 * `href` turns the web root into a real `<a href>` with the same look, so a page
 * action that only opens another page keeps the browser's own click, the new tab
 * and the context menu. The primary variant is a registration link, the ghost one
 * is login: both keep their 48 px and 44 px heights. Hover and press are CSS
 * states, as on a button. A phone has no anchor and hands navigation to the
 * router (`href` alone does not navigate in the app).
 */
export const AsLink: Story = {
  name: "As a link",
  tags: ["!dev"],
  render: function AsLinkStory() {
    return (
      <YStack gap="$3" alignItems="flex-start">
        <Button label="Принять приглашение" href="/register?next=/invite/tok-1" />
        <Button
          label="У меня уже есть аккаунт"
          variant="ghost"
          href="/login?next=/invite/tok-1"
        />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/**
 * The icon-only mode: `label` is not drawn but stays the accessible name, the
 * target is 44 × 44, and the box inside carries the look. `outline` keeps the 1 px
 * `$border` frame, `ghost` drops it (the old `plain`), `primary` is the filled
 * accept action; `disabled` dims to 40% and blocked hover/press stay quiet.
 * `iconSize="sm"` draws a 32 px box — a square or a circle with `shape="round"` —
 * inside the same 44 px target: the answer/decline pair of the friends requests.
 * This is the whole of `IconButton`, which is now a thin wrapper over `Button`.
 */
export const IconOnly: Story = {
  name: "Icon only",
  tags: ["!dev"],
  render: function IconOnlyStory() {
    return (
      <YStack width={360} gap="$4" alignItems="flex-start">
        <YStack gap="$2" alignItems="flex-start">
          <Text kind="caption" tone="muted">
            Outline (the default), plain, filled and disabled
          </Text>
          <XStack gap="$2" alignItems="center">
            <Button label="Поделиться" icon={<Star size={20} />} variant="outline" onPress={noop} />
            <Button label="Подробнее" icon={<Info size={20} />} variant="ghost" onPress={noop} />
            <Button label="Принять" icon={<Check size={20} />} variant="primary" onPress={noop} />
            <Button label="Поделиться" icon={<Star size={20} />} variant="outline" disabled />
          </XStack>
        </YStack>
        <YStack gap="$2" alignItems="flex-start">
          <Text kind="caption" tone="muted">
            32 px circles in the same 44 px target
          </Text>
          <XStack gap="$2" alignItems="center">
            <Button
              label="Отклонить: Екатерина Шереметьева"
              icon={<Close size={16} />}
              iconSize="sm"
              shape="round"
              variant="outline"
              onPress={noop}
            />
            <Button
              label="Принять: Екатерина Шереметьева"
              icon={<Check size={16} />}
              iconSize="sm"
              shape="round"
              variant="primary"
              onPress={noop}
            />
          </XStack>
        </YStack>
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/**
 * The explanatory «i» next to the phrase it explains is `InfoButton`, a ready
 * control, not a `Button` prop: on the web it opens a `Tooltip` on hover, on
 * keyboard focus and on a tap, and a second tap closes it again; a phone shows the
 * same text in a `Dialog`. Hover the icon or press Tab to read it.
 */
export const InfoButtonNearLabel: Story = {
  name: "Info button",
  tags: ["!dev"],
  render: function InfoButtonNearLabelStory() {
    return (
      <XStack gap="$2" alignItems="center" width={320}>
        <Text kind="label">Ссылка открыта всем</Text>
        <InfoButton
          label="Что видно по ссылке"
          explanation="Ссылку увидят все, у кого она есть: и друзья, и те, кому вы её отправили."
          closeLabel="Закрыть"
        />
      </XStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** The same control with its tooltip opened by a real press: the second tap closes it. */
function pressInfoButton({ canvasElement }: { canvasElement: HTMLElement }) {
  const trigger = canvasElement.querySelector<HTMLElement>("[aria-label='Что видно по ссылке']");
  trigger?.click();
}

export const InfoButtonOpened: Story = {
  name: "Info button opened by a press",
  tags: ["!dev"],
  render: function InfoButtonOpenedStory() {
    return (
      <XStack gap="$2" alignItems="center" width={320}>
        <Text kind="label">Ссылка открыта всем</Text>
        <InfoButton
          label="Что видно по ссылке"
          explanation="Ссылку увидят все, у кого она есть: и друзья, и те, кому вы её отправили."
          closeLabel="Закрыть"
        />
      </XStack>
    );
  },
  play: pressInfoButton,
  globals: { viewport: { value: "w360" } },
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
