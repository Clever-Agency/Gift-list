import type { Meta, StoryObj } from "@storybook/react";
import { useTheme } from "@tamagui/core";
import { XStack, YStack } from "@tamagui/stacks";
import { Text } from "./text";
import { colors, rounded, spacing, typography, type ColorToken, type TypographyRole } from "./tokens";

/**
 * The one page that answers «что это за дизайн-система?»: the palette of the theme
 * the toolbar picked, the type scale of Lora and Manrope, the radii and the card
 * elevation. Every value is read from the theme or from `tokens.ts`, so the page can
 * never drift from what the components use.
 */

const COLOR_NAMES = Object.keys(colors) as ColorToken[];
const TYPE_ROLES = Object.keys(typography) as TypographyRole[];
const RADII = Object.keys(rounded) as Array<keyof typeof rounded>;

/** A colour of the active theme, resolved from the Tamagui theme variables. */
function useThemeColorValue(name: ColorToken): string {
  const theme = useTheme() as Record<string, { val?: string } | undefined>;
  return theme[name]?.val ?? colors[name];
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <YStack gap="$3">
      <YStack gap="$1">
        <Text kind="heading">{title}</Text>
        {hint ? (
          <Text kind="body-sm" tone="muted">
            {hint}
          </Text>
        ) : null}
      </YStack>
      {children}
    </YStack>
  );
}

Section.displayName = "Section";

function ColorSwatch({ name }: { name: ColorToken }) {
  const value = useThemeColorValue(name);
  return (
    <YStack gap="$1" width={168}>
      <YStack
        width="100%"
        height={56}
        borderRadius="$md"
        borderWidth={1}
        borderColor="$border"
        // A theme token: the swatch follows the toolbar theme, like the components do.
        backgroundColor={`$${name}`}
      />
      <Text kind="caption" fontWeight="600">
        {name}
      </Text>
      <Text kind="caption" tone="muted">
        {value}
      </Text>
    </YStack>
  );
}

ColorSwatch.displayName = "ColorSwatch";

function TypeSample({ role }: { role: TypographyRole }) {
  const token = typography[role];
  return (
    <YStack gap="$1">
      <XStack gap="$2" alignItems="baseline">
        <Text kind="caption" fontWeight="600">
          {role}
        </Text>
        <Text kind="caption" tone="muted">
          {token.fontFamily} · {token.fontSize}/{token.lineHeight} · {token.fontWeight}
        </Text>
      </XStack>
      <Text kind={role} numberOfLines={2}>
        Плед из шерсти мериноса
      </Text>
    </YStack>
  );
}

TypeSample.displayName = "TypeSample";

function RadiusSample({ token }: { token: keyof typeof rounded }) {
  return (
    <YStack gap="$1" alignItems="center" width={96}>
      <YStack width={72} height={72} backgroundColor="$muted" borderRadius={token} borderWidth={1} borderColor="$border" />
      <Text kind="caption" fontWeight="600">
        {token}
      </Text>
      <Text kind="caption" tone="muted">
        {rounded[token]}px
      </Text>
    </YStack>
  );
}

RadiusSample.displayName = "RadiusSample";

function ShadowSample({ token, label }: { token: "$shadow-card" | "$shadow-card-hover"; label: string }) {
  return (
    <YStack gap="$2" alignItems="center" width={200}>
      <YStack width={180} height={104} backgroundColor="$surface" borderRadius="$lg" boxShadow={token} />
      <Text kind="caption" fontWeight="600">
        {label}
      </Text>
    </YStack>
  );
}

ShadowSample.displayName = "ShadowSample";

const meta = {
  title: "Design system v8/Overview",
  parameters: {
    layout: "fullscreen",
    // The page is a set of static cards; there is nothing to toggle in the controls.
    controls: { disable: true },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The palette, the type scale, the radii and the elevation of the active theme.
 * Switch the toolbar to «Тёмная» to see the dark values — the page reads the theme,
 * it does not hard-code the light colours.
 */
export const Overview: Story = {
  render: function OverviewStory() {
    return (
      <YStack gap="$section-gap" width="100%" maxWidth={spacing["max-wide"]} alignSelf="center">
        <YStack gap="$1">
          <Text kind="display">Дизайн-система v8</Text>
          <Text kind="body" tone="muted">
            Светлая и тёмная темы из одних токенов: переключите «Тему» на панели сверху. Цвета, кегли, радиусы и
            тени ниже — это то, что реально используют компоненты.
          </Text>
        </YStack>

        <Section title="Цвета темы" hint={`${COLOR_NAMES.length} ролей: primary, accent, поверхности, статусы, ошибки.`}>
          <XStack flexWrap="wrap" gap="$3">
            {COLOR_NAMES.map(function swatch(name) {
              return <ColorSwatch key={name} name={name} />;
            })}
          </XStack>
        </Section>

        <Section title="Типографика" hint="Lora 600 — заголовки, Manrope — интерфейс. Оба с кириллицей и латиницей.">
          <YStack gap="$3">
            {TYPE_ROLES.map(function role(roleName) {
              return <TypeSample key={roleName} role={roleName} />;
            })}
          </YStack>
        </Section>

        <Section title="Радиусы" hint="8 — кнопки и поля, 16 — карточки и диалоги, 20 — шторка. Круглыми остаются только аватар, switch и бегунок.">
          <XStack flexWrap="wrap" gap="$3">
            {RADII.map(function radius(token) {
              return <RadiusSample key={token} token={token} />;
            })}
          </XStack>
        </Section>

        <Section
          title="Тени"
          hint="Светлая тема — двухслойная мягкая тень; тёмная — блик по верхней грани и разница тонов слоёв."
        >
          <XStack flexWrap="wrap" gap="$4" alignItems="flex-start">
            <ShadowSample token="$shadow-card" label="card · $shadow-card" />
            <ShadowSample token="$shadow-card-hover" label="card hover · $shadow-card-hover" />
          </XStack>
          <Text kind="body-sm" tone="muted">
            Поповер, диалог и шторка берут ту же гамму с большим разлётом (`effects.shadow-popover-*` в DESIGN.md).
          </Text>
        </Section>
      </YStack>
    );
  },
};
