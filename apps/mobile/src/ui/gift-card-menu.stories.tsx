import type { Meta, StoryObj } from "@storybook/react";
import { GiftCardMenu } from "./gift-card-menu";

/**
 * Story 5.3: меню ⋯ карточки владельца. У открытого и забронированного желания
 * в нём «Отметить полученным», у закрытого — «Вернуть в открытые · ещё N мин»
 * (только пока окно открыто), «Хочу ещё такой» и «Удалить». Слой — тот же
 * `Dialog`, что у меню архива; кнопки идут в один столбец, «Удалить» коралловое.
 */
const meta = {
  title: "App/GiftCardMenu",
  component: GiftCardMenu,
  tags: ["autodocs"],
  parameters: {
    // A layer paints its scrim over the whole document: on the Docs page every
    // showcase runs in its own iframe, so an open menu stays inside its frame.
    docs: { story: { inline: false, iframeHeight: "420px" } },
  },
  args: {
    open: true,
    title: "Плед из шерсти мериноса",
    closeLabel: "Закрыть",
    onClose: function close() {},
    onClosed: function closed() {},
    onSelect: function select() {},
  },
  globals: { viewport: { value: "w360" } },
} satisfies Meta<typeof GiftCardMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** Открытое или забронированное желание: единственный пункт — «Отметить полученным». */
export const ActiveWish: Story = {
  args: {
    actions: [{ key: "received", label: "Отметить полученным", onPress: noop }],
  },
};

/** Закрытое желание в окне отмены: возврат с остатком минут, копия и удаление. */
export const ClosedWishInWindow: Story = {
  tags: ["!dev"],
  args: {
    actions: [
      { key: "undo", label: "Вернуть в открытые · ещё 7 мин", onPress: noop },
      { key: "copy", label: "Хочу ещё такой", onPress: noop },
      { key: "delete", label: "Удалить", destructive: true, onPress: noop },
    ],
  },
};

/** Окно вышло: пункта возврата нет, копия и удаление остаются. */
export const ClosedWishExpired: Story = {
  tags: ["!dev"],
  args: {
    actions: [
      { key: "copy", label: "Хочу ещё такой", onPress: noop },
      { key: "delete", label: "Удалить", destructive: true, onPress: noop },
    ],
  },
};

/** Длинное название желания на 360 px: заголовок слоя переносится. */
export const NarrowLongTitle: Story = {
  tags: ["!dev"],
  args: {
    title: "Плед из шерсти мериноса с длинной бахромой и подогревом для холодных вечеров",
    actions: [
      { key: "copy", label: "Хочу ещё такой", onPress: noop },
      { key: "delete", label: "Удалить", destructive: true, onPress: noop },
    ],
  },
  globals: { viewport: { value: "w360" } },
};

/** Слой закрыт: пунктов нет, экран убирает меню. */
export const Hidden: Story = {
  args: { open: false, actions: [] },
};
