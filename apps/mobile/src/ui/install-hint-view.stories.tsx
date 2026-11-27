import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@gift-list/ui";
import { InstallHintView } from "./install-hint-view";

/**
 * The install hint of Story 6.5 (`DESIGN.md` → Широкий экран, UX-DR11): one
 * sentence, the store links the build environment provides, and the 44 × 44 cross.
 * The card sits at the top of «Найти знакомых» and «Профиля»; on a wide window the
 * same card fills the right column of a root screen. Nothing here reads the real
 * `.env`: the stories state the addresses themselves.
 */
const meta = {
  title: "App/InstallHint",
  component: InstallHintView,
  tags: ["autodocs"],
  args: { onClose: noop },
} satisfies Meta<typeof InstallHintView>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {
  // The catalog does not remember a closed hint.
}

/** The first release: Google Play only. */
export const Default: Story = {
  render: function DefaultStory() {
    return (
      <YStack width={328}>
        <InstallHintView
          androidUrl="https://play.google.com/store/apps/details?id=app.giftlist.mobile"
          onClose={noop}
        />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** After the iOS release: both stores, as the same card. */
export const WithAppStore: Story = {
  render: function WithAppStoreStory() {
    return (
      <YStack width={328}>
        <InstallHintView
          androidUrl="https://play.google.com/store/apps/details?id=app.giftlist.mobile"
          iosUrl="https://apps.apple.com/app/id000000000"
          iosPublished
          onClose={noop}
        />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** Without a configured address the card carries no store link at all. */
export const NoStoreLinks: Story = {
  render: function NoStoreLinksStory() {
    return (
      <YStack width={328}>
        <InstallHintView onClose={noop} />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** The right column of a wide root screen: the same card at `right-column`. */
export const InRightColumn: Story = {
  render: function InRightColumnStory() {
    return (
      <YStack width={300}>
        <InstallHintView
          androidUrl="https://play.google.com/store/apps/details?id=app.giftlist.mobile"
          iosUrl="https://apps.apple.com/app/id000000000"
          iosPublished
          onClose={noop}
        />
      </YStack>
    );
  },
  globals: { viewport: { value: "w1280" } },
};
