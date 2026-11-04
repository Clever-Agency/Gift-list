import { formatPrice, type GiftCard as GiftCardData } from "@gift-list/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { colors, rounded, spacing, textStyle } from "@/theme/tokens";
import { StatusPill } from "@/ui/status-pill";
import { VisibilityChip, type VisibilityChipRef } from "@/ui/visibility-chip";

/**
 * Gift card from AD-12 (`DESIGN.md` → WishCard). The shape comes from
 * `@gift-list/contracts`, so an owner card only carries what the server allowed:
 * `reservedBy` is present only when the holder shared the name with the owner (AD-7).
 * The reservation line follows `EXPERIENCE.md` → State Patterns → «Подписи брони»:
 * the owner sees the holder name only in an open reservation; `ownerAction`
 * replaces it with the phase label («Ждёт вашего подтверждения» / «Срок брони истёк»).
 *
 * The card stays presentational and reusable in non-owner lists: only a passed
 * `onPress` makes the whole card a button (label from `app.gift.edit`), and without
 * it the card is plain list content. The list item wrapper is always the outer
 * element, so the list semantics of the grid survive the pressable inside it.
 *
 * The edit button covers the whole card (CLE-65): the footer area is reserved under
 * the body with an empty spacer of the same height (footer margin + chip + card
 * padding), so a press on the empty space next to the chip opens the edit route
 * too. The visibility chip is drawn over that reserved area from a sibling layer,
 * never from inside the button: nothing is nested, and the Tab order stays the card
 * first, the chip second.
 *
 * Story 2.3: the visibility chip is a button of its own only when
 * `onVisibilityPress` is passed and the wish is `OPEN` (`DESIGN.md` → VisibilityChip;
 * `EXPERIENCE.md` → Visibility chip). A non-pressable chip (RESERVED / CLOSED or no
 * handler) lets the press through to the card underneath, so it also opens the edit
 * route.
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
  /** Opens the visibility picker; only `OPEN` wishes get a pressable chip. */
  onVisibilityPress?: () => void;
  /** Where focus returns when the visibility layer closes (Story 2.3). */
  visibilityChipRef?: VisibilityChipRef;
}) {
  const t = useTranslations("app.myWishlist");
  const tGift = useTranslations("app.gift");
  const tOwnerAction = useTranslations("app.gift.ownerAction");
  const locale = useLocale();
  const closed = gift.status === "CLOSED";
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
  // `DESIGN.md` → VisibilityChip: the chip is a button only on an open wish.
  const visibilityPress =
    onVisibilityPress !== undefined && gift.status === "OPEN" ? onVisibilityPress : undefined;

  // The card content is built once and either sits in the pressable card or in a
  // plain wrapper, so both variants stay the same card. The footer space is reserved
  // with an empty spacer: the same height the chip footer used to take in the flow
  // (its top margin, the chip and the card's bottom padding), so the card looks
  // exactly as it did when the chip lived under the body.
  const content = (
    <>
      <View style={styles.body}>
        <Text style={[styles.title, closed ? styles.closedText : null]} numberOfLines={2}>
          {gift.title}
        </Text>
        {price ? <Text style={styles.price}>{price}</Text> : null}
        <StatusPill status={gift.status} />
        {reservation ? <Text style={styles.reservation}>{reservation}</Text> : null}
      </View>
      <View style={styles.footerSpacer} />
    </>
  );
  // `DESIGN.md` → WishCard: the chip is a sibling of the main zone, never inside it.
  // It is drawn over the reserved footer from an absolutely positioned layer, so the
  // empty space around it belongs to the card button underneath. `box-none` lets
  // presses outside the chip reach that button; a chip without `onPress` has no
  // control of its own, so its layer lets every press through.
  const chipLayer = (
    <View pointerEvents={visibilityPress ? "box-none" : "none"} style={styles.chipLayer}>
      <VisibilityChip
        visibility={gift.visibility}
        onPress={visibilityPress}
        chipRef={visibilityChipRef}
      />
    </View>
  );

  return (
    // Review m5: the card is a list item; the grid in «Мой вишлист» is its list.
    // Story 2.2 + CLE-65: the owner edit route hangs off the whole card, not the
    // wrapper, so the outer element keeps the listitem role whatever the card is
    // used for. The chip layer is a later sibling: Tab reaches the card first.
    <View role="listitem" style={[styles.card, { width }]}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tGift("edit", { title: gift.title })}
          onPress={onPress}
          style={({ pressed }) => [styles.cardBody, pressed ? styles.pressed : null]}
        >
          {content}
        </Pressable>
      ) : (
        <View style={styles.cardBody}>{content}</View>
      )}
      {chipLayer}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    // The chip layer is positioned against the card (web needs it spelled out).
    position: "relative",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.lg,
  },
  // The press zone of an owner card is the whole card: body, footer and padding.
  cardBody: {
    padding: spacing["card-padding"],
  },
  body: {
    // The reserved footer spacer follows the body text (see `footerSpacer`).
    gap: spacing["grid-gap"] / 2,
  },
  // Exactly the height the chip footer used to take: its top margin, the chip and
  // the card's bottom padding (the `cardBody` padding).
  footerSpacer: {
    marginTop: (spacing["grid-gap"] * 3) / 4,
    height: spacing["chip-height"],
  },
  // The chip sits where the footer used to put it: at the card's padding.
  chipLayer: {
    position: "absolute",
    left: spacing["card-padding"],
    bottom: spacing["card-padding"],
    zIndex: 1,
  },
  // The same pressed feedback the other Pressables of the app give (DESIGN.md → App).
  pressed: {
    opacity: 0.9,
  },
  title: {
    ...textStyle("body-strong"),
    color: colors.foreground,
  },
  closedText: {
    color: colors["muted-foreground"],
  },
  price: {
    ...textStyle("label"),
    color: colors["muted-foreground"],
  },
  reservation: {
    ...textStyle("label"),
    color: colors["status-reserved"],
  },
});
