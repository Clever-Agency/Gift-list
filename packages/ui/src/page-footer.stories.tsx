import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import { PageFooter } from "./page-footer";
import { LinkText, Text } from "./text";

/**
 * `PageFooter` is the one footer of the app: it is the last child of the page
 * column, so it scrolls with the content, and `role="contentinfo"` gives the web
 * build the footer landmark. The copy and the links come from the app.
 */
const meta = {
  title: "UI/PageFooter",
  component: PageFooter,
  args: {
    tagline: "WishMoon — желания, которые легко исполнить",
  },
} satisfies Meta<typeof PageFooter>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

export const TaglineOnly: Story = {};

/** Links or page actions sit above the tagline. */
export const WithLinks: Story = {
  render: function WithLinksStory() {
    return (
      <YStack width={360} maxWidth="100%">
        <Text kind="body" tone="muted" padding="$3">
          Последний экран страницы: над подписью могут стоять ссылки.
        </Text>
        <PageFooter tagline="WishMoon — желания, которые легко исполнить">
          <LinkText onPress={noop}>Написать автору</LinkText>
          <LinkText onPress={noop}>Политика конфиденциальности</LinkText>
        </PageFooter>
      </YStack>
    );
  },
};

/** A long tagline at 360 px: the line wraps, the footer stays centred. */
export const LongTaglineNarrow: Story = {
  args: {
    tagline:
      "WishMoon — сервис вишлистов для друзей и семьи: делитесь желаниями и не дарите лишнего",
  },
  globals: { viewport: { value: "w360" } },
};
