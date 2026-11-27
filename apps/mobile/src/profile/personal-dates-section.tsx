import {
  DATE_VISIBILITIES,
  PERSONAL_DATES_MAX,
  PERSONAL_DATE_MIN_YEAR,
  PERSONAL_DATE_TITLE_MAX,
  isValidPersonalDate,
  isPersonalDateYearAllowed,
  type DateVisibility,
  type PersonalDate,
  type PersonalDateCreateBody,
} from "@gift-list/contracts";
import { Button, Heading, Text, XStack, YStack } from "@gift-list/ui";
import { useId, useMemo, useRef, useState } from "react";
import type { TextInputInstance } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { personalDateText } from "@/profile/personal-date-text";
import { dayOptions, monthOptions } from "@/ui/date-options";
import { OptionField } from "@/ui/option-field";
import { TextField } from "@/ui/text-field";
import { ConfirmDialog } from "@/ui/confirm-dialog";

/** A field the server or the client named, so the form can show the reason there. */
export type PersonalDateFormField = "title" | "day" | "year";

/** A failed save: `field` keeps the reason under the field, otherwise it is a toast. */
export type PersonalDateSaveResult =
  | { ok: true }
  | { ok: false; field?: PersonalDateFormField; message: string };

export type PersonalDatesSectionProps = {
  dates: readonly PersonalDate[];
  status: "loading" | "ready" | "error";
  /** A create or update is on the wire. */
  saving?: boolean;
  onRetry: () => void;
  /** `id === null` creates; the answer is the stored row, the section only reports it. */
  onSave: (
    id: string | null,
    body: PersonalDateCreateBody,
  ) => Promise<PersonalDateSaveResult>;
  /** The answer says whether the row was removed; the screen owns the toast. */
  onDelete: (id: string) => Promise<boolean>;
};

type FormState = {
  title: string;
  day: number | null;
  month: number | null;
  year: string;
  visibility: DateVisibility;
  yearVisibility: DateVisibility;
};

type FormErrors = {
  title?: string;
  day?: string;
  year?: string;
};

function emptyForm(): FormState {
  return {
    title: "",
    day: null,
    month: null,
    year: "",
    // AD-23: «друзья» for the date, «только я» for the year.
    visibility: "FRIENDS",
    yearVisibility: "ONLY_ME",
  };
}

function formFromDate(date: PersonalDate): FormState {
  return {
    title: date.title,
    day: date.day,
    month: date.month,
    year: date.year === null ? "" : String(date.year),
    visibility: date.visibility,
    yearVisibility: date.yearVisibility,
  };
}

/**
 * «Мои даты» on `/profile` (Story 7.5, FR-38, AD-23): the owner's list, the
 * inline add/edit form and the delete confirmation. The block is presentational:
 * the screen owns the requests and the toasts, so a story can show every state,
 * including a failed save, without a server. Rows show the title, the date (a
 * year only when it is set) and the two visibility switches in one short line.
 */
