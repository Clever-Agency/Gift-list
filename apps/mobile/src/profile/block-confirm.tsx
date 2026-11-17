import { useTranslations } from "use-intl";
import { ConfirmDialog } from "@/ui/confirm-dialog";

/**
 * Story 4.5 / `EXPERIENCE.md` → «Block»: the one confirm of «Заблокировать»,
 * shared by the circle lists, the search row and `/u/:nick`, so the question and
 * its wording cannot drift apart. `name` is the person the press would block and
 * doubles as the open flag: `null` keeps the layer closed.
 */
export function BlockConfirm({
  name,
  busy,
  onConfirm,
  onCancel,
  onClosed,
}: {
  name: string | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onClosed: () => void;
}) {
  const friends = useTranslations("app.friends");

  return (
    <ConfirmDialog
      variant="confirm"
      visible={name !== null}
      title={friends("block.title", { name: name ?? "" })}
      body={friends("block.body")}
      confirmLabel={friends("block.confirm")}
      cancelLabel={friends("block.cancel")}
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
      onClosed={onClosed}
    />
  );
}

BlockConfirm.displayName = "BlockConfirm";
