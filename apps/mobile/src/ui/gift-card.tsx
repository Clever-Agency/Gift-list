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
 * `onPress` makes the content a button (label from `app.gift.edit`), and without
 * it the card is plain list content. The list item wrapper is always the outer
 * element, so the list semantics of the grid survive the pressable inside it.
 *
 * Story 2.3: the visibility chip is a button of its own only when
 * `onVisibilityPress` is passed and the wish is `OPEN` (`DESIGN.md` → VisibilityChip;
 * `EXPERIENCE.md` → Visibility chip). It sits next to the card body, not inside it,
 * so no pressable is nested in another and the chip's press cannot open the edit route.
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

  // The card content is built once and either sits in the pressable body or in a
  // plain wrapper, so both variants stay the same card.
  const body = (
    <>
      <Text style={[styles.title, closed ? styles.closedText : null]} numberOfLines={2}>
        {gift.title}
      </Text>
      {price ? <Text style={styles.price}>{price}</Text> : null}
      <StatusPill status={gift.status} />
      {reservation ? <Text style={styles.reservation}>{reservation}</Text> : null}
    </>
  );
  // `DESIGN.md` → WishCard: the chip is a sibling of the main zone, never inside
  // it. The footer keeps the paddings the body used to give it, so the card looks
  // the same as when the chip lived at the end of the body.
  const footer = (
    <View style={styles.footer}>
      <VisibilityChip
        visibility={gift.visibility}
        onPress={visibilityPress}
        chipRef={visibilityChipRef}
      />
    </View>
  );

  return (
    // Review m5: the card is a list item; the grid in «Мой вишлист» is its list.
    // Story 2.2: the owner edit route hangs off the card content, not the wrapper,
    // so the outer element keeps the listitem role whatever the card is used for.
    <View role="listitem" style={[styles.card, { width }]}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tGift("edit", { title: gift.title })}
          onPress={onPress}
          style={({ pressed }) => [styles.body, pressed ? styles.pressed : null]}
        >
          {body}
        </Pressable>
      ) : (
        <View style={styles.body}>{body}</View>
      )}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.lg,
  },
  body: {
    padding: spacing["card-padding"],
    // The footer carries the bottom padding once it sits outside the body.
    paddingBottom: 0,
    gap: spacing["grid-gap"] / 2,
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
  footer: {
    // The body gap (grid-gap / 2) plus the old footer margin (grid-gap / 4).
    marginTop: (spacing["grid-gap"] * 3) / 4,
    paddingHorizontal: spacing["card-padding"],
    paddingBottom: spacing["card-padding"],
  },
});
