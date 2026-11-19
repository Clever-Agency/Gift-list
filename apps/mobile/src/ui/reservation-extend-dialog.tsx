import { formatDate } from "@gift-list/contracts";
import { BottomSheet, Button, Dialog } from "@gift-list/ui";
import { useMedia } from "@tamagui/core";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { ReserveDateField } from "@/reserve/reserve-date-field";
import { defaultDueOn } from "@/ui/reserve-confirm";

export type ReservationExtendDialogProps = {
  open: boolean;
  /** The holder's zone (`Me.timeZone`): the days of `min`/`max` are its days. */
  timeZone: string;
  busy?: boolean;
  /** «Выберите дату не позже {max}.» built from the server's `params.max`. */
  dateError?: string;
  onClose: () => void;
  onClosed?: () => void;
  onConfirm: (dueOn: string) => void;
};

/** A calendar day shifted by whole days; the same arithmetic as the reserve date. */
export function addCalendarDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Today in `timeZone` as `YYYY-MM-DD` — the first day a reservation may be extended to. */
export function todayInZone(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Story 5.5 (AD-9, as Story 5.1): the extension range is today … today + 30 in the
 * holder's own zone. The server checks the same window and answers
 * `DUE_OUT_OF_RANGE` with `params.max`; the field's bounds keep a wrong day out of
 * the request in the first place.
 */
export function extendBounds(timeZone: string, now = new Date()) {
  const minDue = todayInZone(timeZone, now);
  return { minDue, maxDue: addCalendarDays(minDue, 30) };
}

/**
 * «Продлить до…» (Story 5.5, `EXPERIENCE.md` → Reservation actions): the same
 * sheet-or-dialog pair as the reserve confirm, one date and two buttons. `DueOn`
 * is the calendar day the holder picked; the server turns it into the exclusive
 * end of that day (AD-9) and answers with the updated card.
 *
 * `GIVEN` never opens this dialog: the card offers no extension there and the
 * server answers `CONFLICT` (Story 5.7 owns that phase).
 */
export function ReservationExtendDialog({
  open,
  timeZone,
  busy,
  dateError,
  onClose,
  onClosed,
  onConfirm,
}: ReservationExtendDialogProps) {
  const t = useTranslations("app.reservations");
  const locale = useLocale();
  const compact = !useMedia().medium;
  const [dueOn, setDueOn] = useState(function startFrom() {
    return defaultDueOn(timeZone);
  });

  const bounds = useMemo(
    function computeBounds() {
      return extendBounds(timeZone);
    },
    [timeZone],
  );

  // «Не позже 20.12.2026»: the caption keeps the year (DECISION 2026-11-18).
  const maxCaption = formatDate(bounds.maxDue, locale);

  function handleConfirm() {
    onConfirm(dueOn);
  }

  const body = (
    <ReserveDateField
      dueOn={dueOn}
      minDue={bounds.minDue}
      maxDue={bounds.maxDue}
      label={t("extendDateLabel")}
      hint={t("extend")}
      caption={t("extendCaption", { max: maxCaption })}
      dateError={dateError}
      onChange={setDueOn}
    />
  );

  const actions = (
    <>
      <Button label={t("extendCancel")} variant="ghost" onPress={onClose} disabled={busy} />
      <Button label={t("extendConfirm")} onPress={handleConfirm} disabled={busy} busy={busy} />
    </>
  );

  const heading = t("extend");

  if (compact) {
    return (
      <BottomSheet open={open} title={heading} onClose={onClose} onClosed={onClosed} actions={actions}>
        {body}
      </BottomSheet>
    );
  }

  return (
    <Dialog open={open} title={heading} onClose={onClose} onClosed={onClosed} actions={actions}>
      {body}
    </Dialog>
  );
}

ReservationExtendDialog.displayName = "ReservationExtendDialog";
