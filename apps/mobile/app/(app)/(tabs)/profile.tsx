import {
  ABOUT_MAX,
  COUNTRY_CODES,
  DISPLAY_NAME_MAX,
  NICK_MAX,
  isValidBirthDate,
  nickIssue,
  type Gender,
  type Me,
  type ProfileFields,
  type ProfileUpdateBody,
} from "@gift-list/contracts";
import {
  Avatar,
  Button,
  Choice,
  ChoiceList,
  Close,
  Column,
  Dialog,
  focusField,
  Heading,
  PageContainer,
  PageScroll,
  SafeArea,
  Screen,
  SearchField,
  spacing,
  Switch,
  Text,
  useThemeColor,
  XStack,
  YStack,
} from "@gift-list/ui";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TextInputInstance } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { getMyProfile, updateMyProfile, updateName, updateNick } from "@/api/me";
import { getBrandName } from "@/config/env";
import { EmailChangeSection, emailChangeLinkError } from "@/profile/email-change";
import { profileRoute } from "@/profile/profile-route";
import { useAuth } from "@/session/auth-context";
import {
  formIssue,
  mutationErrorMessage,
  nickErrorText,
  nickFieldText,
  signOutErrorMessage,
} from "@/session/form-issue";
import { paramValue } from "@/session/return-path";
import { NotificationBell } from "@/ui/notification-bell";
import { ProfileMenu } from "@/ui/profile-menu";
import { SessionErrorScreen } from "@/ui/session-error-screen";
import { SessionLoadingScreen } from "@/ui/session-loading-screen";
import { SiteFooter } from "@/ui/site-footer";
import { TextField } from "@/ui/text-field";
import { ToastHost } from "@/ui/toast";

/** One toast at a time; a saved notice is neutral, a failed save is destructive. */
type ToastState = { message: string; tone: "info" | "error" };

/** The second read of «Профиль»: the profile fields on top of the session. */
type ProfileLoadStatus = "loading" | "ready" | "error";

/**
 * «Профиль» (CLE-129, D-59, AD-29): the tab is a data screen now, not a menu.
 * The avatar with initials, the name (editable), the nick (editable, moved here
 * from «Настройки») and the email (read-only) sit above the menu of the own
 * public profile, the settings, the support link and «Выйти».
 *
 * Birthday, gender, country, «Обо мне» and the friends switch are «О себе»
 * (T8.3) right below the nick. The email row is read-only until «Изменить»
 * opens the new-address field (T9.2, FR-56); the confirmation link returns to
 * `?emailChanged=1` / `?error=…`, and the screen shows the outcome and rereads
 * the session. The screen guards the session like «Настройки» (`next=/profile`),
 * so a direct anonymous visit lands on the login screen and comes back here.
 */
