import { useState, type Ref } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputInstance,
  type TextInputProps,
  type TextStyle,
} from "react-native";
import { colors, rounded, spacing, textStyle } from "@/theme/tokens";

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  hint?: string;
  input: TextInputProps;
  /** Extra styles over the shared box, e.g. the taller multiline description input. */
  inputStyle?: StyleProp<TextStyle>;
  /** Lets the screen move focus back to the field, e.g. after a server-side error. */
  inputRef?: Ref<TextInputInstance>;
};

export function TextField({
  label,
  value,
  onChangeText,
  error,
  hint,
  input,
  inputStyle,
  inputRef,
}: FieldProps) {
  const described = error ?? hint;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors["muted-foreground"]}
        accessibilityLabel={label}
        accessibilityHint={described}
        style={[styles.input, error ? styles.inputError : null, inputStyle]}
        {...input}
      />
      {described ? (
        <Text style={error ? styles.error : styles.hint} accessibilityLiveRegion="polite">
          {described}
        </Text>
      ) : null}
    </View>
  );
}

TextField.displayName = "TextField";

export function PasswordField({
  label,
  value,
  onChangeText,
  error,
  hint,
  showLabel,
  input,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  hint?: string;
  showLabel: string;
  input: TextInputProps;
}) {
  const [visible, setVisible] = useState(false);
  const described = error ?? hint;

  function handleToggleVisibility() {
    setVisible((current) => !current);
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.passwordRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          placeholderTextColor={colors["muted-foreground"]}
          accessibilityLabel={label}
          accessibilityHint={described}
          style={[styles.input, styles.passwordInput, error ? styles.inputError : null]}
          {...input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showLabel}
          accessibilityState={{ selected: visible }}
          onPress={handleToggleVisibility}
          style={styles.reveal}
        >
          <Text style={styles.revealText}>{showLabel}</Text>
        </Pressable>
      </View>
      {described ? (
        <Text
          key={error ? "error" : "hint"}
          style={error ? styles.error : styles.hint}
          accessibilityLiveRegion="polite"
          accessibilityRole={error ? "alert" : undefined}
        >
          {described}
        </Text>
      ) : null}
    </View>
  );
}

PasswordField.displayName = "PasswordField";

const styles = StyleSheet.create({
  field: {
    gap: 4,
  },
  label: {
    ...textStyle("label"),
    color: colors.foreground,
  },
  input: {
    ...textStyle("body"),
    color: colors.foreground,
    backgroundColor: colors.surface,
    borderColor: colors["border-strong"],
    borderWidth: 1,
    borderRadius: rounded.sm,
    minHeight: spacing["control-height"],
    paddingHorizontal: 12,
  },
  inputError: {
    borderColor: colors.destructive,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  passwordInput: {
    flex: 1,
  },
  reveal: {
    minHeight: spacing["touch-target"],
    minWidth: spacing["touch-target"],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  revealText: {
    ...textStyle("caption"),
    color: colors.primary,
  },
  hint: {
    ...textStyle("caption"),
    color: colors["muted-foreground"],
  },
  error: {
    ...textStyle("caption"),
    color: colors.destructive,
  },
});
