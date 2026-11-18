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
 * Reserve confirm (`EXPERIENCE.md` → Reserve confirm): date and two visibility
 * toggles in a bottom sheet on compact widths and a dialog otherwise.
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
  const locale = useLocale();
  const compact = !useMedia().medium;
  const [dueOn, setDueOn] = useState(() => defaultDueOn(timeZone));
  const [holderVisibleToOwner, setHolderVisibleToOwner] = useState(false);
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
      holderVisibleToOwner,
      holderVisibleToOthers,
    });
  }

  const body = (
    <YStack gap="$4">
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
      <Switch
        label={t("showOwner")}
        checked={holderVisibleToOwner}
        disabled={busy}
        onChange={setHolderVisibleToOwner}
      />
      <Switch
        label={t("showOthers")}
        checked={holderVisibleToOthers}
        disabled={busy}
        onChange={setHolderVisibleToOthers}
      />
      <Text kind="caption" tone="muted">
        {t("boughtHint")}
      </Text>
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