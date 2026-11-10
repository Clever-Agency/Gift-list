import type { Meta, StoryObj } from "@storybook/react";
import { Screen } from "./layout";
import { SafeArea } from "./safe-area";
import { Text } from "./text";

/**
 * The safe frame of a screen: the one element between `Screen` and the page. On a
 * phone the wrapper adds the notch, the home indicator and the gesture edges to the
 * frame (`react-native-safe-area-context`, all four edges, additive); in the browser
 * every inset is 0, so the catalog shows the frame itself. A screen places it once —
 * a nested one would double the padding.
 */
const meta = {
  title: "UI/SafeArea",
  component: SafeArea,
} satisfies Meta<typeof SafeArea>;

export default meta;

type Story = StoryObj<typeof meta>;

function ScreenFrameStory() {
  return (
    <Screen width={360} height={420}>
      <SafeArea>
        <Text kind="caption" tone="muted" padding="$2">
          SafeArea — кадр экрана под Screen
        </Text>
      </SafeArea>
    </Screen>
  );
}

ScreenFrameStory.displayName = "ScreenFrameStory";

/** The frame as a screen uses it: `Screen` paints the background, `SafeArea` fills it. */
export const ScreenFrame: Story = {
  render: ScreenFrameStory,
  globals: { viewport: { value: "w360" } },
};

/** Long Cyrillic copy inside the frame at 360 px: the column grows, nothing is clipped. */
export const LongTextNarrow: Story = {
  render: function LongTextNarrowStory() {
    return (
      <Screen width={360} height={420}>
        <SafeArea>
          <Text kind="body" padding="$2">
            Вишлист для друзей и семьи: желания, которые легко исполнить, и подарки,
            которые действительно нужны.
          </Text>
        </SafeArea>
      </Screen>
    );
  },
  globals: { viewport: { value: "w360" } },
};
