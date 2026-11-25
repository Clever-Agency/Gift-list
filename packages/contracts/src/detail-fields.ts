// Which gift fields a detail dialog may show. The server already dropped anything
// the viewer must not see (`toOwnerGiftCard` / `toViewerGiftCard`). This function
// is the second gate: the owner branch never reads the reservation fields
// (D-49: a gift is always a surprise for the owner), and the guest branch never
// reads visibility or the archive instant.

import type { GiftCard } from "./index";
import { formatDate, formatPrice } from "./i18n/format";
import { getMessages, type Messages } from "./i18n/messages";

export type DetailViewer = "owner" | "guest";

export type DetailFact = {
  id: string;
  label: string;
  value: string;
  href?: string;
};

export type DetailCopy = {
  description: string;
  price: string;
  link: string;
  quantity: string;
  quantityValue: Record<GiftCard["quantity"], string>;
  expires: string;
  tags: string;
  status: string;
  statusValue: Record<GiftCard["status"], string>;
  visibility: string;
  visibilityValue: Record<GiftCard["visibility"], string>;
  reservation: string;
  reservedBy: string;
  reservationLabel: Record<NonNullable<GiftCard["reservationLabel"]>, string>;
  due: string;
  phase: Record<NonNullable<GiftCard["reservation"]>["phase"], string>;
  bought: string;
  showOwner: string;
  showOthers: string;
  yes: string;
  no: string;
  archivedLabel: string;
  archived: string;
};

/** Labels for `toDetailFacts`, taken from the shipped catalogue. */
export function detailCopy(messages: Messages = getMessages()): DetailCopy {
  const gift = messages.app.gift;
  return {
    description: gift.detail.description,
    price: gift.detail.price,
    link: gift.detail.link,
    quantity: gift.detail.quantity,
    quantityValue: gift.quantity,
    expires: gift.detail.expires,
    tags: gift.detail.tags,
    status: gift.detail.status,
    statusValue: gift.status,
    visibility: gift.detail.visibility,
    visibilityValue: gift.visibility,
    reservation: gift.detail.reservation,
    reservedBy: messages.app.myWishlist.reservedBy,
    reservationLabel: gift.detail.reservationLabel,
    due: gift.reserveConfirm.dueLabel,
    phase: gift.detail.phase,
    bought: gift.detail.bought,
    showOwner: gift.reserveConfirm.showOwner,
    showOthers: gift.reserveConfirm.showOthers,
    yes: gift.detail.yes,
    no: gift.detail.no,
    archivedLabel: gift.detail.archivedLabel,
    archived: gift.detail.archived,
  };
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, function insert(_match, name: string) {
    return values[name] ?? "";
  });
}

/**
 * Rows the dialog may render for this viewer. Missing optionals are omitted.
 * Owner and guest do not share the reservation block: a key that arrived by
 * mistake on an owner card is ignored here.
 */
export function toDetailFacts(
  gift: GiftCard,
  viewer: DetailViewer,
  locale: string,
  copy: DetailCopy = detailCopy(),
): DetailFact[] {
  const facts: DetailFact[] = [];

  function add(id: string, label: string, value: string, href?: string) {
    facts.push(href === undefined ? { id, label, value } : { id, label, value, href });
  }

  if (gift.description !== null && gift.description.trim() !== "") {
    add("description", copy.description, gift.description);
  }
  if (gift.priceAmount !== null && gift.priceCurrency !== null) {
    add("price", copy.price, formatPrice(gift.priceAmount, gift.priceCurrency, locale));
  }
  if (gift.linkUrl) {
    add("link", copy.link, gift.linkUrl, gift.linkUrl);
  }
  add("quantity", copy.quantity, copy.quantityValue[gift.quantity]);
  if (gift.expiresOn) {
    add("expires", copy.expires, formatDate(gift.expiresOn, locale));
  }
  if (gift.tags.length > 0) {
    add(
      "tags",
      copy.tags,
      gift.tags
        .map(function tagLabel(tag) {
          return tag.label;
        })
        .join(", "),
    );
  }
  // D-49: the owner's card never shows a reservation. Even a stale payload with
  // `status: "RESERVED"` reads as an open wish, so no status label leaks it.
  const status = viewer === "owner" && gift.status === "RESERVED" ? "OPEN" : gift.status;
  add("status", copy.status, copy.statusValue[status]);

  if (viewer === "owner") {
    add("visibility", copy.visibility, copy.visibilityValue[gift.visibility]);
    if (gift.archivedAt) {
      add(
        "archived",
        copy.archivedLabel,
        fill(copy.archived, { date: formatDate(gift.archivedAt, locale) }),
      );
    }
    return facts;
  }

  if (gift.reservedBy) {
    add("reservedBy", copy.reservation, fill(copy.reservedBy, { name: gift.reservedBy.displayName }));
  }
  if (gift.reservationLabel) {
    add("reservationLabel", copy.reservation, copy.reservationLabel[gift.reservationLabel]);
  }
  const reservation = gift.reservation;
  if (reservation) {
    const date = formatDate(reservation.dueAt, locale);
    add("due", copy.reservation, fill(copy.due, { date }));
    add("phase", copy.reservation, fill(copy.phase[reservation.phase], { date }));
    if (reservation.bought) add("bought", copy.reservation, copy.bought);
    add("showOwner", copy.showOwner, reservation.holderVisibleToOwner ? copy.yes : copy.no);
    add("showOthers", copy.showOthers, reservation.holderVisibleToOthers ? copy.yes : copy.no);
  }
  return facts;
}
