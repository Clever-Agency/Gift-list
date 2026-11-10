import { NICK_PATTERN, type Me } from "@gift-list/contracts";
import { Column, focusField, Heading, PageContainer, PageScroll, Pressable, SafeArea, Screen, spacing, Text, YStack } from "@gift-list/ui";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useWindowDimensions, type TextInputInstance } from "react-native";
import { useTranslations } from "use-intl";
import { updateNick } from "@/api/me";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { formIssue } from "@/session/form-issue";
import { pageGutter } from "@/ui/card-grid";
import { PrimaryButton } from "@/ui/primary-button";
import { SessionErrorScreen } from "@/ui/session-error-screen";
import { SessionLoadingScreen } from "@/ui/session-loading-screen";
import { SiteFooter } from "@/ui/site-footer";
import { TextField } from "@/ui/text-field";
import { ToastHost } from "@/ui/toast";

/** One toast at a time; the saved notice is neutral, a failed save is destructive. */
type ToastState = { message: string; tone: "info" | "error" };

/**
 * «Настройки» (Story 3.1): the nick block only. The full set of settings arrives
 * with Story 6.3 and the navigation with Story 6.2.
 *
 * The screen guards the session like the other `(app)` screens: an anonymous
 * visitor leaves for login with a return to these settings. The form itself is a
 * child so its field starts from the loaded user; it mounts only once `/me` has
 * answered.
 */
export default function SettingsScreen() {
  const auth = useAuth();
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(function redirectAnonymous() {
    if (auth.state.status === "anonymous") {
      // The login screen owns the «Сессия закончилась» toast: it outlives this screen.
      router.replace({
        pathname: "/login",
        params: sessionExpired
          ? { next: "/settings", reason: "session_expired" }
          : { next: "/settings" },
      });
    }
  }, [auth.state.status, sessionExpired]);

  function handleSessionExpired(expired: boolean) {
    setSessionExpired(expired);
  }

  if (auth.state.status === "error") {
    return <SessionErrorScreen size="form" onRetry={auth.retry} />;
  }

  if (auth.state.status !== "ready") return <SessionLoadingScreen size="form" />;

  return <SettingsForm user={auth.state.user} onSessionExpired={handleSessionExpired} />;
}

SettingsScreen.displayName = "SettingsScreen";

/**
 * AD-13: the client checks the same 3–24 `[a-z0-9_]` rule as the server, so an
 * invalid nick never reaches the API. A nick equal to the current one is not a
 * change either: the screen says so inline and sends nothing.
 */
