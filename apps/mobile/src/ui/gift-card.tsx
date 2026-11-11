import { formatPrice, type GiftCard as GiftCardData } from "@gift-list/contracts";
import { TagChipList, WishCard as UiWishCard } from "@gift-list/ui";
import { useLocale, useTranslations } from "use-intl";
import { StatusPill } from "@/ui/status-pill";
import { VisibilityChip, type VisibilityChipRef } from "@/ui/visibility-chip";

/** The comma-separated card name of `DESIGN.md` → Доступность, without empty parts. */
function joinCardName(parts: readonly (string | null)[]): string {
  return parts
    .filter(function hasText(part): part is string {
      return part !== null && part.trim() !== "";
    })
    .join(", ");
}

/**
 * Gift card from AD-12 (`DESIGN.md` → WishCard). The shape comes from
 * `@gift-list/contracts`, so an owner card only carries what the server allowed:
 * `reservedBy` is present only when the holder shared the name with the owner (AD-7).
 * The reservation line follows `EXPERIENCE.md` → State Patterns → «Подписи брони»:
 * the owner sees the holder name only in an open reservation; `ownerAction`
 * replaces it with the phase label («Ждёт вашего подтверждения» / «Срок брони истёк»).
 *
 * The card stays presentational and reusable in non-owner lists: only a passed
 * `onPress` makes the whole card a button (the full `DESIGN.md` → Доступность
 * phrase), and without it the card is plain list content. The list item wrapper
 * is always the outer element, so the list semantics of the grid survive the
 * pressable inside it.
 *
 * The edit button covers the whole card (CLE-65): the footer area is reserved under
 * the body with an empty spacer of the same height (footer margin + chip + card
 * padding), so a press on the empty space next to the chip opens the edit route
 * too. The visibility chip is drawn over that reserved area from a sibling layer,
 * never from inside the button: nothing is nested, and the Tab order stays the card
 * first, the chip second.
 *
 * Story 2.3: the visibility chip is a button of its own only when
 * `onVisibilityPress` is passed and the wish can still change its visibility —
 * `OPEN` or `RESERVED` (`DESIGN.md` → VisibilityChip; `EXPERIENCE.md` → Visibility
 * chip). A closed or archived wish is read-only (product clarification t351u), so
 * its chip only shows the value. A non-pressable chip lets the press through to
 * the card underneath, so it also opens the edit route.
 *
 * NOTE FOR UX: photo, tags and ⋯ arrive with Stories 2.5–2.7, together with the
 * `Link` main zone that `DESIGN.md` reserves for the detail route; for now the
 * owner edit route is a button.
 */
export function WishCard({
  gift,
  width,
  onPress,
  onVisibilityPress,
  visibilityChipRef,
}: {
  gift: GiftCardData;
  width: number;
  onPress?: () => void;
  /** Opens the visibility picker; only `OPEN` and `RESERVED` wishes get a pressable chip. */
  onVisibilityPress?: () => void;
  /** Where focus returns when the visibility layer closes (Story 2.3). */
  visibilityChipRef?: VisibilityChipRef;
}) {
  const t = useTranslations("app.myWishlist");
  const tGift = useTranslations("app.gift");
  const tStatus = useTranslations("app.gift.status");
  const tVisibilityLower = useTranslations("app.gift.visibilityLower");
  const tOwnerAction = useTranslations("app.gift.ownerAction");
  const locale = useLocale();
  const price =
    gift.priceAmount !== null && gift.priceCurrency !== null
      ? formatPrice(gift.priceAmount, gift.priceCurrency, locale)
      : null;
  // The owner gets no `phase` on the wire: `ownerAction` marks the finished phases
  // (GIVEN / AWAITING_OWNER); without it the reservation is open and the name is
  // shown when the server shared it (FR-31). A hidden name leaves the status pill
  // as the only label.
  const reservation = gift.ownerAction
    ? tOwnerAction(gift.ownerAction)
    : gift.reservedBy
      ? t("reservedBy", { name: gift.reservedBy.displayName })
      : null;
  // `DESIGN.md` → VisibilityChip: the chip is a button on a wish that can still
  // change it. `CLOSED` and an archived wish are read-only (CLE-82/S23.3).
  const visibilityPress =
    onVisibilityPress !== undefined && gift.status !== "CLOSED" && gift.archivedAt === null
      ? onVisibilityPress
      : undefined;
  // Story 2.5.7: labels are the server's, already ordered by the mapper. The
  // visual row shows up to three chips; the accessible name keeps every tag so
  // a screen reader hears tags that «+N» hides.
  const tagLabels = gift.tags.map(function labelOfTag(tag) {
    return tag.label;
  });
  // `DESIGN.md` → Доступность: the pressable main zone reads as one phrase —
  // title, price, status, all tags, reservation line and visibility. Empty
  // parts are dropped, so no double separators reach the screen reader.
  const pressLabel = joinCardName([
    gift.title,
    price,
    tStatus(gift.status),
    tagLabels.length > 0 ? tagLabels.join(", ") : null,
    reservation,
    tGift("visibilityInCardName", { value: tVisibilityLower(gift.visibility) }),
  ]);

  function moreTagLabel(hiddenCount: number): string {
    return tGift("tagsMore", { count: hiddenCount });
  }

  function moreTagAccessibilityLabel(
    hiddenCount: number,
    hiddenLabels: readonly string[],
  ): string {
    return tGift("tagsMoreLabel", { count: hiddenCount, tags: hiddenLabels.join(", ") });
  }

  return (
    <UiWishCard
      title={gift.title}
      closed={gift.status === "CLOSED"}
      price={price}
      status={<StatusPill status={gift.status} />}
      tags={
        tagLabels.length > 0 ? (
          <TagChipList
            labels={tagLabels}
            testID="gift-tags"
            moreLabel={moreTagLabel}
            moreAccessibilityLabel={moreTagAccessibilityLabel}
          />
        ) : undefined
      }
      reservation={reservation}
      chip={
        <VisibilityChip
          visibility={gift.visibility}
          onPress={visibilityPress}
          chipRef={visibilityChipRef}
        />
      }
      chipInteractive={visibilityPress !== undefined}
      onPress={onPress}
      pressLabel={pressLabel}
      width={width}
    />
  );
}

WishCard.displayName = "WishCard";