export default function MyProfileScreen() {
  const auth = useAuth();
  const t = useTranslations("app");
  const nav = useTranslations("app.nav");
  const profile = useTranslations("app.profile");
  const common = useTranslations("common");
  const brand = getBrandName();
  const params = useLocalSearchParams<{
    emailChanged?: string | string[];
    error?: string | string[];
  }>();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  // One sign-out request at a time: the row is disabled while it is in flight.
  const [signingOut, setSigningOut] = useState(false);
  const inFlight = useRef(false);
  // The confirmation link hands its outcome in `?emailChanged=1` / `?error=…`;
  // the marker keeps a repeated render of the same query from repeating the toast.
  const emailReturnHandled = useRef<string | null>(null);

  // «О себе» is a second read on top of the session (`GET /api/v1/me/profile`):
  // the session answer has no profile fields (AD-29).
  const [profileFields, setProfileFields] = useState<ProfileFields | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileLoadStatus>("loading");
  const [profileAttempt, setProfileAttempt] = useState(0);
  const expireProfileSession = useRef(expireSession);

  // The latest session-expiry path for the profile read: the read itself must not
  // restart when the session object changes (a saved name rewrites it).
  useEffect(function keepProfileExpiry() {
    expireProfileSession.current = expireSession;
  });

  useEffect(
    function loadProfileFields() {
      if (auth.state.status !== "ready") return;
      let cancelled = false;
      void getMyProfile().then(function applyProfileRead(result) {
        if (cancelled) return;
        if (result.ok) {
          setProfileFields(result.data);
          setProfileStatus("ready");
          return;
        }
        setProfileStatus("error");
        if (
          !("invalid" in result) &&
          !("network" in result) &&
          result.code === "UNAUTHENTICATED"
        ) {
          void expireProfileSession.current();
        }
      });
      return function stopProfileRead() {
        cancelled = true;
      };
    },
    [auth.state.status, profileAttempt],
  );

  function retryProfileFields() {
    setProfileStatus("loading");
    setProfileAttempt((value) => value + 1);
  }

  function acceptProfileFields(fields: ProfileFields) {
    setProfileFields(fields);
  }

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

  /**
   * The one-time outcome of the confirmation link (T9.1/T9.2, FR-56). Success
   * rereads the session, so the row shows the address Better Auth has just
   * committed; a stale or reused link says what to do next. The query is cleaned
   * at once, so a refresh or a back-navigation does not replay the notice.
   */
  useEffect(
    function applyEmailLinkResult() {
      const changed = paramValue(params.emailChanged);
      const linkError = paramValue(params.error);
      if (changed === undefined && linkError === undefined) {
        emailReturnHandled.current = null;
        return;
      }
      const marker = `${changed ?? ""}|${linkError ?? ""}`;
      if (emailReturnHandled.current === marker) return;
      emailReturnHandled.current = marker;
      // A stale link keeps the callback URL and only appends `?error=…`, so the
      // error wins over the success flag Better Auth sent with the callback.
      const confirmed = changed === "1" && linkError === undefined;
      setToast({
        message: confirmed
          ? profile("emailChange.changed")
          : emailChangeLinkError(linkError, profile),
        tone: confirmed ? "info" : "error",
      });
      router.setParams({ emailChanged: undefined, error: undefined });
      if (confirmed) auth.retry();
    },
    [params.emailChanged, params.error, auth, profile],
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
      showToast(signOutErrorMessage(signedOut, t("form.network"), common), "error");
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
   * and reports the failure with the matching catalog sentence.
   */
  async function signOut() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSigningOut(true);
    const result = await auth.signOut();
    inFlight.current = false;
    setSigningOut(false);
    if (!result.ok) showToast(signOutErrorMessage(result, t("form.network"), common), "error");
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
                <AboutSection
                  status={profileStatus}
                  fields={profileFields}
                  onRetry={retryProfileFields}
                  onSaved={acceptProfileFields}
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
 * behaviour. The email is the third form (T9.2): read-only until «Изменить»,
 * and the letter only promises the link — the account keeps the old address
 * until that link is opened.
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
      auth.updateUser(result.data);
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
      auth.updateUser(result.data);
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
        <EmailChangeSection email={user.email} onToast={onToast} onExpired={onExpired} />
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

/** The last day of each month; the year is never stored, so February stops at 29 (AD-23). */
const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

type PickerOption = { value: string; label: string };

/** Month names of the interface locale, in calendar order (D-58, AD-29). */
function monthOptions(locale: string): PickerOption[] {
  const format = new Intl.DateTimeFormat(locale, { month: "long" });
  return Array.from({ length: 12 }, function makeMonth(_, index) {
    return {
      value: String(index + 1),
      label: format.format(new Date(Date.UTC(2000, index, 1))),
    };
  });
}

/** Days of the chosen month: 30 February and 31 April are never offered (AD-29). */
function dayOptions(month: number | null): PickerOption[] {
  const last = month === null ? 31 : (MONTH_DAYS[month - 1] ?? 31);
  return Array.from({ length: last }, function makeDay(_, index) {
    return { value: String(index + 1), label: String(index + 1) };
  });
}

/**
 * Country names come from the built-in `Intl.DisplayNames` (D-64.3), sorted by
 * the name a person actually reads; the stored value stays the ISO code.
 */
function countryOptions(locale: string): PickerOption[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: "region" });
  } catch {
    names = null;
  }
  const collator = new Intl.Collator(locale);
  return COUNTRY_CODES.map(function makeCountry(code) {
    return { value: code, label: names?.of(code) ?? code };
  }).sort(function compareNames(left, right) {
    return collator.compare(left.label, right.label);
  });
}

