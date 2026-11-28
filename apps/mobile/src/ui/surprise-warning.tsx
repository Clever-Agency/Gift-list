import { useTranslations } from "use-intl";
import { ConfirmDialog } from "@/ui/confirm-dialog";

/** The three owner actions that share one neutral warning (D-49, CLE-124). */
export type SurpriseWarningKind = "edit" | "delete" | "visibility";

export type SurpriseWarningCopy = {
  title: string;
  body: string;
  confirm: string;
  cancel: string;
};

/**
 * The one source of the warning's texts (`EXPERIENCE.md` → Interaction
 * Primitives, D-49). `title` is the wish name substituted into «Удалить
 * «{title}»?» and «Изменить, кто видит «{title}»?»; the edit question has no name.
 *
 * The hook is here so a warning shown as a step of the wish details layer (the
 * same `Dialog`, never a second one) reads exactly the same strings as the
 * standalone window this file draws.
 */
export function useSurpriseWarningCopy(
  kind: SurpriseWarningKind,
  title: string,
): SurpriseWarningCopy {
  const t = useTranslations("app.giftForm.surpriseWarning");

  return {
    title: t(`${kind}.title`, { title }),
    body: t(`${kind}.body`),
    confirm: t(`${kind}.confirm`),
    cancel: t(`${kind}.cancel`),
  };
}

/**
 * «Owner change warning» (`DESIGN.md` → Dialog, `EXPERIENCE.md` → Interaction
 * Primitives): one neutral warning for the owner before «Изменить», «Удалить» and
 * a visibility narrowing of an open non-secret wish. It never mentions a
 * reservation and is the same with a reservation and without one (D-49).
 *
 * It is the existing `ConfirmDialog` — a window on medium and wider, a bottom
 * sheet on compact — so the three paths look and behave identically. «Отмена»,
 * Esc, the scrim and Android back leave everything as it was; only the confirm
 * button runs the caller's action. The confirm is coral for a deletion and
 * primary for the two changes that lose nothing.
 */
export function SurpriseWarningDialog({
  visible,
  kind,
  title,
  busy,
  onConfirm,
  onCancel,
  onClosed,
}: {
  visible: boolean;
  kind: SurpriseWarningKind;
  /** The wish name for the two questions that name it. */
  title: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onClosed: () => void;
}) {
  const copy = useSurpriseWarningCopy(kind, title);

  return (
    <ConfirmDialog
      variant="confirm"
      visible={visible}
      title={copy.title}
      body={copy.body}
      confirmLabel={copy.confirm}
      cancelLabel={copy.cancel}
      confirmTone={kind === "delete" ? "destructive" : "primary"}
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
      onClosed={onClosed}
    />
  );
}

SurpriseWarningDialog.displayName = "SurpriseWarningDialog";
