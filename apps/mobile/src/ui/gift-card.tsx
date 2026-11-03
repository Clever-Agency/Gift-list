import { formatPrice, type GiftCard as GiftCardData } from "@gift-list/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { colors, rounded, spacing, textStyle } from "@/theme/tokens";
import { StatusPill } from "@/ui/status-pill";
import { VisibilityChip } from "@/ui/visibility-chip";

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
 * NOTE FOR UX: photo, tags and ⋯ arrive with Stories 2.5–2.7, together with the
 * `Link` main zone that `DESIGN.md` reserves for the detail route; for now the
 * owner edit route is a button.
 */
export function WishCard({
  gift,
  width,
  onPress,
}: {
  gift: GiftCardData;
  width: number;
  onPress?: () => void;
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
      <View style={styles.footer}>
        <VisibilityChip visibility={gift.visibility} />
      </View>
    </>
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
    marginTop: spacing["grid-gap"] / 4,
  },
});
