import { DISPLAY_NAME_MAX, NICK_MAX, nickIssue, type Me } from "@gift-list/contracts";
import {
  Avatar,
  Button,
  Column,
  focusField,
  Heading,
  PageContainer,
  PageScroll,
  SafeArea,
  Screen,
  Text,
  XStack,
  YStack,
} from "@gift-list/ui";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import type { TextInputInstance } from "react-native";
import { useTranslations } from "use-intl";
import { updateName, updateNick } from "@/api/me";
import { getBrandName } from "@/config/env";
import { profileRoute } from "@/profile/profile-route";
import { useAuth } from "@/session/auth-context";
import { formIssue, nickErrorText, nickFieldText } from "@/session/form-issue";
import { NotificationBell } from "@/ui/notification-bell";
import { ProfileMenu } from "@/ui/profile-menu";
import { SessionErrorScreen } from "@/ui/session-error-screen";
import { SessionLoadingScreen } from "@/ui/session-loading-screen";
import { SiteFooter } from "@/ui/site-footer";
import { TextField } from "@/ui/text-field";
import { ToastHost } from "@/ui/toast";

/** One toast at a time; a saved notice is neutral, a failed save is destructive. */
type ToastState = { message: string; tone: "info" | "error" };

/**
 * «Профиль» (CLE-129, D-59, AD-29): the tab is a data screen now, not a menu.
 * The avatar with initials, the name (editable), the nick (editable, moved here
 * from «Настройки») and the email (read-only) sit above the menu of the own
 * public profile, the settings, the support link and «Выйти».
 *
 * Birthday, gender, country, «Обо мне» and the friends switch arrive with T8;
 * the email change with T9. The screen guards the session like «Настройки»
 * (`next=/profile`), so a direct anonymous visit lands on the login screen and
 * comes back here.
 */
