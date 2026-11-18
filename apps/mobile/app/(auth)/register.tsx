import { focusField, Text } from "@gift-list/ui";
import {
  NICK_MAX,
  PASSWORD_MIN,
  nickIssue,
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
import { inviteTokenFromNext } from "@/invite/invite-route";
import { useAuth } from "@/session/auth-context";
import { rememberAuthEmail } from "@/session/auth-navigation";
import {
  confirmPasswordText,
  firstZodField,
  formIssue,
  issueFromError,
  nickErrorText,
  nickFieldText,
  nickIssueText,
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
  const [confirm, setConfirm] = useState("");
  const [confirmSettled, setConfirmSettled] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [nick, setNick] = useState("");
  const [nickSettled, setNickSettled] = useState(false);
  const [issue, setIssue] = useState<FormIssue | null>(null);
  const [pending, setPending] = useState(false);
  // UI5: submit moves focus to the invalid field and scrolls it into view.
  const emailRef = useRef<TextInputInstance | null>(null);
  const passwordRef = useRef<TextInputInstance | null>(null);
  const confirmRef = useRef<TextInputInstance | null>(null);
  const nameRef = useRef<TextInputInstance | null>(null);
  const nickRef = useRef<TextInputInstance | null>(null);

  function change(field: string, setValue: (value: string) => void) {
    return function handleFieldChange(value: string) {
      setValue(value);
      setIssue((current) => (current?.field === field ? null : current));
    };
  }

  function settleNick() {
    setNickSettled(true);
  }

  function settleConfirm() {
    setConfirmSettled(true);
  }

  function focusConfirm() {
    focusField(confirmRef.current);
  }

  function focusName() {
    focusField(nameRef.current);
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
      case "confirm":
        focusConfirm();
        break;
      case "displayName":
        focusName();
        break;
      case "nick":
        focusField(nickRef.current);
        break;
    }
  }

  useEffect(function redirectWhenReady() {
    if (auth.state.status === "ready") router.replace(next as "/");
  }, [auth.state.status, next]);

  // AD-13: the same rule as the server, taken from the contract. The preview is
  // the normalized nickname and loses the line to the error of an invalid one.
  const liveNick = nickIssue(nick);
  const nickPreview = liveNick
    ? undefined
    : t("form.nickPreview", { nick: nick.toLowerCase() });
  const nickError = fieldError("nick") ?? nickFieldText(liveNick, nickSettled, t);
  const confirmError = confirmPasswordText(password, confirm, confirmSettled, t);

  async function submit() {
    setIssue(null);
    // AD-21: only a registration that came through `/invite/{token}` sends the
    // token; `/l/:token` (rewritten to `/wishlist/:token`) never creates a
    // friendship (AD-15-11), and no other return path carries one either.
    const inviteToken = inviteTokenFromNext(next);
    const parsed = registerBodySchema.safeParse({
      email,
      password,
      displayName,
      nick,
      next,
      ...(inviteToken === undefined ? {} : { inviteToken }),
    });
    const field = parsed.success ? undefined : firstZodField(parsed.error.issues[0]?.path);
    if (field === "password") {
      setIssue(passwordFieldIssue(password, t, common));
      focusIssueField(field);
      return;
    }
    if (field === "email") {
      setIssue(invalidFieldIssue(field));
      focusIssueField(field);
      return;
    }
    // The confirmation is the second password: the schema knows nothing of it, so
    // it is checked here — after email and password, before the fields below it.
    if (password !== confirm) {
      setConfirmSettled(true);
      focusIssueField("confirm");
      return;
    }
    if (!parsed.success) {
      if (field === "nick") {
        // Length is shown after submit even if the field was never blurred.
        setNickSettled(true);
        setIssue({
          field,
          text: nickErrorText(nick, t, common("errors.code.VALIDATION")),
        });
        focusIssueField(field);
        return;
      }
      setIssue(invalidFieldIssue(field));
      focusIssueField(field);
      return;
    }
    // The schema trims a padded nick, but the field marks the spaces as an error:
    // submitting one would accept a value the screen just called invalid.
    const nickProblem = nickIssue(nick);
    if (nickProblem) {
      setNickSettled(true);
      setIssue({ field: "nick", text: nickIssueText(nickProblem, t) });
      focusIssueField("nick");
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
      let nextIssue = issue.field === "password" ? passwordFieldIssue(password, t, common) : issue;
      if (nextIssue.field === "nick" && nextIssue.reason !== "NICK_TAKEN") {
        // A server-side nick validation names the same reason the client would.
        setNickSettled(true);
        nextIssue = {
          ...nextIssue,
          text: nickErrorText(nick, t, common("errors.code.VALIDATION")),
        };
      }
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

  /** A client-side schema failure of a field without a sentence of its own. */
  function invalidFieldIssue(field: string | undefined): FormIssue {
    return issueFromError(
      { ok: false, code: "VALIDATION", message: "Invalid input", ...(field ? { field } : {}) },
      t,
      common,
      "register",
    );
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

  function reserveTitleFromNext(path: string): string | null {
    const query = path.split("?")[1];
    if (!query) return null;
    const title = new URLSearchParams(query).get("title");
    return title && title.trim() !== "" ? title : null;
  }

  const reserveTitle = next !== "/" ? reserveTitleFromNext(next) : null;

  return (
    <>
      <Stack.Screen options={{ title: t("register.pageTitle", { brand }) }} />
      <AnonymousScreen title={t("register.title")}>
        {reserveTitle ? (
          <Text kind="body">{t("register.forReserve", { title: reserveTitle })}</Text>
        ) : null}
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
            returnKeyType: "next",
            onSubmitEditing: focusConfirm,
          }}
        />
        <PasswordField
          inputRef={confirmRef}
          label={t("form.confirmPassword")}
          value={confirm}
          onChangeText={change("confirm", setConfirm)}
          error={confirmError}
          showLabel={t("form.showPassword")}
          input={{
            autoCapitalize: "none",
            autoComplete: "new-password",
            autoCorrect: false,
            textContentType: "newPassword",
            returnKeyType: "next",
            onBlur: settleConfirm,
            onSubmitEditing: focusName,
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
          error={nickError}
          hint={nickPreview}
          input={{
            autoCapitalize: "none",
            autoComplete: "nickname",
            autoCorrect: false,
            maxLength: NICK_MAX,
            textContentType: "nickname",
            onBlur: settleNick,
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
