import { isWeb, styled } from "@tamagui/core";
import { Input as BehaviorInput, TextArea as BehaviorTextArea } from "@tamagui/input";
import { YStack } from "@tamagui/stacks";
import { forwardRef, useId, useState, type ComponentProps, type ComponentRef } from "react";
import { a11yHintProps } from "./a11y-hint";
import { focusRing } from "./focus-ring";
import { fontFor } from "./font-style";
import { useHoverTransition } from "./hover";
import { Close, Eye, EyeOff, Search } from "./icons";
import { passwordToggleA11yProps } from "./password-toggle-a11y";
import { Pressable } from "./pressable";
import { Text } from "./text";
import { useThemeColor } from "./theme-color";
import { spacing } from "./tokens";

const inputSkin = {
  ...fontFor("body"),
  fontSize: "$body",
  lineHeight: "$body",
  color: "$foreground",
  backgroundColor: "$surface",
  placeholderTextColor: "$muted-foreground",
  borderWidth: 1,
  // v8 fields: border-strong at rest, a darker hairline on hover, `ring` on focus
  // plus the 2 px ring with a 2 px offset (`focusRing`); error — `destructive`.
  borderColor: "$border-strong hover:$muted-foreground focus:$ring",
  borderRadius: "$md",
  minHeight: "$control-height",
  paddingHorizontal: "$3",
  ...focusRing,
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

/**
 * React Native names the keyboard's action key `returnKeyType`; a browser reads
 * the same hint as `enterKeyHint`. The web half of Tamagui's input drops the
 * native name, so the field passes the browser spelling next to it — the phone
 * half maps `enterKeyHint` back when `returnKeyType` is absent.
 */
const ENTER_KEY_HINTS = {
  done: "done",
  enter: "enter",
  go: "go",
  next: "next",
  previous: "previous",
  search: "search",
  send: "send",
} as const;

function withEnterKeyHint(input: TextFieldInputProps | undefined): TextFieldInputProps | undefined {
  if (!input || input.enterKeyHint !== undefined || !input.returnKeyType) return input;
  const hint = ENTER_KEY_HINTS[input.returnKeyType as keyof typeof ENTER_KEY_HINTS];
  return hint ? { ...input, enterKeyHint: hint } : input;
}

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
          // An error is an alert: it is assertive on its own, so a `polite`
          // live region next to it would contradict the role. A hint is not a
          // message to interrupt; it stays polite.
          role={error ? "alert" : undefined}
          aria-live={error ? undefined : "polite"}
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
  // The frame colour changes on hover with the `quick` preset (CLE-129).
  const transition = useHoverTransition();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <Control
        {...(withEnterKeyHint(input) as object)}
        ref={ref as never}
        id={id}
        transition={transition}
        value={value}
        onChangeText={onChangeText}
        invalid={Boolean(error)}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        {...a11yHintProps({
          hint: described,
          describedBy: described ? `${id}-description` : undefined,
        })}
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
    const transition = useHoverTransition();

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
            {...(withEnterKeyHint(input) as object)}
            ref={ref as never}
            id={id}
            width="100%"
            value={value}
            onChangeText={onChangeText}
            secureTextEntry={!visible}
            type={visible ? "text" : "password"}
            transition={transition}
            // The text never runs under the toggle: its width is the field's right inset.
            paddingRight={spacing["touch-target"]}
            invalid={Boolean(error)}
            aria-label={label}
            aria-invalid={error ? true : undefined}
            {...a11yHintProps({
              hint: described,
              describedBy: described ? `${id}-description` : undefined,
            })}
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

export type SearchFieldProps = {
  /** The accessible name of the field; the visible copy is the placeholder. */
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  /** The accessible name of the clear (×) button, e.g. «Очистить». */
  clearLabel: string;
  /** Everything else of the input: `maxLength`, `autoCapitalize`, `onSubmitEditing`… */
  input?: TextFieldInputProps;
  testID?: string;
};

/**
 * `DESIGN.md` → Мелкие элементы: SearchField — a field with a magnifier and the
 * clear (×) button. Both sit in 44×44 touch zones inside the control, so the
 * text never runs under them. The clear button appears only when there is
 * something to clear; it presses with Enter/Space and returns focus to the input.
 */
export const SearchField = forwardRef<FieldInputRef, SearchFieldProps>(function SearchField(
  { label, placeholder, value, onChangeText, clearLabel, input, testID },
  ref,
) {
  const id = useId();
  const canClear = value.length > 0;
  const mutedIcon = useThemeColor("muted-foreground");
  const clearIcon = useThemeColor("foreground");
  const transition = useHoverTransition();

  function clear() {
    onChangeText("");
  }

  // A browser press on the button would move focus out of the field; clearing
  // types nothing, so the caret stays where the next character belongs.
  function keepFieldFocus(event: { preventDefault: () => void }) {
    event.preventDefault();
  }

  return (
    <YStack gap="$1">
      <YStack position="relative" justifyContent="center">
        <InputFrame
          {...(input as object)}
          ref={ref as never}
          id={id}
          testID={testID}
          width="100%"
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          transition={transition}
          // The icons own the field's edges: the text starts after the magnifier
          // and ends before the clear button.
          paddingLeft={spacing["touch-target"]}
          paddingRight={canClear ? spacing["touch-target"] : undefined}
          aria-label={label}
        />
        <YStack
          position="absolute"
          left={0}
          top={0}
          bottom={0}
          width="$touch-target"
          alignItems="center"
          justifyContent="center"
          pointerEvents="none"
        >
          <Search size={spacing["icon-inline"]} color={mutedIcon} />
        </YStack>
        {canClear ? (
          <Pressable
            aria-label={clearLabel}
            onPress={clear}
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
            <Close size={spacing["icon-inline"]} color={clearIcon} />
          </Pressable>
        ) : null}
      </YStack>
    </YStack>
  );
});

SearchField.displayName = "SearchField";
