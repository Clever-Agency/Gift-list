import { formatDate, type GiftReserveBody } from "@gift-list/contracts";
import { BottomSheet, Button, Dialog, Switch, Text, YStack } from "@gift-list/ui";
import { useMedia } from "@tamagui/core";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { ReserveDateField } from "@/reserve/reserve-date-field";

export type ReserveConfirmProps = {
  open: boolean;
  title: string;
  timeZone: string;
  busy?: boolean;
  dateError?: string;
  onClose: () => void;
  onClosed?: () => void;
  onConfirm: (body: GiftReserveBody) => void;
};

function addCalendarDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function defaultDueOn(timeZone: string, now = new Date()): string {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return addCalendarDays(today, 7);
}

/**
 * Reserve confirm (`EXPERIENCE.md` → Reserve confirm): the date and the
 * «Показывать другим гостям, что дарю я» switch in a bottom sheet on compact
 * widths and a dialog otherwise. CLE-124/D-49 removed the «Показать владельцу»
 * switch: a reservation is always a surprise for the owner. CLE-124/S9b-1
 * removed the «Купил» hint: the timer releases the reservation after the window
 * even with that mark, so the hint promised something that no longer holds.
 */
export function ReserveConfirm({
  open,
  title,
  timeZone,
  busy,
  dateError,
  onClose,
  onClosed,
  onConfirm,
}: ReserveConfirmProps) {
  const t = useTranslations("app.gift.reserveConfirm");
  const tReservations = useTranslations("app.reservations");
  const locale = useLocale();
  const compact = !useMedia().medium;
  const [dueOn, setDueOn] = useState(() => defaultDueOn(timeZone));
  const [holderVisibleToOthers, setHolderVisibleToOthers] = useState(true);

  const minDue = useMemo(function computeMin() {
    const now = new Date();
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  }, [timeZone]);

  const maxDue = useMemo(function computeMax() {
    return addCalendarDays(minDue, 30);
  }, [minDue]);

  const dueLabelDate = /^\d{4}-\d{2}-\d{2}$/.test(dueOn)
    ? formatDate(dueOn, locale, { timeZone })
    : dueOn;
  const maxCaption = formatDate(maxDue, locale, { timeZone });

  function handleConfirm() {
    onConfirm({
      dueOn,
      holderVisibleToOthers,
    });
  }

  const body = (
    <YStack gap="$4">
      <YStack gap="$1">
        <ReserveDateField
          dueOn={dueOn}
          minDue={minDue}
          maxDue={maxDue}
          label={t("dueLabel", { date: dueLabelDate })}
          hint={t("dueHint")}
          caption={t("dueCaption", { max: maxCaption })}
          dateError={dateError}
          onChange={setDueOn}
        />
        {/* CLE-124/S9b-3 (§10.3): the line under the date names the release run-off. */}
        <Text kind="caption" tone="muted">
          {tReservations("dueNote")}
        </Text>
      </YStack>
      <Switch
        label={t("showOthers")}
        checked={holderVisibleToOthers}
        disabled={busy}
        onChange={setHolderVisibleToOthers}
      />
    </YStack>
  );

  const actions = (
    <>
      <Button label={t("cancel")} variant="ghost" onPress={onClose} disabled={busy} />
      <Button label={t("confirm")} variant="reserve" onPress={handleConfirm} disabled={busy} busy={busy} />
    </>
  );

  const heading = t("title", { title });

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

ReserveConfirm.displayName = "ReserveConfirm";