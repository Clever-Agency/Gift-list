import { passwordForgotBodySchema } from "@gift-list/contracts";
import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import { useTranslations } from "use-intl";
import { apiRequest } from "@/api/client";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { firstZodField, formIssue, issueFromError, type FormIssue } from "@/session/form-issue";
import { paramValue, returnPath } from "@/session/return-path";
import { AnonymousScreen } from "@/ui/anonymous-screen";
import { navLinkStyle } from "@/ui/nav-link";
import { PrimaryButton } from "@/ui/primary-button";
import { TextField } from "@/ui/text-field";

// NOTE FOR UX: forgot.submit и forgot.sent нет в EXPERIENCE — строки из спеки 1.7.

export default function ForgotScreen() {
  const t = useTranslations("app");
  const common = useTranslations("common");
  const brand = getBrandName();
  const params = useLocalSearchParams<{ next?: string; email?: string }>();
  const next = returnPath(params.next);
  const auth = useAuth();
  const [email, setEmail] = useState(paramValue(params.email) ?? "");
  const [issue, setIssue] = useState<FormIssue | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const flight = useRef(false);
  const requestId = useRef(0);

  function change(value: string) {
    requestId.current += 1;
    setEmail(value);
    setSent(false);
    setIssue((current) => (current?.field === "email" ? null : current));
  }

  useEffect(() => {
    if (auth.state.status === "ready") router.replace(next as "/");
  }, [auth.state.status, next]);

  async function submit() {
    if (flight.current) return;
    flight.current = true;
    const id = ++requestId.current;
    setIssue(null);
    const parsed = passwordForgotBodySchema.safeParse({ email });
    if (!parsed.success) {
      flight.current = false;
      const field = firstZodField(parsed.error.issues[0]?.path);
      setIssue(
        issueFromError(
          { ok: false, code: "VALIDATION", message: "Invalid input", ...(field ? { field } : {}) },
          t,
          common,
          "forgot",
        ),
      );
      return;
    }
    setPending(true);
    const result = await apiRequest<{ accepted: true }>("/api/v1/password/forgot", {
      method: "POST",
      body: parsed.data,
    });
    flight.current = false;
    setPending(false);
    if (id !== requestId.current) return;
    if (!result.ok) {
      setIssue(formIssue(result, t, common, "forgot"));
      setSent(false);
      return;
    }
    setSent(true);
  }

  const loginHref = {
    pathname: "/login" as const,
    params: { ...(next !== "/" ? { next } : {}), ...(email ? { email } : {}) },
  };

  return (
    <>
      <Stack.Screen options={{ title: t("forgot.pageTitle", { brand }) }} />
      <AnonymousScreen title={t("forgot.title")}>
        {sent ? (
          <Text accessibilityLiveRegion="polite">{t("forgot.sent")}</Text>
        ) : null}
        {issue && !issue.field ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite">
            {issue.text}
          </Text>
        ) : null}
        <TextField
          label={t("form.email")}
          value={email}
          onChangeText={change}
          error={issue?.field === "email" ? issue.text : undefined}
          input={{
            autoCapitalize: "none",
            autoComplete: "username",
            autoCorrect: false,
            inputMode: "email",
            keyboardType: "email-address",
            textContentType: "username",
            onSubmitEditing: () => void submit(),
          }}
        />
        <PrimaryButton label={t("forgot.submit")} onPress={() => void submit()} disabled={pending} />
        <Link href={loginHref} style={navLinkStyle} accessibilityRole="link">
          {t("forgot.toLogin")}
        </Link>
      </AnonymousScreen>
    </>
  );
}
