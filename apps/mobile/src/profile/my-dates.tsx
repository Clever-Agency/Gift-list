import {
  PERSONAL_DATE_MIN_YEAR,
  PERSONAL_DATE_TITLE_MAX,
  type PersonalDate,
  type PersonalDateCreateBody,
} from "@gift-list/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import {
  createMyDate,
  deleteMyDate,
  listMyDates,
  updateMyDate,
} from "@/api/personal-dates";
import { mutationErrorMessage } from "@/session/form-issue";
import {
  PersonalDatesSection,
  type PersonalDateSaveResult,
  type PersonalDatesSectionProps,
} from "@/profile/personal-dates-section";

type ToastNote = (message: string, tone: "info" | "error") => void;

/**
 * The stateful half of «Мои даты» (Story 7.5): the read of `GET /api/v1/me/dates`,
 * the create, edit and delete requests, the toasts and the dead-session path.
 * The visible block stays presentational, so its story needs no network.
 */
export function MyDatesSection({
  onToast,
  onExpired,
}: {
  onToast: ToastNote;
  onExpired: () => Promise<void>;
}) {
  const t = useTranslations("app");
  const d = useTranslations("app.profile.dates");
  const common = useTranslations("common");
  const [dates, setDates] = useState<PersonalDate[]>([]);
  const [status, setStatus] = useState<PersonalDatesSectionProps["status"]>("loading");
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const savingInFlight = useRef(false);

  useEffect(
    function loadDates() {
      let cancelled = false;
      void listMyDates().then(function applyDates(result) {
        if (cancelled) return;
        if (result.ok) {
          setDates(result.data);
          setStatus("ready");
          return;
        }
        setStatus("error");
        if (
          !("invalid" in result) &&
          !("network" in result) &&
          result.code === "UNAUTHENTICATED"
        ) {
          void onExpired();
        }
      });
      return function stopDatesRead() {
        cancelled = true;
      };
    },
    // `onExpired` reads the current session path and must not restart the read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attempt],
  );

  const retry = useCallback(function retryDates() {
    setStatus("loading");
    setAttempt((value) => value + 1);
  }, []);

  /** One line for a failed write: the reason under a field or a toast, like the neighbours. */
  function reportFailure(
    result: Exclude<Awaited<ReturnType<typeof createMyDate>>, { ok: true }>,
    body: PersonalDateCreateBody,
  ): PersonalDateSaveResult {
    if ("network" in result) {
      onToast(t("form.network"), "error");
      return { ok: false, message: t("form.network") };
    }
    if ("invalid" in result) {
      onToast(common("errors.generic"), "error");
      return { ok: false, message: common("errors.generic") };
    }
    if (result.code === "UNAUTHENTICATED") {
      void onExpired();
      return { ok: false, message: common("errors.code.UNAUTHENTICATED") };
    }
    if (result.reason === "DATES_LIMIT") {
      onToast(common("errors.reason.DATES_LIMIT"), "error");
      // The count in the list is stale: read the stored rows back.
      setAttempt((value) => value + 1);
      return { ok: false, message: common("errors.reason.DATES_LIMIT") };
    }
    if (result.field === "title") {
      const title = body.title.trim();
      const message =
        title === ""
          ? d("titleRequired")
          : Array.from(title).length > PERSONAL_DATE_TITLE_MAX
            ? d("titleTooLong", { max: PERSONAL_DATE_TITLE_MAX })
            : common("errors.code.VALIDATION");
      return { ok: false, field: "title", message };
    }
    if (result.field === "day" || result.field === "month") {
      return { ok: false, field: "day", message: d("dateInvalid") };
    }
    if (result.field === "year") {
      const message =
        body.year !== null && body.year !== undefined && body.year < PERSONAL_DATE_MIN_YEAR
          ? d("yearTooEarly", { min: PERSONAL_DATE_MIN_YEAR })
          : d("yearFuture");
      return { ok: false, field: "year", message };
    }
    const message = mutationErrorMessage(result, common);
    onToast(message, "error");
    return { ok: false, message };
  }

  async function saveDate(
    id: string | null,
    body: PersonalDateCreateBody,
  ): Promise<PersonalDateSaveResult> {
    if (savingInFlight.current) return { ok: false, message: "" };
    savingInFlight.current = true;
    setSaving(true);

    const result = id === null ? await createMyDate(body) : await updateMyDate(id, body);

    savingInFlight.current = false;
    setSaving(false);

    if (result.ok) {
      setDates(function applySaved(current) {
        if (id === null) return [...current, result.data];
        return current.map((date) => (date.id === id ? result.data : date));
      });
      onToast(d("saved"), "info");
      return { ok: true };
    }
    return reportFailure(result, body);
  }

  async function removeDate(id: string): Promise<boolean> {
    const result = await deleteMyDate(id);
    if (result.ok) {
      setDates(function applyRemoved(current) {
        return current.filter((date) => date.id !== id);
      });
      onToast(d("deleted"), "info");
      return true;
    }
    if ("network" in result) {
      onToast(t("form.network"), "error");
      return false;
    }
    if ("invalid" in result) {
      onToast(common("errors.generic"), "error");
      return false;
    }
    if (result.code === "UNAUTHENTICATED") {
      await onExpired();
      return false;
    }
    onToast(mutationErrorMessage(result, common), "error");
    return false;
  }

  return (
    <PersonalDatesSection
      dates={dates}
      status={status}
      saving={saving}
      onRetry={retry}
      onSave={saveDate}
      onDelete={removeDate}
    />
  );
}

MyDatesSection.displayName = "MyDatesSection";