export function PersonalDatesSection({
  dates,
  status,
  saving = false,
  onRetry,
  onSave,
  onDelete,
}: PersonalDatesSectionProps) {
  const d = useTranslations("app.profile.dates");
  const locale = useLocale();
  const titleInput = useRef<TextInputInstance | null>(null);
  const limitHintId = useId();
  const submitInFlight = useRef(false);

  const [editing, setEditing] = useState<PersonalDate | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [deleting, setDeleting] = useState<PersonalDate | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const months = useMemo(
    function readMonths() {
      return monthOptions(locale);
    },
    [locale],
  );
  const yearValue = form.year.trim() === "" ? null : Number(form.year);
  const days = useMemo(
    function readDays() {
      return dayOptions(form.month, yearValue);
    },
    [form.month, yearValue],
  );
  const visibilityOptions = useMemo(
    function readVisibilityOptions() {
      return DATE_VISIBILITIES.map(function makeVisibility(value) {
        return { value, label: d(`visibilityValue.${value}`) };
      });
    },
    [d],
  );

  const atLimit = dates.length >= PERSONAL_DATES_MAX;
  const titleCount = Array.from(form.title).length;

  function clearError(field: keyof FormErrors) {
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function startCreate() {
    setEditing("new");
    setForm(emptyForm());
    setErrors({});
  }

  function startEdit(date: PersonalDate) {
    setEditing(date);
    setForm(formFromDate(date));
    setErrors({});
  }

  function cancelEdit() {
    setEditing(null);
    setErrors({});
  }

  function changeTitle(value: string) {
    clearError("title");
    setForm((current) => ({ ...current, title: value }));
  }

  function changeDay(value: string | null) {
    clearError("day");
    setForm((current) => ({ ...current, day: value === null ? null : Number(value) }));
  }

  /** A smaller month drops a day that no longer exists; the person picks it again. */
  function changeMonth(value: string | null) {
    clearError("day");
    const month = value === null ? null : Number(value);
    setForm((current) => {
      const nextDays = dayOptions(month, yearValue).map((option) => Number(option.value));
      const day = current.day !== null && nextDays.includes(current.day) ? current.day : null;
      return { ...current, month, day };
    });
  }

  function changeYear(value: string) {
    clearError("year");
    const year = value.replace(/\D/g, "").slice(0, 4);
    setForm((current) => {
      const parsed = year === "" ? null : Number(year);
      const nextDays = dayOptions(current.month, parsed).map((option) => Number(option.value));
      const day = current.day !== null && nextDays.includes(current.day) ? current.day : null;
      return { ...current, year, day };
    });
  }

  function changeVisibility(value: string | null) {
    if (value === null) return;
    setForm((current) => ({ ...current, visibility: value as DateVisibility }));
  }

  function changeYearVisibility(value: string | null) {
    if (value === null) return;
    setForm((current) => ({ ...current, yearVisibility: value as DateVisibility }));
  }

  function validate(): FormErrors {
    const next: FormErrors = {};
    const title = form.title.trim();
    if (title === "") next.title = d("titleRequired");
    else if (titleCount > PERSONAL_DATE_TITLE_MAX) {
      next.title = d("titleTooLong", { max: PERSONAL_DATE_TITLE_MAX });
    }

    const year = form.year.trim() === "" ? null : Number(form.year);
    if (form.year.trim() !== "" && !Number.isInteger(year)) {
      next.year = d("yearInvalid");
    } else if (year !== null && year < PERSONAL_DATE_MIN_YEAR) {
      next.year = d("yearTooEarly", { min: PERSONAL_DATE_MIN_YEAR });
    } else if (year !== null && !isPersonalDateYearAllowed(year)) {
      next.year = d("yearFuture");
    }

    if (form.day === null || form.month === null) {
      next.day = d("dateMissing");
    } else if (!isValidPersonalDate(form.day, form.month, year)) {
      next.day = d("dateInvalid");
    }

    return next;
  }

  function save() {
    if (submitInFlight.current) return;
    const next = validate();
    setErrors(next);
    if (next.title !== undefined) {
      titleInput.current?.focus();
      return;
    }
    if (next.day !== undefined || next.year !== undefined) return;
    if (form.day === null || form.month === null) return;

    const body: PersonalDateCreateBody = {
      title: form.title.trim(),
      day: form.day,
      month: form.month,
      year: yearValue,
      visibility: form.visibility,
      yearVisibility: form.yearVisibility,
    };
    const id = editing === "new" || editing === null ? null : editing.id;
    void submit(id, body);
  }

  async function submit(id: string | null, body: PersonalDateCreateBody) {
    submitInFlight.current = true;
    const result = await onSave(id, body);
    submitInFlight.current = false;
    if (result.ok) {
      setEditing(null);
      setErrors({});
      return;
    }
    if (result.field !== undefined) {
      setErrors(
        result.field === "title"
          ? { title: result.message }
          : result.field === "day"
            ? { day: result.message }
            : { year: result.message },
      );
      if (result.field === "title") titleInput.current?.focus();
    }
  }

  function askDelete(date: PersonalDate) {
    setDeleting(date);
  }

  function cancelDelete() {
    if (deleteBusy) return;
    setDeleting(null);
  }

  function confirmDelete() {
    if (deleting === null || deleteBusy) return;
    const date = deleting;
    setDeleteBusy(true);
    void onDelete(date.id).finally(function deleted() {
      setDeleteBusy(false);
      setDeleting(null);
    });
  }

  function renderDate(date: PersonalDate) {
    const visibility = d(`visibilityValue.${date.visibility}`);
    const yearVisibility =
      date.year === null
        ? null
        : d("yearShort", { visibility: d(`visibilityValue.${date.yearVisibility}`) });
    const meta = [personalDateText(date, locale), visibility, yearVisibility]
      .filter((part): part is string => part !== null)
      .join(" · ");

    return (
      <YStack
        key={date.id}
        testID={`profile-date-${date.id}`}
        gap="$1"
        padding="$3"
        borderWidth={1}
        borderColor="$border"
        borderRadius="$md"
        backgroundColor="$surface"
      >
        <Text kind="body-strong">{date.title}</Text>
        <Text kind="caption" tone="muted">
          {meta}
        </Text>
        <XStack gap="$2" flexWrap="wrap">
          <Button
            variant="ghost"
            label={d("edit")}
            ariaLabel={d("editLabel", { title: date.title })}
            onPress={function editDate() {
              startEdit(date);
            }}
          />
          <Button
            variant="ghost"
            label={d("delete")}
            ariaLabel={d("deleteLabel", { title: date.title })}
            onPress={function removeDate() {
              askDelete(date);
            }}
          />
        </XStack>
      </YStack>
    );
  }

  return (
    <YStack gap="$grid-gap" testID="profile-dates">
      <Heading level={2}>{d("title")}</Heading>

      {status === "loading" ? (
        <Text kind="caption" tone="muted">
          {d("loading")}
        </Text>
      ) : null}

      {status === "error" ? (
        <YStack gap="$grid-gap">
          <Text kind="caption" tone="destructive" role="alert">
            {d("loadError")}
          </Text>
          <Button variant="outline" label={d("retry")} onPress={onRetry} />
        </YStack>
      ) : null}

      {status === "ready" ? (
        <>
          {dates.length === 0 ? (
            <Text kind="caption" tone="muted">
              {d("empty")}
            </Text>
          ) : (
            <YStack gap="$2">{dates.map(renderDate)}</YStack>
          )}

          {editing === null ? (
            <YStack gap="$1">
              <Button
                label={d("add")}
                onPress={startCreate}
                disabled={atLimit}
                ariaDescribedBy={atLimit ? limitHintId : undefined}
              />
              {atLimit ? (
                <Text id={limitHintId} kind="caption" tone="muted">
                  {d("limit")}
                </Text>
              ) : null}
            </YStack>
          ) : (
            <YStack gap="$grid-gap" testID="profile-date-form">
              <Heading level={3}>
                {editing === "new" ? d("form.addTitle") : d("form.editTitle")}
              </Heading>
              <TextField
                label={d("form.title")}
                value={form.title}
                onChangeText={changeTitle}
                error={errors.title}
                hint={d("form.titleCounter", {
                  count: titleCount,
                  max: PERSONAL_DATE_TITLE_MAX,
                })}
                inputRef={titleInput}
                input={{ maxLength: PERSONAL_DATE_TITLE_MAX, placeholder: d("form.titlePlaceholder") }}
              />
              <XStack gap="$3" alignItems="flex-start">
                <OptionField
                  label={d("form.day")}
                  accessibleLabel={d("form.dayLabel")}
                  value={form.day === null ? null : String(form.day)}
                  emptyLabel={d("form.none")}
                  options={days}
                  onChange={changeDay}
                  error={errors.day}
                  testID="profile-date-day"
                />
                <OptionField
                  label={d("form.month")}
                  accessibleLabel={d("form.monthLabel")}
                  value={form.month === null ? null : String(form.month)}
                  emptyLabel={d("form.none")}
                  options={months}
                  onChange={changeMonth}
                  testID="profile-date-month"
                />
              </XStack>
              <TextField
                label={d("form.year")}
                value={form.year}
                onChangeText={changeYear}
                error={errors.year}
                hint={d("form.yearHint")}
                input={{
                  keyboardType: "number-pad",
                  inputMode: "numeric",
                  maxLength: 4,
                  placeholder: d("form.yearPlaceholder"),
                }}
              />
              <OptionField
                label={d("visibility")}
                value={form.visibility}
                options={visibilityOptions}
                onChange={changeVisibility}
                testID="profile-date-visibility"
              />
              {form.year.trim() === "" ? null : (
                <OptionField
                  label={d("yearVisibility")}
                  value={form.yearVisibility}
                  options={visibilityOptions}
                  onChange={changeYearVisibility}
                  testID="profile-date-year-visibility"
                />
              )}
              <XStack gap="$2" flexWrap="wrap">
                <Button
                  label={d("form.save")}
                  onPress={save}
                  busy={saving}
                />
                <Button
                  variant="ghost"
                  label={d("form.cancel")}
                  onPress={cancelEdit}
                  disabled={saving}
                />
              </XStack>
            </YStack>
          )}
        </>
      ) : null}

      <ConfirmDialog
        variant="confirm"
        visible={deleting !== null}
        title={d("deleteTitle", { title: deleting?.title ?? "" })}
        body={d("deleteBody")}
        confirmLabel={d("deleteConfirm")}
        cancelLabel={d("deleteCancel")}
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        onClosed={function deletedClosed() {
          setDeleteBusy(false);
        }}
      />
    </YStack>
  );
}

PersonalDatesSection.displayName = "PersonalDatesSection";