type OptionFieldProps = {
  /** Visible label and the dialog title. */
  label: string;
  /** The accessible name, when the visible label alone is ambiguous. */
  accessibleLabel?: string;
  value: string | null;
  /** The option that clears the field and the text of the empty button. */
  emptyLabel: string;
  options: readonly PickerOption[];
  onChange: (value: string | null) => void;
  error?: string;
  search?: { label: string; placeholder: string; clearLabel: string; empty: string };
  testID?: string;
};

/**
 * A simple accessible select of the profile form: a labelled button shows the
 * chosen value, and the shared `Dialog` with a `radiogroup` of `Choice` rows
 * makes the choice. There is no separate `Select` in `@gift-list/ui`, and no new
 * dependency is allowed, so this is the small variant the step asks for; hover
 * and focus come from `Button`, `Choice` and `SearchField` of the package.
 */
function OptionField({
  label,
  accessibleLabel,
  value,
  emptyLabel,
  options,
  onChange,
  error,
  search,
  testID,
}: OptionFieldProps) {
  const t = useTranslations("app");
  const locale = useLocale();
  const iconColor = useThemeColor("foreground");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((option) => option.value === value);
  const current = selected?.label ?? emptyLabel;
  const needle = query.trim().toLocaleLowerCase(locale);
  const shown =
    needle === ""
      ? options
      : options.filter((option) => option.label.toLocaleLowerCase(locale).includes(needle));

  function openLayer() {
    setQuery("");
    setOpen(true);
  }

  function closeLayer() {
    setOpen(false);
  }

  function selectOption(next: string | null) {
    setOpen(false);
    onChange(next);
  }

  function chooseEmpty() {
    selectOption(null);
  }

  return (
    <YStack gap="$1" flex={1} minWidth={0} testID={testID}>
      <Text kind="label">{label}</Text>
      <Button
        variant="outline"
        label={current}
        ariaLabel={`${accessibleLabel ?? label}: ${current}`}
        onPress={openLayer}
      />
      {error ? (
        <Text kind="caption" tone="destructive" role="alert" aria-live="polite">
          {error}
        </Text>
      ) : null}
      <Dialog
        open={open}
        title={label}
        onClose={closeLayer}
        layout="detail"
        testID={testID ? `${testID}-layer` : undefined}
        closeAction={{
          label: t("toast.close"),
          icon: <Close size={spacing["icon-nav"]} color={iconColor} />,
        }}
      >
        <YStack gap="$grid-gap">
          {search ? (
            <SearchField
              label={search.label}
              placeholder={search.placeholder}
              value={query}
              onChangeText={setQuery}
              clearLabel={search.clearLabel}
            />
          ) : null}
          {search && needle !== "" && shown.length === 0 ? (
            <Text kind="caption" tone="muted">
              {search.empty}
            </Text>
          ) : null}
          <ChoiceList label={label} variant="row">
            <Choice
              variant="row"
              label={emptyLabel}
              selected={value === null}
              onPress={chooseEmpty}
            />
            {shown.map(function renderOption(option) {
              function chooseOption() {
                selectOption(option.value);
              }

              return (
                <Choice
                  key={option.value}
                  variant="row"
                  label={option.label}
                  selected={option.value === value}
                  onPress={chooseOption}
                />
              );
            })}
          </ChoiceList>
        </YStack>
      </Dialog>
    </YStack>
  );
}

OptionField.displayName = "OptionField";

type AboutErrors = {
  birthday?: string;
  gender?: string;
  country?: string;
  about?: string;
};

/** The loading and failure frames of «О себе»; the form itself loads its own values. */
function AboutSection({
  status,
  fields,
  onRetry,
  onSaved,
  onToast,
  onExpired,
}: {
  status: ProfileLoadStatus;
  fields: ProfileFields | null;
  onRetry: () => void;
  onSaved: (fields: ProfileFields) => void;
  onToast: (message: string, tone: ToastState["tone"]) => void;
  onExpired: () => Promise<void>;
}) {
  const profile = useTranslations("app.profile");

  return (
    <YStack gap="$grid-gap">
      <Heading level={2}>{profile("aboutYou")}</Heading>
      {status === "loading" ? (
        <Text kind="caption" tone="muted">
          {profile("fieldsLoading")}
        </Text>
      ) : null}
      {status === "error" ? (
        <YStack gap="$grid-gap">
          <Text kind="caption" tone="destructive" role="alert">
            {profile("fieldsLoadError")}
          </Text>
          <Button variant="outline" label={profile("retry")} onPress={onRetry} />
        </YStack>
      ) : null}
      {status === "ready" && fields ? (
        <AboutFields
          fields={fields}
          onSaved={onSaved}
          onToast={onToast}
          onExpired={onExpired}
        />
      ) : null}
    </YStack>
  );
}

