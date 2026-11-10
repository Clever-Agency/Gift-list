import type { Meta, StoryObj } from "@storybook/react";
import { Button, XStack } from "@gift-list/ui";
import { SiteFooter } from "./site-footer";

/**
 * The one footer of the app: the agency tagline and «Написать автору»
 * (`common.footerTagline`, `common.writeToAuthor`). A screen may hand over its own
 * actions, and the wishlist does: «Выйти» and «Настройки» sit above the tagline.
 *
 * «Написать автору» reads its address from the configuration; the catalog mocks
 * that module and always shows the link. The no-address fallback (plain text,
 * no press) is covered by the unit tests of `AuthorLink`.
 */
const meta = {
  title: "App/SiteFooter",
  component: SiteFooter,
} satisfies Meta<typeof SiteFooter>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** A plain page footer on a 360 px phone. */
export const WithoutActions: Story = {
  render: function WithoutActionsStory() {
    return (
      <XStack width={328}>
        <SiteFooter />
      </XStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** The wishlist footer: the screen's own controls above the tagline. */
export const WithActions: Story = {
  render: function WithActionsStory() {
    return (
      <XStack width={328}>
        <SiteFooter
          actions={
            <>
              <Button label="Выйти" variant="ghost" onPress={noop} />
              <Button label="Настройки" variant="ghost" onPress={noop} />
            </>
          }
        />
      </XStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** Many actions wrap inside the footer instead of pushing the tagline away. */
export const WrappedActions: Story = {
  render: function WrappedActionsStory() {
    return (
      <XStack width={328}>
        <SiteFooter
          actions={
            <>
              <Button label="Выйти" variant="ghost" onPress={noop} />
              <Button label="Настройки" variant="ghost" onPress={noop} />
              <Button label="Поделиться вишлистом" variant="ghost" onPress={noop} />
            </>
          }
        />
      </XStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
