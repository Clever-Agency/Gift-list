import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { colors, rounded, spacing, textStyle } from "@/theme/tokens";

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  hint?: string;
  input: TextInputProps;
};

export function TextField({ label, value, onChangeText, error, hint, input }: FieldProps) {
  const described = error ?? hint;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors["muted-foreground"]}
        accessibilityLabel={label}
        accessibilityHint={described}
        style={[styles.input, error ? styles.inputError : null]}
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

export function PasswordField({
  label,
  value,
  onChangeText,
  error,
  showLabel,
  input,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  showLabel: string;
  input: TextInputProps;
}) {
  const [visible, setVisible] = useState(false);
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
          accessibilityHint={error}
          style={[styles.input, styles.passwordInput, error ? styles.inputError : null]}
          {...input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showLabel}
          accessibilityState={{ selected: visible }}
          onPress={() => setVisible((current) => !current)}
          style={styles.reveal}
        >
          <Text style={styles.revealText}>{showLabel}</Text>
        </Pressable>
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

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
