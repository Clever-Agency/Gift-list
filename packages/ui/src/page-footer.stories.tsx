import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import type { ComponentType } from "react";
import { propDoc } from "../../../.storybook/argTypes";
import { PageFooter, type PageFooterProps } from "./page-footer";
import { LinkText, Text } from "./text";

/** The catalog copy is a fixture, not a product string (`packages/ui` has no translations). */
function noop() {}

/**
 * The footer props plus the «есть ссылки» handle. The links are a slot, so the
 * catalog keeps two ready-made ones behind a switch instead of a node knob. The
 * cast on `component` below is what lets the Docs controls and the story args see
 * the handle; the component itself stays unchanged.
 */
type PageFooterCatalogProps = PageFooterProps & { withLinks: boolean };

/**
 * `PageFooter` is the one footer of the app: it is the last child of the page
 * column, so it scrolls with the content, and `role="contentinfo"` gives the web
 * build the footer landmark. The copy and the links come from the app.
 */
const meta = {
  title: "UI/PageFooter",
  component: PageFooter as ComponentType<PageFooterCatalogProps>,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The one page footer of the app. It is the last child of the page column, so it scrolls with the content instead of sticking to the window; \`role="contentinfo"\` gives the web build the \`footer\` landmark. The package owns the layout only.

What is not a prop:

- The tagline is one line of muted caption text, centred and wrapping; the copy comes from the app's catalogue.
- The links or page actions above the tagline are a slot, not a fixed set. The «есть ссылки» handle stands two ready-made router links in.
- On a short page the page column's \`flexGrow\` pushes the footer to the bottom; the footer itself adds the section gap and the page gutter.
        `.trim(),
      },
    },
  },
  argTypes: {
    tagline: propDoc({
      description: "The one line of footer copy, centred under the links and wrapping at a narrow width.",
      type: "string",
      required: true,
      control: "text",
    }),
    children: propDoc({
      description:
        "Links or page actions shown above the tagline. A slot: the screen passes its own links. The «есть ссылки» handle stands ready-made ones in.",
      type: "ReactNode",
      control: false,
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
    withLinks: {
      name: "есть ссылки",
      description:
        "Ручка каталога: показать в слоте `children` две готовые ссылки над подписью.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
    },
  },
  args: {
    tagline: "WishMoon — желания, которые легко исполнить",
    testID: "page-footer",
    withLinks: true,
  },
} satisfies Meta<PageFooterCatalogProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The ready-made links of the catalog: the app passes its own routes. */
const FOOTER_LINKS = (
  <>
    <LinkText onPress={noop}>Написать в техподдержку</LinkText>
    <LinkText onPress={noop}>Политика конфиденциальности</LinkText>
  </>
);

/** The footer with the «есть ссылки» handle applied. */
function PageFooterPreview({ withLinks, children, ...footerArgs }: PageFooterCatalogProps) {
  return (
    <YStack width={360} maxWidth="100%">
      <PageFooter {...footerArgs}>{withLinks ? (children ?? FOOTER_LINKS) : undefined}</PageFooter>
    </YStack>
  );
}

PageFooterPreview.displayName = "PageFooterPreview";

/**
 * The sandbox: write the tagline, flip «есть ссылки» to add or drop the links.
 * The tagline is a muted caption under them.
 */
export const Playground: Story = {
  render: function PlaygroundStory(args) {
    return <PageFooterPreview {...args} />;
  },
};

/** Links or page actions sit above the tagline. */
export const WithLinks: Story = {
  render: function WithLinksStory(args) {
    return (
      <YStack width={360} maxWidth="100%">
        <Text kind="body" tone="muted" padding="$3">
          Последний экран страницы: над подписью могут стоять ссылки.
        </Text>
        <PageFooterPreview {...args} />
      </YStack>
    );
  },
};

/** Only the tagline, as a public page with no links draws it. */
export const TaglineOnly: Story = {
  tags: ["!dev"],
  args: { withLinks: false },
  render: function TaglineOnlyStory(args) {
    return <PageFooterPreview {...args} />;
  },
};

/** A long tagline at 360 px: the line wraps, the footer stays centred. */
export const LongTaglineNarrow: Story = {
  tags: ["!dev"],
  args: {
    tagline:
      "WishMoon — сервис вишлистов для друзей и семьи: делитесь желаниями и не дарите лишнего",
    withLinks: false,
  },
  render: function LongTaglineNarrowStory(args) {
    return <PageFooterPreview {...args} />;
  },
  globals: { viewport: { value: "w360" } },
};
