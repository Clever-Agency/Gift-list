import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import { propDoc } from "../../../.storybook/argTypes";
import { RelationshipChip } from "./relationship-chip";

/**
 * `RelationshipChip` is the static relation of a person row: «Друзья», «Зовёт в
 * друзья», «Ожидает ответа», «Это вы». It is not a button; `emphasis` marks the
 * relation that waits for an answer.
 *
 * The sandbox turns `label`, `emphasis` and `testID` in the panel.
 */
const meta = {
  title: "UI/RelationshipChip",
  component: RelationshipChip,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The static relation of a person row: «Друзья», «Зовёт в друзья», «Ожидает ответа», «Это вы». A neutral \`muted\` chip; the one relation that waits for an answer takes the \`primary\` colour and 600.

What is not a prop:

- The chip is not a control: it takes no press, has no focus state and does not open anything.
- The shape (\`rounded.md\`, \`pill-height\`, padding 10) and the colours come from the theme and do not change.
- The word comes from the caller: the package never translates the relation.
        `.trim(),
      },
    },
  },
  argTypes: {
    label: propDoc({
      description:
        "The relation spelled out: «Друзья», «Ожидает ответа», «Зовёт в друзья», «Это вы».",
      type: "string",
      required: true,
      control: "text",
    }),
    emphasis: propDoc({
      description:
        "`DESIGN.md` → Мелкие элементы: «Зовёт в друзья» is `primary` 600, because the invitation waits for an answer; the other relations are `muted-foreground`.",
      type: "boolean",
      defaultValue: "false",
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
  },
  args: {
    label: "Друзья",
    emphasis: false,
    testID: "relationship-chip",
  },
} satisfies Meta<typeof RelationshipChip>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The sandbox: type the relation, turn `emphasis` on and off. The panel changes
 * the same two props a person row passes.
 */
export const Playground: Story = {};

/** «Зовёт в друзья» is the one relation in the primary colour and 600. */
export const Emphasized: Story = {
  args: { label: "Зовёт в друзья", emphasis: true },
};

export const Friend: Story = {
  tags: ["!dev"],
};

export const AllRelations: Story = {
  tags: ["!dev"],
  render: function AllRelationsStory() {
    return (
      <YStack gap="$2" alignItems="flex-start" width={360}>
        <RelationshipChip label="Друзья" />
        <RelationshipChip label="Зовёт в друзья" emphasis />
        <RelationshipChip label="Ожидает ответа" />
        <RelationshipChip label="Вы подписаны" />
        <RelationshipChip label="Подписан на вас" />
        <RelationshipChip label="Это вы" />
      </YStack>
    );
  },
};

/** A long relation at 360 px: the chip grows with the text. */
export const LongLabelNarrow: Story = {
  tags: ["!dev"],
  args: { label: "Взаимная подписка, запрос отправлен давно" },
  globals: { viewport: { value: "w360" } },
};
