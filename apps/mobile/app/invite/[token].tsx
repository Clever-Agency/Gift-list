import type { InviteLinkInviter, InviteLinkState } from "@gift-list/contracts";
import {
  Button,
  Column,
  Heading,
  LoadingCards,
  PageContainer,
  PageScroll,
  SafeArea,
  Screen,
  spacing,
  Text,
  YStack,
} from "@gift-list/ui";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { acceptInvite, getInvitePreview } from "@/api/invite-link";
import { getBrandName } from "@/config/env";
import { copyMyInviteLink } from "@/invite/copy-link";
import { inviteRoute } from "@/invite/invite-route";
import { useAuth } from "@/session/auth-context";
import { paramValue } from "@/session/return-path";
import { NavLink } from "@/ui/nav-link";
import { NotFoundScreen } from "@/ui/not-found-screen";
import { PrimaryButton } from "@/ui/primary-button";
import { SessionErrorScreen } from "@/ui/session-error-screen";
import { SessionLoadingScreen } from "@/ui/session-loading-screen";
import { SiteFooter } from "@/ui/site-footer";
import { ToastHost } from "@/ui/toast";

/**
 * A failed preview read offers the retry view. `missing` is the single closed
 * answer for an unknown token, a `Block` and a malformed link (AD-7, AD-21), so
 * the screen never names somebody who blocked the viewer.
 */
type ScreenState =
  | { status: "loading" }
  // The token is kept with the answer: a reused route with another link must not
  // show the previous inviter while the new read is in flight.
  | { status: "ready"; token: string; inviter: InviteLinkInviter; state: InviteLinkState }
  | { status: "missing" }
  | { status: "error"; kind: "network" | "generic" };

type ToastState = { message: string; tone: "info" | "error" };

/**
 * Story 4.7 / AD-21: the app screen behind `/invite/:token`. A guest keeps the
 * registration hand-off of Story 1.4: the token rides in `next`, and the server
 * creates the friendship in the registration transaction. A signed-in visitor
 * sees only the closed preview state — `can_accept`, `self` or `friends` — and
 * nothing is written until «Добавить» is pressed; loading the screen never
 * accepts the link.
 */