AboutSection.displayName = "AboutSection";

/**
 * «О себе» (CLE-129/T8.3, D-58, AD-29): the birthday pair without a year, the
 * gender, the country, «Обо мне» and the one switch that shows all of it to
 * accepted friends. The block has its own save (the name and the nick keep
 * theirs): one failed field must not undo another saved value. The birthday
 * always travels as a pair, because the server stores a day only together with
 * its month.
 */
function AboutFields({
  fields,
  onSaved,
  onToast,
  onExpired,
}: {
  fields: ProfileFields;
  onSaved: (fields: ProfileFields) => void;
  onToast: (message: string, tone: ToastState["tone"]) => void;
  onExpired: () => Promise<void>;
}) {
  const t = useTranslations("app");
  const profile = useTranslations("app.profile");
  const common = useTranslations("common");
  const locale = useLocale();
  const aboutInput = useRef<TextInputInstance | null>(null);
  const savingRef = useRef(false);

  const [day, setDay] = useState<number | null>(fields.birthDay);
  const [month, setMonth] = useState<number | null>(fields.birthMonth);
  const [gender, setGender] = useState<Gender | null>(fields.gender);
  const [country, setCountry] = useState<string | null>(fields.country);
  const [about, setAbout] = useState(fields.about ?? "");
  const [visible, setVisible] = useState(fields.profileVisibleToFriends);
  const [errors, setErrors] = useState<AboutErrors>({});
  const [saving, setSaving] = useState(false);

  const months = useMemo(function readMonths() {
    return monthOptions(locale);
  }, [locale]);
  const days = useMemo(
    function readDays() {
      return dayOptions(month);
    },
    [month],
  );
  const countries = useMemo(
    function readCountries() {
      return countryOptions(locale);
    },
    [locale],
  );

  const aboutCount = Array.from(about).length;

  function clearError(field: keyof AboutErrors) {
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function applyProfile(next: ProfileFields) {
    setDay(next.birthDay);
    setMonth(next.birthMonth);
    setGender(next.gender);
    setCountry(next.country);
    setAbout(next.about ?? "");
    setVisible(next.profileVisibleToFriends);
    setErrors({});
  }

  function focusAbout() {
    focusField(aboutInput.current);
  }

  /** One choice clears the pair: a day without a month is never stored (AD-29). */
  function changeDay(next: string | null) {
    clearError("birthday");
    const value = next === null ? null : Number(next);
    setDay(value);
    if (value === null) setMonth(null);
  }

  /** A smaller month drops a day that no longer exists; the person picks it again. */
  function changeMonth(next: string | null) {
    clearError("birthday");
    const value = next === null ? null : Number(next);
    setMonth(value);
    if (value === null) {
      setDay(null);
      return;
    }
    if (day !== null && day > (MONTH_DAYS[value - 1] ?? 31)) setDay(null);
  }

  function changeGender(next: Gender | null) {
    clearError("gender");
    setGender(next);
  }

  function changeCountry(next: string | null) {
    clearError("country");
    setCountry(next);
  }

  function changeAbout(next: string) {
    clearError("about");
    setAbout(next);
  }

  function changeVisible(next: boolean) {
    setVisible(next);
  }

  function saveFields() {
    if (savingRef.current) return;

    const next: AboutErrors = {};
    if ((day === null) !== (month === null)) {
      next.birthday = profile("birthdayPair");
    } else if (day !== null && month !== null && !isValidBirthDate(day, month)) {
      next.birthday = profile("birthdayInvalid");
    }
    if (aboutCount > ABOUT_MAX) {
      next.about = profile("aboutTooLong", { max: ABOUT_MAX });
    }
    setErrors(next);
    if (next.birthday !== undefined) return;
    if (next.about !== undefined) {
      focusAbout();
      return;
    }
    void submitFields();
  }

  async function submitFields() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);

    const body: ProfileUpdateBody = {
      birthDay: day,
      birthMonth: month,
      gender,
      country,
      about: about.trim() === "" ? null : about.trim(),
      profileVisibleToFriends: visible,
    };
    const result = await updateMyProfile(body);

    savingRef.current = false;
    setSaving(false);

    if (result.ok) {
      applyProfile(result.data);
      onSaved(result.data);
      onToast(profile("fieldsSaved"), "info");
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
    if (result.field === "birthDay" || result.field === "birthMonth") {
      setErrors({ birthday: profile("birthdayInvalid") });
      return;
    }
    if (result.field === "gender") {
      setErrors({ gender: profile("genderInvalid") });
      return;
    }
    if (result.field === "country") {
      setErrors({ country: profile("countryInvalid") });
      return;
    }
    if (result.field === "about") {
      setErrors({
        about:
          aboutCount > ABOUT_MAX
            ? profile("aboutTooLong", { max: ABOUT_MAX })
            : mutationErrorMessage(result, common),
      });
      focusAbout();
      return;
    }
    onToast(mutationErrorMessage(result, common), "error");
  }

  function chooseMale() {
    changeGender("MALE");
  }

  function chooseFemale() {
    changeGender("FEMALE");
  }

  function chooseNoGender() {
    changeGender(null);
  }

  return (
    <YStack gap="$grid-gap">
      <YStack gap="$grid-gap">
        <Text kind="label">{profile("birthday")}</Text>
        <XStack gap="$3" alignItems="flex-start">
          <OptionField
            label={profile("birthDay")}
            accessibleLabel={profile("birthDayLabel")}
            value={day === null ? null : String(day)}
            emptyLabel={profile("none")}
            options={days}
            onChange={changeDay}
            testID="profile-birth-day"
          />
          <OptionField
            label={profile("birthMonth")}
            accessibleLabel={profile("birthMonthLabel")}
            value={month === null ? null : String(month)}
            emptyLabel={profile("none")}
            options={months}
            onChange={changeMonth}
            testID="profile-birth-month"
          />
        </XStack>
        {errors.birthday ? (
          <Text kind="caption" tone="destructive" role="alert" aria-live="polite">
            {errors.birthday}
          </Text>
        ) : null}
      </YStack>
      <ChoiceList
        label={profile("gender")}
        heading={profile("gender")}
        variant="chip"
        error={errors.gender}
      >
        <Choice
          variant="chip"
          label={profile("genderMale")}
          selected={gender === "MALE"}
          onPress={chooseMale}
        />
        <Choice
          variant="chip"
          label={profile("genderFemale")}
          selected={gender === "FEMALE"}
          onPress={chooseFemale}
        />
        <Choice
          variant="chip"
          label={profile("genderNone")}
          selected={gender === null}
          onPress={chooseNoGender}
        />
      </ChoiceList>
      <OptionField
        label={profile("country")}
        value={country}
        emptyLabel={profile("countryNone")}
        options={countries}
        onChange={changeCountry}
        error={errors.country}
        search={{
          label: profile("countrySearch"),
          placeholder: profile("countrySearchPlaceholder"),
          clearLabel: profile("countrySearchClear"),
          empty: profile("countryEmpty"),
        }}
        testID="profile-country"
      />
      <TextField
        label={profile("about")}
        value={about}
        onChangeText={changeAbout}
        error={errors.about}
        hint={profile("aboutCounter", { count: aboutCount, max: ABOUT_MAX })}
        multiline
        rows={5}
        inputRef={aboutInput}
        input={{ placeholder: profile("aboutPlaceholder") }}
      />
      <Switch
        label={profile("visibleToFriends")}
        hint={profile("visibleToFriendsHint")}
        checked={visible}
        onChange={changeVisible}
      />
      <Button
        label={profile("save")}
        ariaLabel={profile("saveAbout")}
        onPress={saveFields}
        busy={saving}
      />
    </YStack>
  );
}

AboutFields.displayName = "AboutFields";

