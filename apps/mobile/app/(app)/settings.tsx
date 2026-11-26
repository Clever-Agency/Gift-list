import { type BlockedCard, type Me } from "@gift-list/contracts";
import { Button, Column, EmptyState, Heading, PageContainer, PageScroll, PersonRow, PersonRowSkeleton, Pressable, SafeArea, Screen, Switch, Text, YStack } from "@gift-list/ui";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { listBlocked, unblockUser } from "@/api/block";
import { updateHideFromSearch } from "@/api/me";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { formIssue, mutationErrorMessage, signOutErrorMessage } from "@/session/form-issue";
import { NotificationSettings } from "@/ui/notification-settings";
import { SessionErrorScreen } from "@/ui/session-error-screen";
import { SessionLoadingScreen } from "@/ui/session-loading-screen";
import { SiteFooter } from "@/ui/site-footer";
import { ToastHost } from "@/ui/toast";

/** One toast at a time; the saved notice is neutral, a failed save is destructive. */
type ToastState = { message: string; tone: "info" | "error" };

/**
 * «Настройки» (CLE-129, D-59): only the real settings — search visibility,
 * notification channels and the blocked list. Personal data (name, nick,
 * email) lives in «Профиль»; this screen no longer edits it.
 *
 * The screen guards the session like the other `(app)` screens: an anonymous
 * visitor leaves for login with a return to these settings. The read-only
 * profile fields moved away, so the form still mounts only once `/me` answered.
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
 * «Настройки» (CLE-129, D-59): only the real settings — the search-visibility
 * switch, the blocked list and the notification channels. The nick and every
 * other personal field moved to «Профиль», so this screen never reads or writes
 * the display name again.
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

  const [hideFromSearch, setHideFromSearch] = useState(user.hideFromSearch);
  const [hidePending, setHidePending] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  // The switch is disabled while its PATCH runs: one toggle, one request, and
  // the row never flips twice before the answer arrives.
  const hideInFlight = useRef(false);

  function goBack() {
    // A direct link has no history behind it: fall back to the wishlist.
    if (router.canGoBack()) router.back();
    else router.replace("/");
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
      setToast({ message: signOutErrorMessage(signedOut, t("form.network"), common), tone: "error" });
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
      auth.updateUser(result.data);
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
      // The one session-expired path of the screen; «Профиль» has the same one.
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
                {/* Story 3.5: the search visibility switch saves at once; the
                    hint stays in the catalog. */}
                <YStack gap="$2">
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
