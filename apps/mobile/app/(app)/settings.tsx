import { NICK_MAX, nickIssue, type BlockedCard, type Me } from "@gift-list/contracts";
import { Button, Column, EmptyState, focusField, Heading, PageContainer, PageScroll, PersonRow, PersonRowSkeleton, Pressable, SafeArea, Screen, Switch, Text, YStack } from "@gift-list/ui";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import type { TextInputInstance } from "react-native";
import { useTranslations } from "use-intl";
import { listBlocked, unblockUser } from "@/api/block";
import { updateHideFromSearch, updateNick } from "@/api/me";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { formIssue, mutationErrorMessage, nickErrorText, nickFieldText } from "@/session/form-issue";
import { NotificationSettings } from "@/ui/notification-settings";
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
  const nickInput = useRef<TextInputInstance | null>(null);

  const [nick, setNick] = useState(user.nick);
  const [nickSettled, setNickSettled] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [unchanged, setUnchanged] = useState(false);
  const [pending, setPending] = useState(false);
  const [hideFromSearch, setHideFromSearch] = useState(user.hideFromSearch);
  const [hidePending, setHidePending] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  // The disabled button follows a state update, which flushes after the handler:
  // a second tap in the same frame must not send a second PUT.
  const inFlight = useRef(false);
  // The switch is disabled while its PATCH runs for the same reason: one toggle,
  // one request, and the row never flips twice before the answer arrives.
  const hideInFlight = useRef(false);

  const normalized = nick.trim().toLowerCase();
  const liveNick = nickIssue(nick);
  const valid = liveNick === null;
  const hint = unchanged
    ? t("settings.nickUnchanged")
    : valid
      ? t("form.nickPreview", { nick: nick.toLowerCase() })
      : undefined;
  const error = fieldError ?? nickFieldText(liveNick, nickSettled, t);

  function focusNick() {
    // UI5: the invalid nick is focused and scrolled to the middle of the screen.
    focusField(nickInput.current);
  }

  function changeNick(value: string) {
    setNick(value);
    setFieldError(null);
    setUnchanged(false);
  }

  function settleNick() {
    setNickSettled(true);
  }

  function goBack() {
    // A direct link has no history behind it: fall back to the wishlist.
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  function save() {
    if (inFlight.current) return;
    if (!valid) {
      // The reason sits under the field, like on register; length waits for this press.
      setNickSettled(true);
      setFieldError(null);
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
      await expireSession();
      return;
    }
    const issue = formIssue(result, t, common, "register");
    if (issue.reason === "NICK_TAKEN") {
      setFieldError(issue.text);
      focusNick();
      return;
    }
    if (issue.field === "nick") {
      // A server-side nick validation names the reason of the value, not the rules.
      setNickSettled(true);
      setFieldError(nickErrorText(nick, t, common("errors.code.VALIDATION")));
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

  /**
   * The shared session-expired path of the screen: clear the dead session and let
   * the guard open login with the reason and a return to these settings. A failed
   * sign-out leaves the screen mounted, so it is reported like any other network
   * failure instead of silently pretending the session is gone.
   */
  async function expireSession() {
    onSessionExpired(true);
    const signedOut = await auth.signOut();
    if (!signedOut.ok) {
      onSessionExpired(false);
      setToast({ message: t("form.network"), tone: "error" });
    }
  }

  function dismissToast() {
    setToast(null);
  }

  function showToast(message: string, tone: ToastState["tone"]) {
    setToast({ message, tone });
  }

  function changeHideFromSearch(next: boolean) {
    void submitHideFromSearch(next);
  }

  /**
   * Story 3.5 (FR-8): the flag saves at once, without a separate «Сохранить».
   * The row flips optimistically and is disabled until the answer; any failure
   * rolls it back to the server value, so the screen never disagrees with `/me`.
   */
  async function submitHideFromSearch(next: boolean) {
    if (hideInFlight.current) return;
    hideInFlight.current = true;
    setHideFromSearch(next);
    setHidePending(true);

    const result = await updateHideFromSearch(next);

    hideInFlight.current = false;
    setHidePending(false);

    if (result.ok) {
      setHideFromSearch(result.data.hideFromSearch);
      auth.setUser(result.data);
      setToast({ message: t("settings.hideFromSearchSaved"), tone: "info" });
      return;
    }

    setHideFromSearch(!next);
    if ("network" in result) {
      setToast({ message: t("form.network"), tone: "error" });
      return;
    }
    if ("invalid" in result) {
      setToast({ message: common("errors.generic"), tone: "error" });
      return;
    }
    if (result.code === "UNAUTHENTICATED") {
      // The same session-expired path as the nick form above.
      await expireSession();
      return;
    }
    const issue = formIssue(result, t, common, "register");
    setToast({ message: issue.text, tone: "error" });
  }

  return (
    <Screen>
      <SafeArea>
        <Stack.Screen options={{ title: t("settings.pageTitle", { brand }) }} />
        {/* A form reads best narrow: `DESIGN.md` → Layout → max-form. The gutter is
            the Tamagui media clause, so the browser turns it into a CSS media
            query: no card grid here, the window width is never read in JS. */}
        <PageScroll testID="settings-page" keyboardShouldPersistTaps="handled">
          <PageContainer>
            <Column
              size="form"
              flexGrow={1}
              paddingHorizontal="$page-gutter medium:$page-gutter-lg"
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
                paddingTop="$2"
                paddingBottom="$section-gap"
              >
                <YStack gap="$grid-gap">
                  <TextField
                    label={t("form.nick")}
                    value={nick}
                    onChangeText={changeNick}
                    error={error}
                    hint={hint}
                    inputRef={nickInput}
                    input={{
                      autoCapitalize: "none",
                      autoComplete: "nickname",
                      autoCorrect: false,
                      editable: !pending,
                      maxLength: NICK_MAX,
                      textContentType: "nickname",
                      onBlur: settleNick,
                      onSubmitEditing: save,
                    }}
                  />
                  <PrimaryButton label={t("settings.save")} onPress={save} disabled={pending} />
                </YStack>
                {/* Story 3.5: the search visibility switch lives under the nick block
                    and saves at once; the hint stays in the catalog. */}
                <YStack gap="$2" paddingTop="$grid-gap">
                  <Switch
                    label={t("settings.hideFromSearch")}
                    hint={t("settings.hideFromSearchHint")}
                    checked={hideFromSearch}
                    disabled={hidePending}
                    onChange={changeHideFromSearch}
                    testID="hide-from-search"
                  />
                </YStack>
                {/* Story 4.5: «Заблокированные» — the only way back from a block
                    (`EXPERIENCE.md` → Block); the friendship and the subscriptions
                    are not restored by it. */}
                <BlockedSection onToast={showToast} onExpired={expireSession} />
                <NotificationSettings key={user.id} />
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

/** The list of my own blocks: the first page, an optional next one and one row per person. */
type BlockedState =
  | { status: "loading" }
  | { status: "error"; network: boolean }
  | { status: "ready"; items: BlockedCard[]; cursor: string | null; more: boolean };

/**
 * «Настройки» → «Заблокированные» (Story 4.5, EXPERIENCE.md → Block): the name,
 * the @nick and one «Разблокировать» per row, no confirm — the block removed the
 * friendship and the subscriptions for good, and an unblock only removes the
 * viewer's own row. The row leaves the list before the answer (optimistic) and
 * comes back with the toast if the request failed. The list reads `/me/blocks`,
 * where only the viewer's own blocks are; the reverse block is never shown.
 */
function BlockedSection({
  onToast,
  onExpired,
}: {
  onToast: (message: string, tone: "info" | "error") => void;
  onExpired: () => Promise<void>;
}) {
  const settings = useTranslations("app.settings");
  const profile = useTranslations("app.profile");
  const common = useTranslations("common");
  const [state, setState] = useState<BlockedState>({ status: "loading" });
  const [busy, setBusy] = useState<string | null>(null);
  // The whole section takes one request at a time: a second press in the same
  // frame must not send a second read or unblock.
  const inFlight = useRef(false);
  // A late answer of an older read must not replace the newer list.
  const request = useRef(0);

  useEffect(function loadOnMount() {
    void load(++request.current);
    // The mount read is the first page; retry and «Показать ещё» own the others.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(id: number) {
    const result = await listBlocked();
    if (id !== request.current) return;

    if (result.ok) {
      setState({
        status: "ready",
        items: result.page.items,
        cursor: result.page.nextCursor,
        more: false,
      });
      return;
    }
    if ("code" in result && result.code === "UNAUTHENTICATED") {
      await onExpired();
      return;
    }
    setState({ status: "error", network: "network" in result });
  }

  function retry() {
    setState({ status: "loading" });
    void load(++request.current);
  }

  /** The next page appends to the list; the server owns the order and the cursor. */
  async function showMore() {
    if (
      inFlight.current ||
      state.status !== "ready" ||
      state.cursor === null ||
      state.more
    ) {
      return;
    }
    const cursor = state.cursor;
    inFlight.current = true;
    setState({ ...state, more: true });

    const result = await listBlocked(cursor);

    inFlight.current = false;
    if (result.ok) {
      const page = result.page;
      setState(function append(current) {
        if (current.status !== "ready") return current;
        const seen = new Set(current.items.map((item) => item.nick));
        return {
          status: "ready",
          items: [...current.items, ...page.items.filter((item) => !seen.has(item.nick))],
          cursor: page.nextCursor,
          more: false,
        };
      });
      return;
    }

    setState(function stopMore(current) {
      return current.status === "ready" ? { ...current, more: false } : current;
    });
    if ("code" in result && result.code === "UNAUTHENTICATED") {
      await onExpired();
      return;
    }
    onToast(
      "network" in result ? settings("loadError") : settings("blocked.loadErrorGeneric"),
      "error",
    );
  }

  /**
   * The row goes at once; `UNBLOCKED` and the idempotent `NOT_BLOCKED` are both
   * successes. A failure puts the whole previous list back, not just the row.
   */
  async function unblock(card: BlockedCard) {
    if (inFlight.current || state.status !== "ready") return;
    inFlight.current = true;
    setBusy(card.nick);
    const snapshot = state;
    setState({
      ...state,
      items: state.items.filter((item) => item.nick !== card.nick),
    });

    const result = await unblockUser(card.nick);

    inFlight.current = false;
    setBusy(null);

    if (result.ok) {
      onToast(settings("blocked.unblocked", { name: card.displayName }), "info");
      return;
    }

    setState(snapshot);
    if ("network" in result) {
      onToast(profile("relationship.network"), "error");
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
    if (result.code === "NOT_FOUND") {
      onToast(common("errors.code.NOT_FOUND"), "error");
      return;
    }
    onToast(mutationErrorMessage(result, common), "error");
  }

  return (
    // The section rhythm is `DESIGN.md` → Layout → section-gap; the head is
    // `heading`, the same role the other section titles of the app use.
    <YStack gap="$grid-gap" paddingTop="$section-gap" testID="blocked-section">
      <Heading level={2}>{settings("blocked.title")}</Heading>
      {state.status === "loading" ? (
        <YStack role="status" aria-busy aria-label={common("loading")} gap="$grid-gap">
          {[0, 1].map(function skeletonKey(key) {
            return <PersonRowSkeleton key={key} testID="blocked-row-skeleton" />;
          })}
        </YStack>
      ) : state.status === "error" ? (
        <YStack gap="$grid-gap">
          <Text tone="muted">
            {state.network ? settings("loadError") : settings("blocked.loadErrorGeneric")}
          </Text>
          <Button variant="secondary" label={settings("blocked.retry")} onPress={retry} />
        </YStack>
      ) : state.items.length === 0 ? (
        <EmptyState title={settings("blocked.empty")} />
      ) : (
        <>
          <YStack role="list" gap="$2">
            {state.items.map(function renderBlocked(card) {
              return (
                <YStack key={card.nick} role="listitem">
                  <PersonRow
                    displayName={card.displayName}
                    nick={card.nick}
                    actions={
                      <Button
                        variant="ghost"
                        label={settings("blocked.unblock")}
                        ariaLabel={settings("blocked.unblockLabel", { name: card.displayName })}
                        disabled={busy !== null && busy !== card.nick}
                        busy={busy === card.nick}
                        onPress={function askUnblock() {
                          void unblock(card);
                        }}
                        testID={`unblock-${card.nick}`}
                      />
                    }
                    testID={`blocked-row-${card.nick}`}
                  />
                </YStack>
              );
            })}
          </YStack>
          {state.cursor === null ? null : (
            <Button
              variant="secondary"
              label={settings("blocked.showMore")}
              busy={state.more}
              onPress={function more() {
                void showMore();
              }}
              testID="blocked-more"
            />
          )}
        </>
      )}
    </YStack>
  );
}

BlockedSection.displayName = "BlockedSection";