export default function InviteScreen() {
  const invite = useTranslations("app.invite");
  const myWishlist = useTranslations("app.myWishlist");
  const common = useTranslations("common");
  const brand = getBrandName();
  const auth = useAuth();
  const params = useLocalSearchParams<{ token?: string }>();
  const route = inviteRoute(paramValue(params.token));
  const token = route?.token ?? null;
  const [state, setState] = useState<ScreenState>(
    token === null ? { status: "missing" } : { status: "loading" },
  );
  const [attempt, setAttempt] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [accepting, setAccepting] = useState(false);
  // The profile the accepted link leads to; the toast cannot outlive this route
  // (the app has no global toast host), so the replace waits for its dismissal.
  const [leaveNick, setLeaveNick] = useState<string | null>(null);
  const acceptInFlight = useRef(false);

  useEffect(function redirectAnonymous() {
    if (auth.state.status === "anonymous" && token !== null) {
      router.replace({ pathname: "/register", params: { next: `/invite/${token}` } });
    }
  }, [auth.state.status, token]);

  useEffect(function loadPreview() {
    if (auth.state.status !== "ready" || token === null) return;
    const currentToken = token;
    let cancelled = false;

    async function requestPreview() {
      const result = await getInvitePreview(currentToken);
      if (cancelled) return;
      if (result.ok) {
        if (result.state === undefined) {
          setState({ status: "error", kind: "generic" });
          setToast({ message: common("errors.generic"), tone: "error" });
          return;
        }
        setState({
          status: "ready",
          token: currentToken,
          inviter: result.inviter,
          state: result.state,
        });
        return;
      }
      if ("invalid" in result || ("code" in result && result.code === "NOT_FOUND")) {
        setState({ status: "missing" });
        return;
      }
      if ("code" in result && result.code === "UNAUTHENTICATED") {
        // The stored session is dead: clearing it hands the route back to the
        // guest hand-off above, which reopens registration with the same token.
        const signedOut = await auth.signOut();
        if (!signedOut.ok && !cancelled) {
          setState({ status: "error", kind: "network" });
          setToast({ message: invite("network"), tone: "error" });
        }
        return;
      }
      const network = "network" in result;
      setState({ status: "error", kind: network ? "network" : "generic" });
      setToast({
        message: network ? invite("network") : common(`errors.code.${result.code}`),
        tone: "error",
      });
    }

    void requestPreview();
    return function stopLoad() {
      cancelled = true;
    };
    // `auth` is only read on the expired-session branch; re-running the fetch on
    // every auth context update would refetch the preview for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.state.status, token, attempt]);

  if (token === null) {
    return <NotFoundScreen />;
  }

  if (auth.state.status === "error") {
    return <SessionErrorScreen size="form" onRetry={auth.retry} />;
  }

  if (auth.state.status !== "ready") return <SessionLoadingScreen size="form" />;

  // A reused route with a new token reads as loading until its own answer lands.
  const view: ScreenState =
    state.status === "ready" && state.token !== token ? { status: "loading" } : state;

  function retry() {
    setToast(null);
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }

  function dismissToast() {
    setToast(null);
    const nick = leaveNick;
    if (nick === null) return;
    setLeaveNick(null);
    openProfile(nick);
  }

  function openProfile(nick: string) {
    router.replace({ pathname: "/u/[nick]", params: { nick } });
  }

  function cancel() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  async function copyInvite() {
    const result = await copyMyInviteLink();
    setToast({
      message: result === "copied" ? invite("copyDone") : myWishlist("copyLinkFailed"),
      tone: result === "copied" ? "info" : "error",
    });
  }

  /**
   * The one write of this screen: the pair edge is created only here, by an
   * explicit press (AD-21). A second press while the request runs is ignored,
   * and `ALREADY_FRIENDS` is the same successful outcome as `FRIENDS`.
   */
  async function addFriend() {
    if (token === null || view.status !== "ready" || view.state !== "can_accept") return;
    if (acceptInFlight.current) return;
    const requested = view;
    acceptInFlight.current = true;
    setAccepting(true);
    setToast(null);

    const result = await acceptInvite(token);
    acceptInFlight.current = false;
    setAccepting(false);

    if (result.ok) {
      setToast({
        message: invite("acceptDone", { name: requested.inviter.displayName }),
        tone: "info",
      });
      setLeaveNick(requested.inviter.nick);
      return;
    }
    if ("invalid" in result || ("code" in result && result.code === "NOT_FOUND")) {
      setState({ status: "missing" });
      return;
    }
    if ("code" in result && result.code === "UNAUTHENTICATED") {
      const signedOut = await auth.signOut();
      if (!signedOut.ok) setToast({ message: invite("network"), tone: "error" });
      return;
    }
    const network = "network" in result;
    setToast({
      message: network ? invite("network") : common(`errors.code.${result.code}`),
      tone: "error",
    });
  }

  function handleAdd() {
    void addFriend();
  }

  function handleCopy() {
    void copyInvite();
  }

  return (
    <Screen>
      <SafeArea>
        <Stack.Screen options={{ title: invite("pageTitle", { brand }) }} />
        <PageScroll testID="invite-page">
          <PageContainer>
            <Column
              size="form"
              flexGrow={1}
              paddingHorizontal="$page-gutter medium:$page-gutter-lg"
              paddingTop="$page-gutter"
              gap="$2"
            >
              <YStack
                testID="invite-content"
                flexGrow={1}
                paddingTop="$2"
                paddingBottom="$section-gap"
                gap="$grid-gap"
              >
                {view.status === "loading" ? (
                  <LoadingCards
                    testID="invite-loading"
                    label={common("loading")}
                    width="100%"
                    count={1}
                  />
                ) : view.status === "error" ? (
                  <RetryView
                    text={
                      view.kind === "network"
                        ? myWishlist("loadError")
                        : myWishlist("loadErrorGeneric")
                    }
                    label={myWishlist("retry")}
                    onPress={retry}
                  />
                ) : view.status === "missing" ? (
                  <YStack
                    testID="invite-not-found"
                    width="100%"
                    alignItems="center"
                    paddingVertical="$section-gap"
                    gap="$grid-gap"
                  >
                    <Heading level={1} kind="display-sm" textAlign="center">
                      {invite("notFound")}
                    </Heading>
                    <NavLink href="/">{invite("toHome")}</NavLink>
                  </YStack>
                ) : (
                  <InvitePanel
                    state={view.state}
                    inviter={view.inviter}
                    accepting={accepting}
                    onAdd={handleAdd}
                    onCancel={cancel}
                    onOpenWishlist={function openInviterWishlist() {
                      openProfile(view.inviter.nick);
                    }}
                    onCopy={handleCopy}
                  />
                )}
              </YStack>
              <SiteFooter />
            </Column>
          </PageContainer>
        </PageScroll>
        {toast !== null ? (
          <ToastHost
            message={toast.message}
            tone={toast.tone}
            onDismiss={dismissToast}
            offsetBottom={spacing["page-gutter"]}
          />
        ) : null}
      </SafeArea>
    </Screen>
  );
}

InviteScreen.displayName = "InviteScreen";

/**
 * DESIGN.md → Avatar: a circle with the first letters of the name, decorative
 * because the `h1` carries the name. `packages/ui` has no Avatar component; the
 * circle is composed from the shared `avatar-lg` token and `muted` background.
 */
function initials(displayName: string): string {
  return displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(function firstLetter(word) {
      return word.charAt(0).toUpperCase();
    })
    .join("");
}

function InviteAvatar({ name }: { name: string }) {
  return (
    <YStack
      testID="invite-avatar"
      width="$avatar-lg"
      height="$avatar-lg"
      alignItems="center"
      justifyContent="center"
      backgroundColor="$muted"
      borderRadius="$full"
      aria-hidden
    >
      <Text kind="heading" tone="muted">
        {initials(name)}
      </Text>
    </YStack>
  );
}

InviteAvatar.displayName = "InviteAvatar";

type InvitePanelProps = {
  state: InviteLinkState;
  inviter: InviteLinkInviter;
  accepting: boolean;
  onAdd: () => void;
  onCancel: () => void;
  onOpenWishlist: () => void;
  onCopy: () => void;
};

/**
 * EXPERIENCE.md → State Patterns 228–230: each preview state has one text and
 * one action. Only `can_accept` writes, and only after «Добавить».
 */
function InvitePanel({
  state,
  inviter,
  accepting,
  onAdd,
  onCancel,
  onOpenWishlist,
  onCopy,
}: InvitePanelProps) {
  const invite = useTranslations("app.invite");
  const name = inviter.displayName;

  return (
    <YStack
      testID="invite-panel"
      width="100%"
      maxWidth="$max-form"
      alignSelf="center"
      alignItems="center"
      backgroundColor="$surface"
      borderWidth={1}
      borderColor="$border"
      borderRadius="$lg"
      padding="$section-gap"
      gap="$grid-gap"
    >
      {state === "can_accept" ? <InviteAvatar name={name} /> : null}
      <Heading level={1} kind="display-sm" textAlign="center">
        {state === "can_accept"
          ? invite("addTitle", { name })
          : state === "friends"
            ? invite("friends", { name })
            : invite("self")}
      </Heading>
      <YStack width="100%" gap="$2">
        {state === "can_accept" ? (
          <>
            <Button
              testID="invite-add"
              fullWidth
              label={invite("add")}
              busy={accepting}
              onPress={onAdd}
            />
            <Button
              testID="invite-cancel"
              fullWidth
              variant="ghost"
              label={invite("cancel")}
              onPress={onCancel}
            />
          </>
        ) : state === "friends" ? (
          <Button
            testID="invite-open-wishlist"
            fullWidth
            label={invite("openWishlist")}
            onPress={onOpenWishlist}
          />
        ) : (
          <Button testID="invite-copy" fullWidth label={invite("copy")} onPress={onCopy} />
        )}
      </YStack>
    </YStack>
  );
}

InvitePanel.displayName = "InvitePanel";

/** A failed read: one line of text and the retry button. */
function RetryView({ text, label, onPress }: { text: string; label: string; onPress: () => void }) {
  return (
    <YStack
      testID="invite-error"
      width="100%"
      maxWidth="$max-form"
      alignSelf="center"
      paddingVertical="$4"
      gap="$grid-gap"
    >
      <Text tone="muted" textAlign="center">
        {text}
      </Text>
      <PrimaryButton label={label} onPress={onPress} />
    </YStack>
  );
}

RetryView.displayName = "RetryView";