export default function MyProfileScreen() {
  const auth = useAuth();
  const t = useTranslations("app");
  const nav = useTranslations("app.nav");
  const profile = useTranslations("app.profile");
  const common = useTranslations("common");
  const brand = getBrandName();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  // One sign-out request at a time: the row is disabled while it is in flight.
  const [signingOut, setSigningOut] = useState(false);
  const inFlight = useRef(false);

  useEffect(
    function redirectAnonymous() {
      if (auth.state.status === "anonymous") {
        // The login screen owns the «Сессия закончилась» toast: it outlives this
        // screen. A dead session says why; a plain sign-out does not.
        router.replace({
          pathname: "/login",
          params: sessionExpired
            ? { next: "/profile", reason: "session_expired" }
            : { next: "/profile" },
        });
      }
    },
    [auth.state.status, sessionExpired],
  );

  function showToast(message: string, tone: ToastState["tone"]) {
    setToast({ message, tone });
  }

  function dismissToast() {
    setToast(null);
  }

  /**
   * The shared session-expired path of the profile forms: clear the dead session
   * and let the guard above open login with the reason and a return here. A
   * failed sign-out leaves the screen mounted, so it is reported like any other
   * network failure.
   */
  async function expireSession() {
    setSessionExpired(true);
    const signedOut = await auth.signOut();
    if (!signedOut.ok) {
      setSessionExpired(false);
      showToast(t("form.network"), "error");
    }
  }

  function openSettings() {
    router.push("/settings");
  }

  function openOwnProfile() {
    if (auth.state.status !== "ready") return;
    const route = profileRoute(auth.state.user.nick);
    if (route === null) return;
    router.push({ pathname: "/u/[nick]", params: { nick: route.nick } });
  }

  /**
   * «Выйти»: the session is cleared by `AuthContext`, then the guard above opens
   * the login screen with `next=/profile`. A failed request keeps the person here
   * and reports the one network sentence (`EXPERIENCE.md` → «Нет сети»).
   */
  async function signOut() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSigningOut(true);
    const result = await auth.signOut();
    inFlight.current = false;
    setSigningOut(false);
    if (!result.ok) showToast(t("form.network"), "error");
  }

  function handleSignOut() {
    void signOut();
  }

  if (auth.state.status === "error") {
    return <SessionErrorScreen onRetry={auth.retry} />;
  }

  if (auth.state.status !== "ready") {
    return <SessionLoadingScreen />;
  }

  return (
    <Screen>
      {/* A tab root: the bottom bar holds the home indicator (spec 6.2). */}
      <SafeArea>
        <Stack.Screen options={{ title: profile("pageTitle", { brand }) }} />
        <PageScroll testID="profile-page" keyboardShouldPersistTaps="handled">
          <PageContainer>
            <Column
              size="form"
              flexGrow={1}
              paddingHorizontal="$page-gutter medium:$page-gutter-lg"
              paddingTop="$page-gutter"
              gap="$2"
            >
              <Text kind="display-sm" tone="primary" textAlign="center">
                {common("brandName", { brand })}
              </Text>
              <XStack justifyContent="space-between" alignItems="center">
                <Heading level={1}>{nav("profile")}</Heading>
                <NotificationBell />
              </XStack>
              <YStack
                flexGrow={1}
                paddingTop="$2"
                paddingBottom="$section-gap"
                gap="$section-gap"
              >
                <ProfileDetails
                  user={auth.state.user}
                  onToast={showToast}
                  onExpired={expireSession}
                />
                <ProfileMenu
                  onOpenProfile={openOwnProfile}
                  onOpenSettings={openSettings}
                  onSignOut={handleSignOut}
                  signingOut={signingOut}
                />
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

MyProfileScreen.displayName = "MyProfileScreen";

/**
 * The data half of «Профиль»: the avatar and the read-only identity first, then
 * the name and the nick, each with its own save. The two forms stay separate on
 * purpose: a failed nick (taken, invalid) must not undo a name that the server
 * has already stored, and the screen keeps the one action it can retry.
 *
 * The name uses the registration rule (written as given, 1–50 code points, the
 * cap from `DISPLAY_NAME_MAX`). The nick keeps the 3–24 `[a-z0-9_]` rule of
 * AD-13, moved from «Настройки» with its inline reasons, preview and focus
 * behaviour.
 */
function ProfileDetails({
  user,
  onToast,
  onExpired,
}: {
  user: Me;
  onToast: (message: string, tone: ToastState["tone"]) => void;
  onExpired: () => Promise<void>;
}) {
  const t = useTranslations("app");
  const profile = useTranslations("app.profile");
  const common = useTranslations("common");
  const auth = useAuth();
  const nameInput = useRef<TextInputInstance | null>(null);
  const nickInput = useRef<TextInputInstance | null>(null);

  // Name (CLE-129): the trimmed value is what the server stores.
  const [name, setName] = useState(user.name);
  const [nameSettled, setNameSettled] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameUnchanged, setNameUnchanged] = useState(false);
  const [namePending, setNamePending] = useState(false);
  const nameInFlight = useRef(false);

  // Nick (Story 3.1, moved here from «Настройки» in CLE-129).
  const [nick, setNick] = useState(user.nick);
  const [nickSettled, setNickSettled] = useState(false);
  const [nickError, setNickError] = useState<string | null>(null);
  const [nickUnchanged, setNickUnchanged] = useState(false);
  const [nickPending, setNickPending] = useState(false);
  const nickInFlight = useRef(false);

  const trimmedName = name.trim();
  const liveNick = nickIssue(nick);
  const nickValid = liveNick === null;

  const nameIssue = trimmedName.length === 0
    ? profile("nameRequired")
    : Array.from(trimmedName).length > DISPLAY_NAME_MAX
      ? profile("nameTooLong", { max: DISPLAY_NAME_MAX })
      : undefined;
  const nameHint = nameUnchanged ? profile("nameUnchanged") : undefined;
  const nameMessage = nameError ?? (nameSettled ? nameIssue : undefined);

  const nickHint = nickUnchanged
    ? profile("nickUnchanged")
    : nickValid
      ? t("form.nickPreview", { nick: nick.toLowerCase() })
      : undefined;
  const nickMessage = nickError ?? nickFieldText(liveNick, nickSettled, t);

  function focusName() {
    focusField(nameInput.current);
  }

  function changeName(value: string) {
    setName(value);
    setNameError(null);
    setNameUnchanged(false);
  }

  function settleName() {
    setNameSettled(true);
  }

  function saveName() {
    if (nameInFlight.current) return;
    if (nameIssue !== undefined) {
      // The reason sits under the field, like the nick one; length waits for this press.
      setNameSettled(true);
      setNameError(null);
      setNameUnchanged(false);
      focusName();
      return;
    }
    if (trimmedName === user.name.trim()) {
      setNameError(null);
      setNameUnchanged(true);
      focusName();
      return;
    }
    void submitName();
  }

  async function submitName() {
    if (nameInFlight.current) return;
    nameInFlight.current = true;
    setNamePending(true);
    setNameError(null);
    setNameUnchanged(false);

    const result = await updateName(trimmedName);

    nameInFlight.current = false;
    setNamePending(false);

    if (result.ok) {
      setName(result.data.name);
      auth.setUser(result.data);
      onToast(profile("nameSaved"), "info");
      return;
    }
    if ("network" in result) {
      onToast(t("form.network"), "error");
      return;
    }
    if ("invalid" in result) {
      onToast(common("errors.generic"), "error");
      return;
    }
    if (result.code === "UNAUTHENTICATED") {
      await onExpired();
      return;
    }
    const issue = formIssue(result, t, common, "register");
    if (issue.field === "name") {
      setNameSettled(true);
      setNameError(issue.text);
      focusName();
      return;
    }
    if (issue.field) {
      setNameError(issue.text);
      focusName();
      return;
    }
    onToast(issue.text, "error");
  }

  function focusNick() {
    // UI5: the invalid nick is focused and scrolled to the middle of the screen.
    focusField(nickInput.current);
  }

  function changeNick(value: string) {
    setNick(value);
    setNickError(null);
    setNickUnchanged(false);
  }

  function settleNick() {
    setNickSettled(true);
  }

  function saveNick() {
    if (nickInFlight.current) return;
    if (!nickValid) {
      // The reason sits under the field, like on register; length waits for this press.
      setNickSettled(true);
      setNickError(null);
      setNickUnchanged(false);
      focusNick();
      return;
    }
    if (nick.trim().toLowerCase() === user.nick.trim().toLowerCase()) {
      setNickError(null);
      setNickUnchanged(true);
      focusNick();
      return;
    }
    void submitNick();
  }

  async function submitNick() {
    if (nickInFlight.current) return;
    nickInFlight.current = true;
    setNickPending(true);
    setNickError(null);
    setNickUnchanged(false);

    const result = await updateNick(nick);

    nickInFlight.current = false;
    setNickPending(false);

    if (result.ok) {
      // The saved nick is what the server normalized it to, not what was typed.
      setNick(result.data.nick);
      auth.setUser(result.data);
      onToast(profile("nickSaved"), "info");
      return;
    }
    if ("network" in result) {
      onToast(t("form.network"), "error");
      return;
    }
    if ("invalid" in result) {
      onToast(common("errors.generic"), "error");
      return;
    }
    if (result.code === "UNAUTHENTICATED") {
      await onExpired();
      return;
    }
    const issue = formIssue(result, t, common, "register");
    if (issue.reason === "NICK_TAKEN") {
      setNickError(issue.text);
      focusNick();
      return;
    }
    if (issue.field === "nick") {
      // A server-side nick validation names the reason of the value, not the rules.
      setNickSettled(true);
      setNickError(nickErrorText(nick, t, common("errors.code.VALIDATION")));
      focusNick();
      return;
    }
    if (issue.field) {
      setNickError(issue.text);
      focusNick();
      return;
    }
    onToast(issue.text, "error");
  }

  return (
    <YStack gap="$section-gap">
      {/* The name is written right below the avatar, so the circle is decorative
          for the screen reader and the person is named once. */}
      <YStack alignItems="center" gap="$2">
        <Avatar name={user.name} size="lg" decorative testID="profile-avatar" />
        <Text kind="heading" textAlign="center" testID="profile-name">
          {user.name}
        </Text>
        <Text kind="caption" tone="muted">
          {t("form.nickPreview", { nick: user.nick })}
        </Text>
        <YStack alignItems="center">
          <Text kind="caption" tone="muted">
            {t("form.email")}
          </Text>
          <Text testID="profile-email">{user.email}</Text>
        </YStack>
      </YStack>
      <YStack gap="$grid-gap">
        <TextField
          label={t("form.name")}
          value={name}
          onChangeText={changeName}
          error={nameMessage}
          hint={nameHint}
          inputRef={nameInput}
          input={{
            autoComplete: "name",
            textContentType: "name",
            editable: !namePending,
            maxLength: DISPLAY_NAME_MAX,
            onBlur: settleName,
            onSubmitEditing: saveName,
          }}
        />
        <Button
          label={profile("save")}
          ariaLabel={profile("saveName")}
          onPress={saveName}
          busy={namePending}
        />
      </YStack>
      <YStack gap="$grid-gap">
        <TextField
          label={t("form.nick")}
          value={nick}
          onChangeText={changeNick}
          error={nickMessage}
          hint={nickHint}
          inputRef={nickInput}
          input={{
            autoCapitalize: "none",
            autoComplete: "nickname",
            autoCorrect: false,
            editable: !nickPending,
            maxLength: NICK_MAX,
            textContentType: "nickname",
            onBlur: settleNick,
            onSubmitEditing: saveNick,
          }}
        />
        <Button
          label={profile("save")}
          ariaLabel={profile("saveNick")}
          onPress={saveNick}
          busy={nickPending}
        />
      </YStack>
    </YStack>
  );
}

ProfileDetails.displayName = "ProfileDetails";
