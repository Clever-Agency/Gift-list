import { focusField, Text } from "@gift-list/ui";
import { loginBodySchema, safeNextPath } from "@gift-list/contracts";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import type { TextInputInstance } from "react-native";
import { useTranslations } from "use-intl";
import { apiRequest } from "@/api/client";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { rememberAuthEmail } from "@/session/auth-navigation";
import { firstZodField, formIssue, issueFromError, type FormIssue } from "@/session/form-issue";
import { paramValue, returnPath } from "@/session/return-path";
import { useCarriedAuthEmail } from "@/session/use-carried-auth-email";
import { AnonymousScreen } from "@/ui/anonymous-screen";
import { NavLink } from "@/ui/nav-link";
import { PasswordField, TextField } from "@/ui/text-field";
import { PrimaryButton } from "@/ui/primary-button";
import { ToastHost } from "@/ui/toast";
import type { Me } from "@gift-list/contracts";

export default function LoginScreen() {
  const t = useTranslations("app");
  const common = useTranslations("common");
  const brand = getBrandName();
  const params = useLocalSearchParams<{ next?: string; reason?: string }>();
  const next = returnPath(params.next);
  const auth = useAuth();
  const [email, setEmail] = useCarriedAuthEmail("/login");
  const [password, setPassword] = useState("");
  const [issue, setIssue] = useState<FormIssue | null>(null);
  const [pending, setPending] = useState(false);
  // UI5: submit moves focus to the invalid field and scrolls it into view.
  const emailRef = useRef<TextInputInstance | null>(null);
  const passwordRef = useRef<TextInputInstance | null>(null);
  // The my-wishlist screen signs out on an expired session and hands the notice over
  // in `?reason=`, so it is still on screen after that screen unmounts.
  const [toast, setToast] = useState<string | null>(
    paramValue(params.reason) === "session_expired" ? t("session.expired") : null,
  );

  function change(field: string, setValue: (value: string) => void) {
    return function handleFieldChange(value: string) {
      setValue(value);
      setIssue((current) => (current?.field === field ? null : current));
    };
  }

  /** UI5: the field of the current issue takes focus. */
  function focusIssueField(field: string | undefined) {
    if (field === "email") focusField(emailRef.current);
    else if (field === "password") focusField(passwordRef.current);
  }

  useEffect(function redirectWhenReady() {
    if (auth.state.status === "ready") router.replace(next as "/");
  }, [auth.state.status, next]);

  async function submit() {
    setIssue(null);
    const parsed = loginBodySchema.safeParse({ email, password, next });
    if (!parsed.success) {
      const field = firstZodField(parsed.error.issues[0]?.path);
      setIssue(
        issueFromError(
          { ok: false, code: "VALIDATION", message: "Invalid input", ...(field ? { field } : {}) },
          t,
          common,
          "login",
        ),
      );
      focusIssueField(field);
      return;
    }
    setPending(true);
    const result = await apiRequest<{ user: Me; next: string }>("/api/v1/session", {
      method: "POST",
      body: parsed.data,
    });
    setPending(false);
    if (!result.ok) {
      const nextIssue = formIssue(result, t, common, "login");
      setIssue(nextIssue);
      focusIssueField(nextIssue.field);
      return;
    }
    auth.setUser(result.data.user);
    router.replace(safeNextPath(result.data.next) as "/");
  }

  function handleSubmit() {
    void submit();
  }

  function dismissToast() {
    setToast(null);
  }

  function fieldError(name: string) {
    return issue?.field === name ? issue.text : undefined;
  }

  function rememberEmailForForgot() {
    rememberAuthEmail("/forgot", email);
  }

  function rememberEmailForRegister() {
    rememberAuthEmail("/register", email);
  }

  const nextParams = next !== "/" ? { next } : {};
  const registerHref = { pathname: "/register" as const, params: nextParams };
  const forgotHref = { pathname: "/forgot" as const, params: nextParams };

  return (
    <>
      <Stack.Screen options={{ title: t("login.pageTitle", { brand }) }} />
      <AnonymousScreen title={t("login.title")}>
        {issue && !issue.field ? (
          <Text role="alert" aria-live="polite">
            {issue.text}
          </Text>
        ) : null}
        <TextField
          inputRef={emailRef}
          label={t("form.email")}
          value={email}
          onChangeText={change("email", setEmail)}
          error={fieldError("email")}
          input={{
            autoCapitalize: "none",
            autoComplete: "username",
            autoCorrect: false,
            inputMode: "email",
            keyboardType: "email-address",
            textContentType: "username",
          }}
        />
        <PasswordField
          inputRef={passwordRef}
          label={t("form.password")}
          value={password}
          onChangeText={change("password", setPassword)}
          error={fieldError("password")}
          showLabel={t("form.showPassword")}
          input={{
            autoCapitalize: "none",
            autoComplete: "current-password",
            autoCorrect: false,
            textContentType: "password",
            onSubmitEditing: handleSubmit,
          }}
        />
        <PrimaryButton label={t("form.submitLogin")} onPress={handleSubmit} disabled={pending} />
        <NavLink href={forgotHref} onPress={rememberEmailForForgot}>
          {t("login.forgot")}
        </NavLink>
        <NavLink href={registerHref} onPress={rememberEmailForRegister}>
          {t("login.toRegister")}
        </NavLink>
      </AnonymousScreen>
      {toast ? <ToastHost message={toast} onDismiss={dismissToast} /> : null}
    </>
  );
}

LoginScreen.displayName = "LoginScreen";
