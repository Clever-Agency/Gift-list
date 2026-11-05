import { VISIBILITIES, type GiftCard } from "@gift-list/contracts";
import { Button, Dialog, type FocusTarget } from "@gift-list/ui";
import { useRef } from "react";
import { useTranslations } from "use-intl";
import { ChoiceGroup } from "@/ui/gift-form";

type Visibility = GiftCard["visibility"];

/**
 * `DESIGN.md` → Dialog and `EXPERIENCE.md` → Visibility chip: the owner picks
 * «Всем» / «Друзьям» / «Секрет» in a centered dialog over the wishlist (`Dialog` from
 * `@gift-list/ui`). The rows are the same radio rows as in the wish form
 * (`ChoiceGroup`), so the three choices look and read the same in both places.
 *
 * `visible={false}` renders nothing. Esc, the scrim, «Отмена» and the system «назад»
 * on Android close it through `onClose`; focus lands on the radio that shows the
 * current value (`EXPERIENCE.md` → «Шторка и диалог»).
 *
 * `onClosed` runs once the layer has really gone, so the screen can put focus back on
 * the chip it was opened from.
 *
 * NOTE FOR UX: `DESIGN.md` puts the visibility layer in a dialog at medium and
 * wider; compact would be a bottom sheet (`EXPERIENCE.md` → «Шторка vs диалог»).
 * This microtask draws one centered dialog at every width; `BottomSheet` of
 * `@gift-list/ui` can wrap the same content later.
 */
export function VisibilityPicker({
  visible,
  title,
  value,
  onSelect,
  onClose,
  onClosed,
}: {
  visible: boolean;
  /** The wish title, substituted into «Кто видит «{title}»». */
  title: string;
  value: Visibility;
  onSelect: (visibility: Visibility) => void;
  onClose: () => void;
  /** The layer has left the tree: the screen can return focus to the chip. */
  onClosed: () => void;
}) {
  const t = useTranslations("app.gift.visibilityPicker");
  const tVisibility = useTranslations("app.gift.visibility");
  const tHint = useTranslations("app.giftForm.field");
  const heading = t("title", { title });
  const selectedRef = useRef<FocusTarget>(null);

  function handleSelect(next: Visibility) {
    // Picking the current value is a no-op: the dialog just closes.
    if (next === value) onClose();
    else onSelect(next);
  }

  return (
    <Dialog
      open={visible}
      title={heading}
      onClose={onClose}
      onClosed={onClosed}
      initialFocus={selectedRef}
      testID="visibility-picker"
      actions={<Button label={t("cancel")} onPress={onClose} variant="ghost" />}
    >
      <ChoiceGroup
        variant="rows"
        // The header above is the visible name; this only names the radiogroup.
        label={heading}
        labelHidden
        value={value}
        // The dialog puts focus on the radio holding the current value.
        autoFocusRef={selectedRef}
        autoFocusValue={value}
        onChange={handleSelect}
        options={VISIBILITIES.map((code) => ({
          value: code,
          label: tVisibility(code),
          hint: tHint(`visibilityHint.${code}`),
        }))}
      />
    </Dialog>
  );
}

VisibilityPicker.displayName = "VisibilityPicker";
