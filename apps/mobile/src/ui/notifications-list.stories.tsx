import type { Meta, StoryObj } from "@storybook/react";
import type { NotificationItem } from "@gift-list/contracts";
import { NotificationsList } from "./notifications-list";

function noop() {}

/**
 * CLE-124/S9b-3: the holder's deadline notice. The reminder arrives before the
 * deadline and keeps «Продлить до…»; the expiry notice names the release date and
 * drops it. Both carry «Подарил» (Story 5.7).
 */
function dueItem(reminder: boolean): NotificationItem {
  return {
    id: "1",
    createdAt: "2026-11-24T10:00:00.000Z",
    readAt: null,
    href: "/gifts/example",
    event: {
      kind: "RESERVATION_DUE",
      titleSnapshot: "Абонемент на экскурсии по историческим паркам и садам",
      giftId: "example",
      actionable: true,
      bought: false,
      dueAt: reminder ? "2026-12-03T20:59:59.999Z" : "2026-11-20T20:59:59.999Z",
      timeZone: "Europe/Minsk",
      reminder,
    },
  };
}

/**
 * Story 6.6 (D-26, D-49): the wish-expiry notice of the holder. The soon notice
 * has no controls; the released one states the removal; the kept one offers the
 * same «Подарил» action as the deadline notice.
 */
function wishExpiryItem(variant: "soon" | "released" | "kept"): NotificationItem {
  if (variant === "soon") {
    return {
      id: "wish-soon",
      createdAt: "2026-11-24T10:00:00.000Z",
      readAt: null,
      href: "/reservations",
      event: {
        kind: "WISH_EXPIRY_SOON",
        giftId: "example",
        titleSnapshot: "Абонемент на экскурсии по историческим паркам и садам",
      },
    };
  }
  return {
    id: variant === "kept" ? "wish-kept" : "wish-released",
    createdAt: "2026-11-24T10:00:00.000Z",
    readAt: null,
    href: variant === "kept" ? "/reservations" : null,
    event: {
      kind: "WISH_EXPIRY",
      giftId: "example",
      titleSnapshot: "Абонемент на экскурсии по историческим паркам и садам",
      released: variant !== "kept",
      actionable: variant === "kept",
    },
  };
}

/**
 * Story 7.3 (FR-34): the reminder about a Friend's birthday names the day
 * without a year, the number of open wishes and up to three titles.
 */
function friendBirthdayItem(): NotificationItem {
  return {
    id: "birthday",
    createdAt: "2026-11-24T10:00:00.000Z",
    readAt: null,
    href: "/u/anya",
    event: {
      kind: "DATE_FRIEND",
      personName: "Аня",
      personNick: "anya",
      date: "2026-03-14",
      count: 4,
      titles: [
        "Абонемент на экскурсии по историческим паркам и садам",
        "Книга о путешествиях",
        "Наушники",
      ],
    },
  };
}

/**
 * Story 7.6 (FR-38): the reminder about a Friend's personal date names the
 * Friend, the owner's label and the day without a year.
 */
function personalDateItem(): NotificationItem {
  return {
    id: "personal-date",
    createdAt: "2026-11-24T10:00:00.000Z",
    readAt: null,
    href: "/u/anya",
    event: {
      kind: "DATE_CUSTOM",
      personName: "Аня",
      personNick: "anya",
      date: "2026-12-11",
      dateTitle: "Годовщина свадьбы",
    },
  };
}

const meta = {
  title: "App/NotificationsList",
  component: NotificationsList,
  tags: ["autodocs"],
  globals: { viewport: { value: "w360" } },
  args: {
    onOpen: noop,
    onAction: noop,
    items: [dueItem(true)],
  },
} satisfies Meta<typeof NotificationsList>;

export default meta;
type Story = StoryObj<typeof meta>;
export const PendingRequest: Story = {};
/** The request of the first row is in flight: its action is busy, the rest wait. */
export const Busy: Story = { tags: ["!dev"], args: { busyId: "1" } };
export const Empty: Story = { args: { items: [] } };
/** `Срок истёк`: «Продлить до…» больше нет, «Подарил» / «Купил» / «Снять бронь» есть. */
export const DueExpired: Story = { tags: ["!dev"], args: { items: [dueItem(false)] } };
/** Срок желания с сохранённой бронью: одна кнопка «Подарил». */
export const WishExpiryKept: Story = { args: { items: [wishExpiryItem("kept")] } };
/** Срок желания вышел: бронь снята, кнопок нет. */
export const WishExpiryReleased: Story = { tags: ["!dev"], args: { items: [wishExpiryItem("released")] } };
/** Срок желания через 3 дня: кнопок нет. */
export const WishExpirySoon: Story = { tags: ["!dev"], args: { items: [wishExpiryItem("soon")] } };
/** День рождения друга: дата без года, число открытых желаний, до трёх названий. */
export const FriendBirthday: Story = { args: { items: [friendBirthdayItem()] } };
/** Личная дата друга: название даты и день без года, открывается профиль. */
export const FriendPersonalDate: Story = { args: { items: [personalDateItem()] } };
