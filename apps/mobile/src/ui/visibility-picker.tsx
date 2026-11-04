import { VISIBILITIES, type GiftCard } from "@gift-list/contracts";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useTranslations } from "use-intl";
import { colors, rounded, spacing, textStyle } from "@/theme/tokens";
import { pageGutter } from "@/ui/card-grid";
import { ChoiceGroup } from "@/ui/gift-form";

type Visibility = GiftCard["visibility"];

/**
 * `DESIGN.md` → Dialog and `EXPERIENCE.md` → Visibility chip: the owner picks
 * «Всем» / «Друзьям» / «Секрет» in a centered dialog over the wishlist.
 * The rows are the same radio rows as in the wish form (`ChoiceGroup`), so the
 * three choices look and read the same in both places.
 *
 * `visible={false}` renders nothing; the transparency and fade come from `Modal`.
 * Android «назад» arrives as `onRequestClose`, and react-native-web turns Esc
 * into the same callback — the scrim and «Отмена» close it too.
 *
 * NOTE FOR UX: `DESIGN.md` puts the visibility layer in a dialog at medium and
 * wider; compact would be a bottom sheet (`EXPERIENCE.md` → «Шторка vs диалог»).
 * This microtask draws one centered dialog at every width; the sheet chrome can
 * wrap the same content later.
 */
export function VisibilityPicker({
  visible,
  title,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  /** The wish title, substituted into «Кто видит «{title}»». */
  title: string;
  value: Visibility;
  onSelect: (visibility: Visibility) => void;
  onClose: () => void;
}) {
  const t = useTranslations("app.gift.visibilityPicker");
  const tVisibility = useTranslations("app.gift.visibility");
  const tHint = useTranslations("app.giftForm.field");
  const { width: windowWidth } = useWindowDimensions();
  // `DESIGN.md` → dialog: up to `dialog-width`; on a narrow window the page
  // gutter stays visible on both sides.
  const dialogWidth = Math.min(
    spacing["dialog-width"],
    Math.max(0, windowWidth - pageGutter(windowWidth) * 2),
  );
  const titleId = "visibility-picker-title";
  const heading = t("title", { title });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      // react-native-web's Modal already renders `role="dialog"` and
      // `aria-modal="true"` and forwards the labelling to that element; on the
      // phone the platform modal is modal on its own.
      aria-labelledby={titleId}
    >
      <View style={styles.overlay}>
        {/* The scrim closes the layer; it is decorative for screen readers —
            «Отмена», Esc and Android «назад» do the same. */}
        <Pressable
          style={[StyleSheet.absoluteFill, styles.scrim]}
          onPress={onClose}
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View style={[styles.dialog, { width: dialogWidth }]}>
          <Text accessibilityRole="header" nativeID={titleId} style={styles.title}>
            {heading}
          </Text>
          <ChoiceGroup
            variant="rows"
            // The header above is the visible name; this only names the radiogroup.
            label={heading}
            labelHidden
            value={value}
            onChange={(next) => {
              // Picking the current value is a no-op: the dialog just closes.
              if (next === value) onClose();
              else onSelect(next);
            }}
            options={VISIBILITIES.map((code) => ({
              value: code,
              label: tVisibility(code),
              hint: tHint(`visibilityHint.${code}`),
            }))}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("cancel")}
            onPress={onClose}
            style={({ pressed }) => [styles.cancel, pressed ? styles.pressed : null]}
          >
            <Text style={styles.cancelLabel}>{t("cancel")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["page-gutter-lg"],
  },
  scrim: {
    backgroundColor: colors.scrim,
    opacity: 0.4,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    padding: spacing["card-padding"],
    gap: spacing["grid-gap"],
  },
  title: {
    ...textStyle("heading"),
    color: colors.foreground,
  },
  // Ghost «Отмена» (`DESIGN.md` → buttons): text only, 44×44.
  cancel: {
    alignSelf: "flex-end",
    minHeight: spacing["touch-target"],
    minWidth: spacing["touch-target"],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  cancelLabel: {
    ...textStyle("button"),
    color: colors.primary,
  },
  pressed: {
    opacity: 0.9,
  },
});
