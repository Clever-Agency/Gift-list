import { registerBodySchema, safeNextPath, type Me } from "@gift-list/contracts";
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
import { PrimaryButton } from "@/ui/primary-button";
import { PasswordField, TextField } from "@/ui/text-field";

export default function RegisterScreen() {
  const t = useTranslations("app");
  const common = useTranslations("common");
  const brand = getBrandName();
  const params = useLocalSearchParams<{ next?: string; email?: string }>();
  const next = returnPath(params.next);
  const auth = useAuth();
  const [email, setEmail] = useState(paramValue(params.email) ?? "");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [nick, setNick] = useState("");
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

  const nickPreview = /^[a-z0-9_]{3,24}$/.test(nick.trim().toLowerCase())
    ? t("form.nickPreview", { nick: nick.trim().toLowerCase() })
    : undefined;

  async function submit() {
    setIssue(null);
    const parsed = registerBodySchema.safeParse({
      email,
      password,
      displayName,
      nick,
      next,
    });
    if (!parsed.success) {
      const field = firstZodField(parsed.error.issues[0]?.path);
      setIssue(
        issueFromError(
          { ok: false, code: "VALIDATION", message: "Invalid input", ...(field ? { field } : {}) },
          t,
          common,
          "register",
        ),
      );
      return;
    }
    setPending(true);
    const result = await apiRequest<{ user: Me; next: string }>("/api/v1/register", {
      method: "POST",
      body: parsed.data,
    });
    setPending(false);
    if (!result.ok) {
      setIssue(formIssue(result, t, common, "register"));
      return;
    }
    auth.setUser(result.data.user);
    router.replace(safeNextPath(result.data.next) as "/");
  }

  const fieldError = (name: string) => (issue?.field === name ? issue.text : undefined);
  const loginHref = {
    pathname: "/login" as const,
    params: { ...(next !== "/" ? { next } : {}), ...(email ? { email } : {}) },
  };

  return (
    <>
      <Stack.Screen options={{ title: t("register.pageTitle", { brand }) }} />
      <AnonymousScreen title={t("register.title")}>
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
        {issue?.reason === "EMAIL_TAKEN" ? (
          <Link href={loginHref} style={navLinkStyle} accessibilityRole="link">
            {t("register.toLogin")}
          </Link>
        ) : null}
        <PasswordField
          label={t("form.password")}
          value={password}
          onChangeText={change("password", setPassword)}
          error={fieldError("password")}
          showLabel={t("form.showPassword")}
          input={{
            autoCapitalize: "none",
            autoComplete: "new-password",
            autoCorrect: false,
            textContentType: "newPassword",
          }}
        />
        <TextField
          label={t("form.name")}
          value={displayName}
          onChangeText={change("displayName", setDisplayName)}
          error={fieldError("displayName")}
          input={{ autoComplete: "name", textContentType: "name" }}
        />
        <TextField
          label={t("form.nick")}
          value={nick}
          onChangeText={change("nick", setNick)}
          error={fieldError("nick")}
          hint={nickPreview}
          input={{
            autoCapitalize: "none",
            autoComplete: "nickname",
            autoCorrect: false,
            textContentType: "nickname",
            onSubmitEditing: () => void submit(),
          }}
        />
        <PrimaryButton
          label={t("form.submitRegister")}
          onPress={() => void submit()}
          disabled={pending}
        />
        <Link href={loginHref} style={navLinkStyle} accessibilityRole="link">
          {t("register.toLogin")}
        </Link>
      </AnonymousScreen>
    </>
  );
}
