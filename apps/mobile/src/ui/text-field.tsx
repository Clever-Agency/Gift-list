import {
  PasswordField as UiPasswordField,
  TextField as UiTextField,
  type PasswordFieldProps,
  type TextFieldProps,
} from "@gift-list/ui";
import type { Ref } from "react";
import type { TextInputInstance } from "react-native";

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  hint?: string;
  /** Everything else of the input: `keyboardType`, `autoComplete`, `onSubmitEditing`… */
  input?: TextFieldProps["input"] & {
    /** React Native's name for a read-only field; the package spells it `readOnly`. */
    editable?: boolean;
  };
  /** Lets the screen move focus back to the field, e.g. after a server-side error. */
  inputRef?: Ref<TextInputInstance>;
};

/**
 * Labelled text field of the app. The look and the accessibility wiring (label,
 * `aria-describedby`, `aria-invalid`, alert for the error) live in `@gift-list/ui`;
 * this wrapper keeps the `inputRef` name the screens already use.
 */
export function TextField({ inputRef, input, ...props }: FieldProps) {
  return <UiTextField {...props} input={withReadOnly(input)} ref={inputRef as never} />;
}

TextField.displayName = "TextField";

function withReadOnly(input: FieldProps["input"]): TextFieldProps["input"] {
  if (!input) return input;
  const { editable, ...rest } = input;
  return editable === false ? { ...rest, readOnly: true } : rest;
}

/** The password field with its «Показать» toggle (`showLabel` is the catalogue text). */
export function PasswordField({ input, ...props }: Omit<PasswordFieldProps, "input"> & { input?: FieldProps["input"] }) {
  return <UiPasswordField {...props} input={withReadOnly(input)} />;
}

PasswordField.displayName = "PasswordField";
