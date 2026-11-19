import { BottomSheet, Button, Dialog } from "@gift-list/ui";
import { useMedia } from "@tamagui/core";
import { useTranslations } from "use-intl";

export type ReservationReleaseConfirmProps = {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onClosed?: () => void;
  onConfirm: () => void;
};

/**
 * Снятие своей брони (Story 5.2, `EXPERIENCE.md` → Interaction Primitives):
 * confirm «Снять бронь? Подарок снова станет открытым.» в шторке на компактной
 * ширине и в диалоге на medium+. Это обычное действие, а не удаление: «Отмена»
 * — ghost, «Снять бронь» — обычная кнопка, коралловый `destructive` остаётся
 * за снятием чужой брони (`DESIGN.md` → Colors → Destructive).
 */
export function ReservationReleaseConfirm({
  open,
  busy,
  onClose,
  onClosed,
  onConfirm,
}: ReservationReleaseConfirmProps) {
  const t = useTranslations("app.gift.release");
  const compact = !useMedia().medium;

  const actions = (
    <>
      <Button label={t("cancel")} variant="ghost" onPress={onClose} disabled={busy} />
      <Button label={t("confirm")} onPress={onConfirm} busy={busy} />
    </>
  );

  const heading = t("title");

  if (compact) {
    return (
      <BottomSheet
        open={open}
        title={heading}
        onClose={onClose}
        onClosed={onClosed}
        actions={actions}
      />
    );
  }

  return (
    <Dialog open={open} title={heading} onClose={onClose} onClosed={onClosed} actions={actions} />
  );
}

ReservationReleaseConfirm.displayName = "ReservationReleaseConfirm";
