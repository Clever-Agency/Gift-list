import { loginBodySchema, safeNextPath } from "@gift-list/contracts";
import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { useTranslations } from "use-intl";
import { apiRequest } from "@/api/client";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { firstZodField, formIssue, issueFromError, type FormIssue } from "@/session/form-issue";
import { paramValue, returnPath } from "@/session/return-path";
import { AnonymousScreen } from "@/ui/anonymous-screen";
import { navLinkStyle } from "@/ui/nav-link";
import { PasswordField, TextField } from "@/ui/text-field";
import { PrimaryButton } from "@/ui/primary-button";
import type { Me } from "@gift-list/contracts";

export default function LoginScreen() {
  const t = useTranslations("app");
  const common = useTranslations("common");
  const brand = getBrandName();
  const params = useLocalSearchParams<{ next?: string; email?: string }>();
  const next = returnPath(params.next);
  const auth = useAuth();
  const [email, setEmail] = useState(paramValue(params.email) ?? "");
  const [password, setPassword] = useState("");
  const [issue, setIssue] = useState<FormIssue | null>(null);
  const [pending, setPending] = useState(false);

  function change(field: string, setValue: (value: string) => void) {
    return (value: string) => {
      setValue(value);
      setIssue((current) => (current?.field === field ? null : current));
    };
  }

  useEffect(() => {
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
      return;
    }
    setPending(true);
    const result = await apiRequest<{ user: Me; next: string }>("/api/v1/session", {
      method: "POST",
      body: parsed.data,
    });
    setPending(false);
    if (!result.ok) {
      setIssue(formIssue(result, t, common, "login"));
      return;
    }
    auth.setUser(result.data.user);
    router.replace(safeNextPath(result.data.next) as "/");
  }

  const fieldError = (name: string) => (issue?.field === name ? issue.text : undefined);
  const carry = { pathname: "/register" as const, params: { ...(next !== "/" ? { next } : {}), ...(email ? { email } : {}) } };

  return (
    <>
      <Stack.Screen options={{ title: t("login.pageTitle", { brand }) }} />
      <AnonymousScreen title={t("login.title")}>
        {issue && !issue.field ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite">
            {issue.text}
          </Text>
        ) : null}
        <TextField
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
            onSubmitEditing: () => void submit(),
          }}
        />
        <PrimaryButton label={t("form.submitLogin")} onPress={() => void submit()} disabled={pending} />
        <Link
          href={{ pathname: "/forgot", params: carry.params }}
          style={navLinkStyle}
          accessibilityRole="link"
        >
          {t("login.forgot")}
        </Link>
        <Link href={carry} style={navLinkStyle} accessibilityRole="link">
          {t("login.toRegister")}
        </Link>
      </AnonymousScreen>
    </>
  );
}
