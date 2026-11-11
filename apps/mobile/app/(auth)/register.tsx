import { focusField, Text } from "@gift-list/ui";
import {
  NICK_PATTERN,
  PASSWORD_MIN,
  registerBodySchema,
  safeNextPath,
  type Me,
} from "@gift-list/contracts";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import type { TextInputInstance } from "react-native";
import { useTranslations } from "use-intl";
import { apiRequest } from "@/api/client";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { rememberAuthEmail } from "@/session/auth-navigation";
import {
  firstZodField,
  formIssue,
  issueFromError,
  passwordFieldIssue,
  type FormIssue,
} from "@/session/form-issue";
import { returnPath } from "@/session/return-path";
import { useCarriedAuthEmail } from "@/session/use-carried-auth-email";
import { AnonymousScreen } from "@/ui/anonymous-screen";
import { NavLink } from "@/ui/nav-link";
import { PrimaryButton } from "@/ui/primary-button";
import { PasswordField, TextField } from "@/ui/text-field";

export default function RegisterScreen() {
  const t = useTranslations("app");
  const common = useTranslations("common");
  const brand = getBrandName();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = returnPath(params.next);
  const auth = useAuth();
  const [email, setEmail] = useCarriedAuthEmail("/register");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [nick, setNick] = useState("");
  const [issue, setIssue] = useState<FormIssue | null>(null);
  const [pending, setPending] = useState(false);
  // UI5: submit moves focus to the invalid field and scrolls it into view.
  const emailRef = useRef<TextInputInstance | null>(null);
  const passwordRef = useRef<TextInputInstance | null>(null);
  const nameRef = useRef<TextInputInstance | null>(null);
  const nickRef = useRef<TextInputInstance | null>(null);

  function change(field: string, setValue: (value: string) => void) {
    return function handleFieldChange(value: string) {
      setValue(value);
      setIssue((current) => (current?.field === field ? null : current));
    };
  }

  /** UI5: the field of the current issue takes focus. */
  function focusIssueField(field: string | undefined) {
    switch (field) {
      case "email":
        focusField(emailRef.current);
        break;
      case "password":
        focusField(passwordRef.current);
        break;
      case "displayName":
        focusField(nameRef.current);
        break;
      case "nick":
        focusField(nickRef.current);
        break;
    }
  }

  useEffect(function redirectWhenReady() {
    if (auth.state.status === "ready") router.replace(next as "/");
  }, [auth.state.status, next]);

  // AD-13: the same 3–24 `[a-z0-9_]` rule as the server, taken from the contract.
  const nickPreview = NICK_PATTERN.test(nick.trim().toLowerCase())
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
      if (field === "password") {
        setIssue(passwordFieldIssue(password, t, common));
        focusIssueField(field);
        return;
      }
      setIssue(
        issueFromError(
          { ok: false, code: "VALIDATION", message: "Invalid input", ...(field ? { field } : {}) },
          t,
          common,
          "register",
        ),
      );
      focusIssueField(field);
      return;
    }
    setPending(true);
    const result = await apiRequest<{ user: Me; next: string }>("/api/v1/register", {
      method: "POST",
      body: parsed.data,
    });
    setPending(false);
    if (!result.ok) {
      const issue = formIssue(result, t, common, "register");
      const nextIssue =
        issue.field === "password" ? passwordFieldIssue(password, t, common) : issue;
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

  function fieldError(name: string) {
    return issue?.field === name ? issue.text : undefined;
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
      <Stack.Screen options={{ title: t("register.pageTitle", { brand }) }} />
      <AnonymousScreen title={t("register.title")}>
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
        {issue?.reason === "EMAIL_TAKEN" ? (
          <NavLink href={loginHref} onPress={rememberEmail}>
            {t("register.toLogin")}
          </NavLink>
        ) : null}
        <PasswordField
          inputRef={passwordRef}
          label={t("form.password")}
          value={password}
          onChangeText={change("password", setPassword)}
          error={fieldError("password")}
          // NOTE FOR UX: «Ошибки форм» не задаёт длину пароля. Подсказка и ошибка — form.passwordRules / form.passwordTooLong.
          hint={password.length < PASSWORD_MIN ? t("form.passwordRules") : undefined}
          showLabel={t("form.showPassword")}
          input={{
            autoCapitalize: "none",
            autoComplete: "new-password",
            autoCorrect: false,
            textContentType: "newPassword",
          }}
        />
        <TextField
          inputRef={nameRef}
          label={t("form.name")}
          value={displayName}
          onChangeText={change("displayName", setDisplayName)}
          error={fieldError("displayName")}
          input={{ autoComplete: "name", textContentType: "name" }}
        />
        <TextField
          inputRef={nickRef}
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
            onSubmitEditing: handleSubmit,
          }}
        />
        <PrimaryButton
          label={t("form.submitRegister")}
          onPress={handleSubmit}
          disabled={pending}
        />
        <NavLink href={loginHref} onPress={rememberEmail}>
          {t("register.toLogin")}
        </NavLink>
      </AnonymousScreen>
    </>
  );
}

RegisterScreen.displayName = "RegisterScreen";
