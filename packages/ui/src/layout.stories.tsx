import type { Meta, StoryObj } from "@storybook/react";
import { Column, PageContainer, Screen, View, XStack, YStack, ZStack } from "./layout";
import { Text } from "./text";

/**
 * The frame of every page: `Screen` paints the app background, `PageContainer`
 * caps the width at `max-wide`, `Column` adds the page gutter and the form/content
 * width. The bare stacks (`View`, `XStack`, `YStack`, `ZStack`) come from Tamagui
 * and are re-exported so an app imports its primitives from one package.
 */
const meta = {
  title: "UI/Layout",
  component: Screen,
} satisfies Meta<typeof Screen>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The three frames nested as a screen uses them, on a 360 px phone. */
function ScreenFrameStory() {
  return (
    <Screen width={360} height={480} padding="$2">
      <Text kind="caption" tone="muted">
        Screen — фон приложения
      </Text>
      <PageContainer
        backgroundColor="$surface"
        borderWidth={1}
        borderColor="$border"
        borderRadius="$lg"
        padding="$2"
        gap="$2"
      >
        <Text kind="label">PageContainer — до 1120 px, по центру</Text>
        <Column size="form" backgroundColor="$muted" borderRadius="$sm" paddingVertical="$2" gap="$1">
          <Text kind="caption">Column size=form — 560 px и gutter 16</Text>
          <Text kind="caption" tone="muted">
            Контент формы
          </Text>
        </Column>
        <Column
          size="content"
          backgroundColor="$background"
          borderRadius="$sm"
          paddingVertical="$2"
          gap="$1"
        >
          <Text kind="caption">Column size=content — 720 px</Text>
        </Column>
        <Column size="wide" backgroundColor="$muted" borderRadius="$sm" paddingVertical="$2" gap="$1">
          <Text kind="caption">Column size=wide — 1120 px</Text>
        </Column>
      </PageContainer>
    </Screen>
  );
}

ScreenFrameStory.displayName = "ScreenFrameStory";

export const ScreenFrame: Story = {
  render: ScreenFrameStory,
  globals: { viewport: { value: "w360" } },
};

/** `XStack` is a row, `YStack` a column, `ZStack` stacks children on top of each other. */
function StacksStory() {
  return (
    <YStack gap="$3" width={320}>
      <Text kind="heading">XStack</Text>
      <XStack gap="$2" alignItems="center">
        <View width={48} height={48} backgroundColor="$primary" borderRadius="$sm" />
        <View width={48} height={48} backgroundColor="$accent" borderRadius="$sm" />
        <View width={48} height={48} backgroundColor="$muted" borderRadius="$sm" />
      </XStack>
      <Text kind="heading">YStack</Text>
      <YStack gap="$2">
        <View height={24} backgroundColor="$primary" borderRadius="$sm" />
        <View height={24} backgroundColor="$accent" borderRadius="$sm" />
        <View height={24} backgroundColor="$muted" borderRadius="$sm" />
      </YStack>
      <Text kind="heading">ZStack</Text>
      <ZStack width={160} height={96}>
        <View width={96} height={96} backgroundColor="$primary" borderRadius="$sm" />
        <View width={96} height={96} marginLeft={32} backgroundColor="$accent" borderRadius="$sm" opacity={0.7} />
      </ZStack>
    </YStack>
  );
}

StacksStory.displayName = "StacksStory";

export const Stacks: Story = {
  render: StacksStory,
};

/** A frame narrower than any phone: nothing is clipped, the content wraps. */
function NarrowFrameStory() {
  return (
    <Screen width={320} height={360} padding="$2">
      <PageContainer>
        <Column size="form" gap="$2">
          <Text kind="display-sm">Длинный заголовок узкого экрана</Text>
          <XStack gap="$2" flexWrap="wrap">
            <View width={64} height={64} backgroundColor="$surface" borderWidth={1} borderColor="$border" borderRadius="$md" />
            <View width={64} height={64} backgroundColor="$surface" borderWidth={1} borderColor="$border" borderRadius="$md" />
            <View width={64} height={64} backgroundColor="$surface" borderWidth={1} borderColor="$border" borderRadius="$md" />
          </XStack>
        </Column>
      </PageContainer>
    </Screen>
  );
}

NarrowFrameStory.displayName = "NarrowFrameStory";

export const NarrowFrame: Story = {
  render: NarrowFrameStory,
  globals: { viewport: { value: "w360" } },
};
