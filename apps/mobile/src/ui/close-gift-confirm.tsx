import { useTranslations } from "use-intl";
import type { GiftCard } from "@gift-list/contracts";
import { ConfirmDialog } from "@/ui/confirm-dialog";

/**
 * Story 5.3 (FR-32): подтверждение «Подарок «Y» получен?» перед переходом в
 * `CLOSED`. Кнопка подтверждения обычная (`confirmTone="primary"`): `DESIGN.md`
 * → Colors прямо исключает «закрыт» из `destructive` — закрытие ничего не
 * теряет, подарок остаётся в списке и его можно вернуть в окне отмены.
 *
 * Тело «Бронь будет закрыта, бронировавший получит уведомление» — только у
 * `RESERVED`: у открытого желания закрывать нечего. Остальной механизм — общий
 * `ConfirmDialog`: фокус на безопасной «Отмене», одно нажатие на открытие,
 * `busy` на время запроса.
 */
export function CloseGiftConfirm({
  gift,
  busy,
  onConfirm,
  onCancel,
  onClosed,
}: {
  /** Открыто, пока желание передано; `null` — слой закрыт. */
  gift: GiftCard | null;
  busy?: boolean;
  onConfirm: () => void;
  /** «Отмена», Esc, крестик и скрим: ничего не отправляется. */
  onCancel: () => void;
  /** Слой ушёл из дерева: экран возвращает фокус на кнопку, которая его открыла. */
  onClosed: () => void;
}) {
  const t = useTranslations("app.gift.close");

  return (
    <ConfirmDialog
      variant="confirm"
      visible={gift !== null}
      title={gift ? t("title", { title: gift.title }) : ""}
      body={gift?.status === "RESERVED" ? t("reservedBody") : undefined}
      confirmTone="primary"
      confirmLabel={t("confirm")}
      cancelLabel={t("cancel")}
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
      onClosed={onClosed}
    />
  );
}

CloseGiftConfirm.displayName = "CloseGiftConfirm";
