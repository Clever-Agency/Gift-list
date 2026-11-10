import { isWeb, styled } from "@tamagui/core";
import { Input as BehaviorInput, TextArea as BehaviorTextArea } from "@tamagui/input";
import { YStack } from "@tamagui/stacks";
import { forwardRef, useId, useState, type ComponentProps, type ComponentRef } from "react";
import { fontFor } from "./font-style";
import { Eye, EyeOff } from "./icons";
import { passwordToggleA11yProps } from "./password-toggle-a11y";
import { Pressable } from "./pressable";
import { Text } from "./text";
import { spacing } from "./tokens";

const inputSkin = {
  ...fontFor("body"),
  fontSize: "$body",
  lineHeight: "$body",
  color: "$foreground",
  backgroundColor: "$surface",
  placeholderTextColor: "$muted-foreground",
  borderWidth: 1,
  borderColor: "$border-strong focus:$ring",
  borderRadius: "$sm",
  minHeight: "$control-height",
  paddingHorizontal: "$3",
  outlineWidth: 0,
  variants: {
    invalid: {
      true: { borderColor: "$destructive focus:$destructive" },
    },
  } as const,
} as const;

const InputFrame = styled(BehaviorInput, { name: "GLInput", ...inputSkin });
const TextAreaFrame = styled(BehaviorTextArea, {
  name: "GLTextArea",
  ...inputSkin,
  paddingVertical: "$2",
  // Android centres multi-line text by default; the description starts at the top.
  textAlignVertical: "top",
});

/** Props of the underlying input that the caller may set (the field owns the rest). */
export type TextFieldInputProps = Omit<
  ComponentProps<typeof InputFrame>,
  | "value"
  | "onChangeText"
  | "id"
  | "invalid"
  | "secureTextEntry"
  | "aria-label"
  | "aria-invalid"
  | "aria-describedby"
  | "children"
>;

export type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  /** Shown in `destructive` under the field and read as an alert. */
  error?: string;
  /** Shown in `muted-foreground` under the field when there is no error. */
  hint?: string;
  /** Multi-line (`<textarea>` on the web), `rows` lines tall. */
  multiline?: boolean;
  rows?: number;
  /** Everything else of the input: `keyboardType`, `autoComplete`, `onSubmitEditing`, `maxLength`… */
  input?: TextFieldInputProps;
};

export type FieldInputRef = ComponentRef<typeof InputFrame>;

type FieldShellProps = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
};

/** The label, the control and the described-by line shared by both fields. */
function FieldShell({ id, label, error, hint, children }: FieldShellProps) {
  const described = error || hint;
  return (
    <YStack gap="$1">
      <Text kind="label" render="label" htmlFor={id}>
        {label}
      </Text>
      {children}
      {described ? (
        <Text
          key={error ? "error" : "hint"}
          id={`${id}-description`}
          kind="caption"
          tone={error ? "destructive" : "muted"}
          role={error ? "alert" : undefined}
          aria-live="polite"
        >
          {described}
        </Text>
      ) : null}
    </YStack>
  );
}

FieldShell.displayName = "FieldShell";

/**
 * A labelled text input (`DESIGN.md` → components `input`): `surface`, a
 * `border-strong` border that turns `ring` on focus and `destructive` on error,
 * 48 px tall. The error is tied to the field with `aria-describedby`
 * and `aria-invalid`; on the phone the same text is the accessibility hint.
 */
export const TextField = forwardRef<FieldInputRef, TextFieldProps>(function TextField(
  { label, value, onChangeText, error, hint, multiline, rows, input },
  ref,
) {
  const id = useId();
  const described = error || hint;
  const Control = multiline ? TextAreaFrame : InputFrame;
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <Control
        {...(input as object)}
        ref={ref as never}
        id={id}
        value={value}
        onChangeText={onChangeText}
        invalid={Boolean(error)}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={described ? `${id}-description` : undefined}
        accessibilityHint={described}
        {...(multiline ? { rows: rows ?? 3, multiline: true } : null)}
      />
    </FieldShell>
  );
});

TextField.displayName = "TextField";

export type PasswordFieldProps = Omit<TextFieldProps, "multiline" | "rows"> & {
  /**
   * The reveal toggle's accessible name, e.g. «Показать пароль». The button shows
   * only an icon and keeps this name in both states; the state is `aria-pressed`
   * on the web and `accessibilityState.checked` on the phone.
   */
  showLabel: string;
};

/**
 * `TextField` that hides its text, with an icon-only button to reveal it
 * (`DESIGN.md` → «Поля входа»): the button sits inside the field on the right,
 * its name is `showLabel` and its state is `aria-pressed` on the web,
 * `accessibilityState.checked` on the phone, so the visible words are not
 * needed. A hidden password shows `Eye`, a revealed one `EyeOff`.
 */
export const PasswordField = forwardRef<FieldInputRef, PasswordFieldProps>(
  function PasswordField({ label, value, onChangeText, error, hint, showLabel, input }, ref) {
    const id = useId();
    const [visible, setVisible] = useState(false);
    const described = error || hint;

    function handleToggleVisibility() {
      setVisible((current) => !current);
    }

    // In a browser a press on a focusable element moves focus (and the caret) out
    // of the input; the toggle types nothing, so the field keeps both.
    function keepFieldFocus(event: { preventDefault: () => void }) {
      event.preventDefault();
    }

    return (
      <FieldShell id={id} label={label} error={error} hint={hint}>
        <YStack position="relative" justifyContent="center">
          <InputFrame
            {...(input as object)}
            ref={ref as never}
            id={id}
            width="100%"
            value={value}
            onChangeText={onChangeText}
            secureTextEntry={!visible}
            type={visible ? "text" : "password"}
            // The text never runs under the toggle: its width is the field's right inset.
            paddingRight={spacing["touch-target"]}
            invalid={Boolean(error)}
            aria-label={label}
            aria-invalid={error ? true : undefined}
            aria-describedby={described ? `${id}-description` : undefined}
            accessibilityHint={described}
          />
          <Pressable
            {...passwordToggleA11yProps(visible)}
            aria-label={showLabel}
            onPress={handleToggleVisibility}
            onMouseDown={isWeb ? keepFieldFocus : undefined}
            position="absolute"
            right={0}
            top={0}
            bottom={0}
            width="$touch-target"
            alignItems="center"
            justifyContent="center"
            color="$foreground"
          >
            {visible ? (
              <EyeOff size={spacing["icon-inline"]} />
            ) : (
              <Eye size={spacing["icon-inline"]} />
            )}
          </Pressable>
        </YStack>
      </FieldShell>
    );
  },
);

PasswordField.displayName = "PasswordField";
