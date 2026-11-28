import {
  Button,
  Choice,
  ChoiceList,
  Close,
  Dialog,
  SearchField,
  spacing,
  Text,
  useThemeColor,
  YStack,
} from "@gift-list/ui";
import { useState } from "react";
import { useLocale, useTranslations } from "use-intl";

export type PickerOption = { value: string; label: string };

type OptionFieldProps = {
  /** Visible label and the dialog title. */
  label: string;
  /** The accessible name, when the visible label alone is ambiguous. */
  accessibleLabel?: string;
  value: string | null;
  /**
   * The option that clears the field and the text of the empty button. Without
   * it the field always has a value (the time zone) and no «not set» row is shown.
   */
  emptyLabel?: string;
  options: readonly PickerOption[];
  onChange: (value: string | null) => void;
  error?: string;
  search?: { label: string; placeholder: string; clearLabel: string; empty: string };
  testID?: string;
};

/**
 * A simple accessible select (CLE-129/T8.3, Story 7.2): a labelled button shows
 * the chosen value, and the shared `Dialog` with a `radiogroup` of `Choice` rows
 * makes the choice. There is no separate `Select` in `@gift-list/ui`, and no new
 * dependency is allowed; hover and focus come from `Button`, `Choice` and
 * `SearchField` of the package. «Профиль» uses it for the country, «Настройки» —
 * for the IANA time zone.
 */
export function OptionField({
  label,
  accessibleLabel,
  value,
  emptyLabel,
  options,
  onChange,
  error,
  search,
  testID,
}: OptionFieldProps) {
  const t = useTranslations("app");
  const locale = useLocale();
  const iconColor = useThemeColor("foreground");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((option) => option.value === value);
  const current = selected?.label ?? emptyLabel ?? "";
  const needle = query.trim().toLocaleLowerCase(locale);
  const shown =
    needle === ""
      ? options
      : options.filter((option) => option.label.toLocaleLowerCase(locale).includes(needle));

  function openLayer() {
    setQuery("");
    setOpen(true);
  }

  function closeLayer() {
    setOpen(false);
  }

  function selectOption(next: string | null) {
    setOpen(false);
    onChange(next);
  }

  function chooseEmpty() {
    selectOption(null);
  }

  return (
    <YStack gap="$1" flex={1} minWidth={0} testID={testID}>
      <Text kind="label">{label}</Text>
      <Button
        variant="outline"
        label={current}
        ariaLabel={`${accessibleLabel ?? label}: ${current}`}
        onPress={openLayer}
      />
      {error ? (
        <Text kind="caption" tone="destructive" role="alert">
          {error}
        </Text>
      ) : null}
      <Dialog
        open={open}
        title={label}
        onClose={closeLayer}
        layout="detail"
        testID={testID ? `${testID}-layer` : undefined}
        closeAction={{
          label: t("toast.close"),
          icon: <Close size={spacing["icon-nav"]} color={iconColor} />,
        }}
      >
        <YStack gap="$grid-gap">
          {search ? (
            <SearchField
              label={search.label}
              placeholder={search.placeholder}
              value={query}
              onChangeText={setQuery}
              clearLabel={search.clearLabel}
            />
          ) : null}
          {search && needle !== "" && shown.length === 0 ? (
            <Text kind="caption" tone="muted">
              {search.empty}
            </Text>
          ) : null}
          <ChoiceList label={label} variant="row">
            {emptyLabel === undefined ? null : (
              <Choice
                variant="row"
                label={emptyLabel}
                selected={value === null}
                onPress={chooseEmpty}
              />
            )}
            {shown.map(function renderOption(option) {
              function chooseOption() {
                selectOption(option.value);
              }

              return (
                <Choice
                  key={option.value}
                  variant="row"
                  label={option.label}
                  selected={option.value === value}
                  onPress={chooseOption}
                />
              );
            })}
          </ChoiceList>
        </YStack>
      </Dialog>
    </YStack>
  );
}

OptionField.displayName = "OptionField";
