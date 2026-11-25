import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { propDoc } from "../../../.storybook/argTypes";
import { Switch } from "./switch";

/** The catalog copy is a fixture, not a product string (`packages/ui` has no translations). */
function noop() {}

/**
 * The shared on/off switch of the settings rows (Story 3.5): one press surface
 * for the label, the hint and the track. The sandbox really toggles — the state
 * is local, so `onChange` needs no control.
 */
const meta = {
  title: "UI/Switch",
  component: Switch,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The on/off switch of the settings rows (\`role="switch"\`, \`aria-checked\`). The whole row is one press surface — the label, the hint and the track — and it is at least \`$row-height\` tall, so the touch target is never smaller than 44 px.

What is not a prop:

- The colours follow \`components.switch\`: \`$primary\` on, \`$border-strong\` off, a \`$surface\` thumb in both themes.
- Keyboard: Space toggles it on the web (and Enter, through \`Pressable\`); a phone gets the same press through React Native.
- The requested next state arrives through \`onChange\`, so the caller owns the request and its rollback. In the sandbox the switch keeps the state locally.
        `.trim(),
      },
    },
  },
  argTypes: {
    label: propDoc({
      description: "The visible label and the accessible name of the switch.",
      type: "string",
      required: true,
      control: "text",
    }),
    hint: propDoc({
      description:
        "A second line under the label; also the accessible description (`aria-describedby` on the web, an accessibility hint on a phone).",
      type: "string",
      control: "text",
    }),
    checked: propDoc({
      description:
        "The current state. Off is a `$border-strong` track with the thumb at the start, on is a `$primary` track with the thumb at the end.",
      type: "boolean",
      required: true,
      defaultValue: "false",
    }),
    disabled: propDoc({
      description:
        "Shows the stored value without letting it change. The row keeps its place in the focus order.",
      type: "boolean",
      defaultValue: "false",
    }),
    onChange: propDoc({
      description:
        "The requested next state; the caller owns the request and its rollback. Not a control — the sandbox toggles the switch itself.",
      type: "(checked: boolean) => void",
      required: true,
      control: false,
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
  },
  args: {
    label: "Показывать друзьям",
    checked: false,
    disabled: false,
    onChange: noop,
    testID: "switch",
  },
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The sandbox: press the row and the switch really flips. `checked` also works
 * from the panel; after the first press the local state follows the panel again
 * as soon as `checked` changes. `disabled` is a control too, so the stored value
 * can be seen without a way to change it.
 */
export const Playground: Story = {
  render: function PlaygroundStory(args) {
    const [checked, setChecked] = useState(args.checked);

    useEffect(
      function syncCheckedFromControls() {
        setChecked(args.checked);
      },
      [args.checked],
    );

    return <Switch {...args} checked={checked} onChange={setChecked} />;
  },
};

/** A hint under the label; the browser reads it through `aria-describedby`. */
export const WithHint: Story = {
  args: { hint: "Этот выбор можно изменить в любой момент" },
};

/** Off: the track is `$border-strong`, the thumb sits at the start. */
export const Off: Story = {
  tags: ["!dev"],
};

/** On: the track is `$primary`, the thumb moves to the end. */
export const On: Story = {
  tags: ["!dev"],
  args: { checked: true },
};

/** The stored value is shown but cannot change; the row keeps its place in the focus order. */
export const Disabled: Story = {
  tags: ["!dev"],
  args: { checked: true, disabled: true },
};

/** A long Cyrillic label and hint wrap under the track instead of shrinking it. */
export const LongCyrillic: Story = {
  tags: ["!dev"],
  args: {
    label: "Не показывать меня в результатах поиска по нику и имени",
    hint: "Прямые ссылки на профиль и вишлист по-прежнему работают",
    checked: true,
  },
};

/** The narrowest supported width: the row still fits the track and wraps the text. */
export const Narrow: Story = {
  tags: ["!dev"],
  args: {
    label: "Не показывать в поиске",
    hint: "Прямые ссылки работают",
  },
  globals: { viewport: { value: "w360" } },
};
