import { passwordResetBodySchema } from "@gift-list/contracts";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Text } from "react-native";
import { useTranslations } from "use-intl";
import { apiRequest } from "@/api/client";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { firstZodField, formIssue, issueFromError, type FormIssue } from "@/session/form-issue";
import { paramValue } from "@/session/return-path";
import { AnonymousScreen } from "@/ui/anonymous-screen";
import { navLinkStyle } from "@/ui/nav-link";
import { PrimaryButton } from "@/ui/primary-button";
import { PasswordField } from "@/ui/text-field";

// NOTE FOR UX: reset.* и email.passwordReset нет в EXPERIENCE — строки из спеки 1.7.

export default function ResetScreen() {
  const t = useTranslations("app");
  const common = useTranslations("common");
  const brand = getBrandName();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = paramValue(params.token) ?? "";
  const linkMissing = token.trim().length === 0;
  const [password, setPassword] = useState("");
  const [issue, setIssue] = useState<FormIssue | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const auth = useAuth();
  const flight = useRef(false);

  const stale = linkMissing || issue?.reason === "RESET_LINK_STALE";

  function change(value: string) {
    setPassword(value);
    setIssue((current) => (current?.field === "password" ? null : current));
  }

  async function submit() {
    if (flight.current || linkMissing || saved) return;
    flight.current = true;
    setIssue(null);
    const parsed = passwordResetBodySchema.safeParse({ token, password });
    if (!parsed.success) {
      flight.current = false;
      const field = firstZodField(parsed.error.issues[0]?.path);
      setIssue(
        issueFromError(
          { ok: false, code: "VALIDATION", message: "Invalid input", ...(field ? { field } : {}) },
          t,
          common,
          "reset",
        ),
      );
      return;
    }
    setPending(true);
    const result = await apiRequest<{ saved: true }>("/api/v1/password/reset", {
      method: "POST",
      body: parsed.data,
    });
    setPending(false);
    if (!result.ok) {
      flight.current = false;
      setIssue(formIssue(result, t, common, "reset"));
      return;
    }
    await auth.signOut();
    setSaved(true);
  }

  return (
    <>
      <Stack.Screen options={{ title: t("reset.pageTitle", { brand }) }} />
      <AnonymousScreen title={t("reset.title")}>
        {saved ? (
          <Text accessibilityLiveRegion="polite">{t("reset.done")}</Text>
        ) : null}
        {stale ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite">
            {common("errors.reason.RESET_LINK_STALE")}
          </Text>
        ) : null}
        {!saved && !stale && issue && !issue.field ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite">
            {issue.text}
          </Text>
        ) : null}
        {saved ? (
          <Link href="/login" style={navLinkStyle} accessibilityRole="link">
            {t("forgot.toLogin")}
          </Link>
        ) : null}
        {stale ? (
          <Link href="/forgot" style={navLinkStyle} accessibilityRole="link">
            {t("reset.sendAgain")}
          </Link>
        ) : null}
        {!saved && !stale ? (
          <>
            <PasswordField
              label={t("form.password")}
              value={password}
              onChangeText={change}
              error={issue?.field === "password" ? issue.text : undefined}
              showLabel={t("form.showPassword")}
              input={{
                autoCapitalize: "none",
                autoComplete: "new-password",
                autoCorrect: false,
                textContentType: "newPassword",
                onSubmitEditing: () => void submit(),
              }}
            />
            <PrimaryButton label={t("reset.submit")} onPress={() => void submit()} disabled={pending} />
          </>
        ) : null}
      </AnonymousScreen>
    </>
  );
}
