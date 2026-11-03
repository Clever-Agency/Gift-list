import { formatPrice, type GiftCard as GiftCardData } from "@gift-list/contracts";
import { StyleSheet, Text, View } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { colors, rounded, spacing, textStyle } from "@/theme/tokens";
import { StatusPill } from "@/ui/status-pill";
import { VisibilityChip } from "@/ui/visibility-chip";

/**
 * Gift card from AD-12 (`DESIGN.md` → WishCard). The shape comes from
 * `@gift-list/contracts`, so an owner card only carries what the server allowed:
 * `reservedBy` is present only when the holder shared the name with the owner (AD-7).
 * NOTE FOR UX: photo, tags, ⋯ and detail navigation arrive with Stories 2.5–2.7,
 * together with the one-phrase accessibility label of the card's main zone.
 */
export function WishCard({ gift, width }: { gift: GiftCardData; width: number }) {
  const t = useTranslations("app.myWishlist");
  const locale = useLocale();
  const closed = gift.status === "CLOSED";
  const price =
    gift.priceAmount !== null && gift.priceCurrency !== null
      ? formatPrice(gift.priceAmount, gift.priceCurrency, locale)
      : null;

  return (
    <View style={[styles.card, { width }]}>
      <Text style={[styles.title, closed ? styles.closedText : null]} numberOfLines={2}>
        {gift.title}
      </Text>
      {price ? <Text style={styles.price}>{price}</Text> : null}
      <StatusPill status={gift.status} />
      {gift.reservedBy ? (
        <Text style={styles.reservation}>
          {t("reservedBy", { name: gift.reservedBy.displayName })}
        </Text>
      ) : null}
      <View style={styles.footer}>
        <VisibilityChip visibility={gift.visibility} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.lg,
    padding: spacing["card-padding"],
    gap: spacing["grid-gap"] / 2,
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
