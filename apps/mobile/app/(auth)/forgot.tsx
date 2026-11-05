import { Text } from "@gift-list/ui";
import { passwordForgotBodySchema } from "@gift-list/contracts";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { apiRequest } from "@/api/client";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { rememberAuthEmail } from "@/session/auth-navigation";
import { firstZodField, formIssue, issueFromError, type FormIssue } from "@/session/form-issue";
import { returnPath } from "@/session/return-path";
import { useCarriedAuthEmail } from "@/session/use-carried-auth-email";
import { AnonymousScreen } from "@/ui/anonymous-screen";
import { NavLink } from "@/ui/nav-link";
import { PrimaryButton } from "@/ui/primary-button";
import { TextField } from "@/ui/text-field";

// NOTE FOR UX: forgot.submit и forgot.sent нет в EXPERIENCE — строки из спеки 1.7.

export default function ForgotScreen() {
  const t = useTranslations("app");
  const common = useTranslations("common");
  const brand = getBrandName();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = returnPath(params.next);
  const auth = useAuth();
  const [email, setEmail] = useCarriedAuthEmail("/forgot");
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

  useEffect(function redirectWhenReady() {
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

  function handleSubmit() {
    void submit();
  }

  function rememberEmail() {
    rememberAuthEmail("/login", email);
  }

  const loginHref = {
    pathname: "/login" as const,
    params: next !== "/" ? { next } : {},
  };

  return (
    <>
      <Stack.Screen options={{ title: t("forgot.pageTitle", { brand }) }} />
      <AnonymousScreen title={t("forgot.title")}>
        {sent ? (
          <Text aria-live="polite">{t("forgot.sent")}</Text>
        ) : null}
        {issue && !issue.field ? (
          <Text role="alert" aria-live="polite">
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
            onSubmitEditing: handleSubmit,
          }}
        />
        <PrimaryButton label={t("forgot.submit")} onPress={handleSubmit} disabled={pending} />
        <NavLink href={loginHref} onPress={rememberEmail}>
          {t("forgot.toLogin")}
        </NavLink>
      </AnonymousScreen>
    </>
  );
}

ForgotScreen.displayName = "ForgotScreen";
