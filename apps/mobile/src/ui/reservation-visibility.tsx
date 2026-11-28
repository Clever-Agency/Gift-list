import { Switch } from "@gift-list/ui";
import { useTranslations } from "use-intl";

export type ReservationVisibilityValues = {
  holderVisibleToOthers: boolean;
};

export type ReservationVisibilityProps = {
  values: ReservationVisibilityValues;
  /** A request of this card is in flight: the switch shows the stored value only. */
  busy?: boolean;
  /** The value travels with one `visibility` action owned by the screen. */
  onChange: (next: ReservationVisibilityValues) => void;
  testID?: string;
};

/**
 * «Показывать другим гостям, что дарю я» (D-57, `DESIGN.md` → ReservationCard,
 * `EXPERIENCE.md` → Reservation actions): the holder's one switch, shown as is,
 * without a disclosure. CLE-124/D-49 removed the «Показать владельцу» switch: the
 * owner never learns about a reservation. Its value travels in the `visibility`
 * action, and the screen stays the one place that decides what is sent.
 */
export function ReservationVisibility({
  values,
  busy,
  onChange,
  testID,
}: ReservationVisibilityProps) {
  const t = useTranslations("app.reservations.visibility");

  function changeOthers(next: boolean) {
    onChange({ holderVisibleToOthers: next });
  }

  return (
    <Switch
      label={t("others")}
      checked={values.holderVisibleToOthers}
      disabled={busy}
      onChange={changeOthers}
      testID={testID}
    />
  );
}

ReservationVisibility.displayName = "ReservationVisibility";