function SettingsForm({
  user,
  onSessionExpired,
}: {
  user: Me;
  onSessionExpired: (expired: boolean) => void;
}) {
  const t = useTranslations("app");
  const common = useTranslations("common");
  const brand = getBrandName();
  const auth = useAuth();
  const { width } = useWindowDimensions();
  const gutter = pageGutter(width);
  const nickInput = useRef<TextInputInstance | null>(null);

  const [nick, setNick] = useState(user.nick);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [unchanged, setUnchanged] = useState(false);
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  // The disabled button follows a state update, which flushes after the handler:
  // a second tap in the same frame must not send a second PUT.
  const inFlight = useRef(false);

  const normalized = nick.trim().toLowerCase();
  const valid = NICK_PATTERN.test(normalized);
  const hint = unchanged
    ? t("settings.nickUnchanged")
    : valid
      ? t("form.nickPreview", { nick: normalized })
      : t("settings.nickHint");

  function focusNick() {
    // UI5: the invalid nick is focused and scrolled to the middle of the screen.
    focusField(nickInput.current);
  }

  function changeNick(value: string) {
    setNick(value);
    setFieldError(null);
    setUnchanged(false);
  }

  function goBack() {
    // A direct link has no history behind it: fall back to the wishlist.
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  function save() {
    if (inFlight.current) return;
    if (!valid) {
      // The rules stay in the catalog and sit under the field, like on register.
      setFieldError(t("settings.nickHint"));
      setUnchanged(false);
      focusNick();
      return;
    }
    if (normalized === user.nick.trim().toLowerCase()) {
      setFieldError(null);
      setUnchanged(true);
      focusNick();
      return;
    }
    void submit();
  }

  async function submit() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setFieldError(null);
    setUnchanged(false);

    const result = await updateNick(nick);

    inFlight.current = false;
    setPending(false);

    if (result.ok) {
      // The saved nick is what the server normalized it to, not what was typed.
      setNick(result.data.nick);
      auth.setUser(result.data);
      setToast({ message: t("settings.nickSaved"), tone: "info" });
      return;
    }
    if ("network" in result) {
      setToast({ message: t("form.network"), tone: "error" });
      return;
    }
    if ("invalid" in result) {
      setToast({ message: common("errors.generic"), tone: "error" });
      return;
    }
    if (result.code === "UNAUTHENTICATED") {
      // Same as the other `(app)` screens: clear the dead session and let the guard
      // open login with the reason and a return to these settings.
      onSessionExpired(true);
      const signedOut = await auth.signOut();
      // A failed sign-out leaves the screen mounted: report it like any other
      // network failure instead of silently pretending the session is gone.
      if (!signedOut.ok) {
        onSessionExpired(false);
        setToast({ message: t("form.network"), tone: "error" });
      }
      return;
    }
    const issue = formIssue(result, t, common, "register");
    if (issue.reason === "NICK_TAKEN") {
      setFieldError(issue.text);
      focusNick();
      return;
    }
    if (issue.field === "nick") {
      setFieldError(t("settings.nickHint"));
      focusNick();
      return;
    }
    if (issue.field) {
      setFieldError(issue.text);
      focusNick();
      return;
    }
    setToast({ message: issue.text, tone: "error" });
  }

  function dismissToast() {
    setToast(null);
  }

  return (
    <Screen>
      <SafeArea>
        <Stack.Screen options={{ title: t("settings.pageTitle", { brand }) }} />
        {/* A form reads best narrow: `DESIGN.md` → Layout → max-form. */}
        <PageScroll testID="settings-page" keyboardShouldPersistTaps="handled">
          <PageContainer>
            <Column
              size="form"
              flexGrow={1}
              paddingHorizontal={gutter}
              paddingTop="$page-gutter"
              gap="$2"
            >
              <Pressable
                role="button"
                aria-label={t("settings.back")}
                onPress={goBack}
                alignSelf="flex-start"
                justifyContent="center"
                minHeight="$touch-target"
                minWidth="$touch-target"
              >
                <Text kind="button" tone="primary">
                  {t("settings.back")}
                </Text>
              </Pressable>
              <Text kind="display-sm" tone="primary" textAlign="center">
                {common("brandName", { brand })}
              </Text>
              <Heading level={1}>{t("settings.title")}</Heading>
              <YStack
                flexGrow={1}
                paddingTop={spacing["grid-gap"] / 2}
                paddingBottom={spacing["section-gap"]}
              >
                <YStack gap="$grid-gap">
                  <TextField
                    label={t("form.nick")}
                    value={nick}
                    onChangeText={changeNick}
                    error={fieldError ?? undefined}
                    hint={hint}
                    inputRef={nickInput}
                    input={{
                      autoCapitalize: "none",
                      autoComplete: "nickname",
                      autoCorrect: false,
                      editable: !pending,
                      textContentType: "nickname",
                      onSubmitEditing: save,
                    }}
                  />
                  <PrimaryButton label={t("settings.save")} onPress={save} disabled={pending} />
                </YStack>
              </YStack>
              <SiteFooter />
            </Column>
          </PageContainer>
        </PageScroll>
        {toast ? (
          <ToastHost message={toast.message} tone={toast.tone} onDismiss={dismissToast} />
        ) : null}
      </SafeArea>
    </Screen>
  );
}

SettingsForm.displayName = "SettingsForm";
