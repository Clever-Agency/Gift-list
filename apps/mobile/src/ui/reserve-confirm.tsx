import { formatDate, type GiftReserveBody } from "@gift-list/contracts";
import { BottomSheet, Button, Dialog, Switch, Text, YStack } from "@gift-list/ui";
import { useMedia } from "@tamagui/core";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useMemo, useState } from "react";
import { Platform } from "react-native";
import { useLocale, useTranslations } from "use-intl";

export type ReserveConfirmProps = {
  open: boolean;
  title: string;
  timeZone: string;
  busy?: boolean;
  onClose: () => void;
  onClosed?: () => void;
  onConfirm: (body: GiftReserveBody) => void;
};

function addCalendarDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function defaultDueOn(timeZone: string): string {
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return addCalendarDays(today, 7);
}

function ymdToDate(ymd: string): Date {
  return new Date(`${ymd}T12:00:00.000Z`);
}

function dateToYmd(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
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
  onClose,
  onClosed,
  onConfirm,
}: ReserveConfirmProps) {
  const t = useTranslations("app.gift.reserveConfirm");
  const locale = useLocale();
  const compact = useMedia().maxMd;
  const [dueOn, setDueOn] = useState(() => defaultDueOn(timeZone));
  const [holderVisibleToOwner, setHolderVisibleToOwner] = useState(false);
  const [holderVisibleToOthers, setHolderVisibleToOthers] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

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
      {Platform.OS === "web" ? (
        <YStack gap="$1">
          <Text kind="label">{t("dueLabel", { date: formatDate(dueOn, locale, { timeZone }) })}</Text>
          <input
            type="date"
            value={dueOn}
            min={minDue}
            max={maxDue}
            aria-label={t("dueHint")}
            onChange={function handleWebDate(event) {
              setDueOn(event.target.value);
            }}
          />
          <Text kind="caption" tone="muted">
            {t("dueCaption", { max: maxCaption })}
          </Text>
        </YStack>
      ) : (
        <YStack gap="$1">
          <Button
            label={t("dueLabel", { date: formatDate(dueOn, locale, { timeZone }) })}
            variant="ghost"
            onPress={function openPicker() {
              setShowPicker(true);
            }}
          />
          <Text kind="caption" tone="muted">
            {t("dueCaption", { max: maxCaption })}
          </Text>
          {showPicker ? (
            <DateTimePicker
              value={ymdToDate(dueOn)}
              mode="date"
              minimumDate={ymdToDate(minDue)}
              maximumDate={ymdToDate(maxDue)}
              onChange={function handleNativeDate(_event, value) {
                setShowPicker(Platform.OS === "ios");
                if (value) setDueOn(dateToYmd(value, timeZone));
              }}
            />
          ) : null}
        </YStack>
      )}
      <Switch
        label={t("showOwner")}
        checked={holderVisibleToOwner}
        onChange={setHolderVisibleToOwner}
      />
      <Text kind="caption" tone="muted">
        {t("showOwnerHint")}
      </Text>
      <Switch
        label={t("showOthers")}
        checked={holderVisibleToOthers}
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