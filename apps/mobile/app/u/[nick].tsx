import type {
  GiftCard,
  ProfileInviteCooldown,
  ProfileRelationship,
} from "@gift-list/contracts";
import {
  Column,
  Heading,
  LoadingCards,
  PageContainer,
  PageScroll,
  SafeArea,
  Screen,
  spacing,
  Text,
  XStack,
  YStack,
} from "@gift-list/ui";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { fetchProfile, type ProfileOwner } from "@/api/profile";
import { getBrandName } from "@/config/env";
import {
  optimisticRelation,
  requestRelationshipAction,
  type RelationshipAction,
} from "@/profile/relationship-action";
import { RelationshipActions } from "@/profile/relationship-actions";
import { profileRoute } from "@/profile/profile-route";
import {
  requestSubscriptionAction,
  type SubscriptionAction,
} from "@/profile/subscription-action";
import { SubscriptionActions } from "@/profile/subscription-actions";
import { useAuth } from "@/session/auth-context";
import { paramValue } from "@/session/return-path";
import { EmptyState } from "@/ui/empty-state";
import { NotFoundScreen } from "@/ui/not-found-screen";
import { PrimaryButton } from "@/ui/primary-button";
import { PublicGiftCard } from "@/ui/public-gift-card";
import { SessionErrorScreen } from "@/ui/session-error-screen";
import { SessionLoadingScreen } from "@/ui/session-loading-screen";
import { SiteFooter } from "@/ui/site-footer";
import { ToastHost } from "@/ui/toast";
import { useCardGrid } from "@/ui/use-card-grid";

/**
 * A failed profile read offers the retry view; `not_found` is its own state, the
 * same closed answer for an unknown nick and a Block (AD-7). The server has
 * already filtered wishes by `VisibilityPolicy`, so this screen never applies a
 * visibility rule of its own.
 */
type ScreenState =
  | { status: "loading" }
  // The nick is kept with the answer: a reused route with another nick must not
  // show the previous profile while the new read is in flight.
  | {
      status: "ready";
      nick: string;
      gifts: GiftCard[];
      owner: ProfileOwner;
      /** The viewer's closed relation from 4.1.2, or `NONE` when absent. */
      relationship: ProfileRelationship;
      /**
       * Story 4.2.3: the profile-only live rejection window. `null` when the
       * server did not send the field, which means no cooldown is active.
       */
      inviteCooldown: ProfileInviteCooldown | null;
      /**
       * Story 4.6: the viewer's own directed subscription to this owner. A
       * `false` body without the field means there is no edge.
       */
      subscribed: boolean;
    }
  | { status: "missing" }
  | { status: "error"; kind: "network" | "generic" };

type ToastState = { message: string; tone: "info" | "error"; nick: string };

/**
 * Story 3.4 / AD-13: the app screen behind `/u/:nick`. An anonymous visitor
 * goes to login with that validated path as `next`, so signing in comes back
 * here. A signed-in visitor reads through `GET /api/v1/u/:nick`, and only the
 * server decides which wishes this viewer may see.
 *
 * Story 4.1.3 adds the relation actions from the closed `relationship` field of
 * that same answer: one invite button for «нет связи», an accept button for an
 * incoming pending invite, and static chips for pending, friends and the
 * viewer's own profile. Nothing else is drawn.
 *
 * Story 4.2.3 adds the explicit accept/reject pair for an incoming invite and
 * the profile-only `inviteCooldown`: the rejector sees a disabled add button
 * and the remaining hours, the sender sees «Отклонено» and no new invite
 * button. A stale profile can still offer the add button after the server has
 * opened the window: that answer shows the catalogue hours and rereads the
 * profile, so the screen lands on the server's cooldown state. The screen never
 * filters wishes by visibility; the server decides.
 *
 * Story 4.6 adds the one-way subscription switch from the same profile answer:
 * «Подписаться» while `subscribed` is false and «Отписаться» once it is true.
 * The own profile and a friend show no switch; a subscription only opens
 * `PUBLIC`, which the server already filtered.
 */
export default function ProfileScreen() {
  const t = useTranslations("app");
  const profile = useTranslations("app.profile");
  const wishlist = useTranslations("app.wishlist");
  const myWishlist = useTranslations("app.myWishlist");
  const common = useTranslations("common");
  const brand = getBrandName();
  const auth = useAuth();
  // W12.20: the page gutter is the Tamagui media clause
  // `$page-gutter medium:$page-gutter-lg`, so the browser lays it out with a CSS
  // media query and the phone reads the same theme key.
  // W12.23: the column count and the card width (`DESIGN.md` → Layout → columns) are
  // grid math, so on the web they follow the measured content area, not the window:
  // a classic scrollbar makes the window wider than this section by its own width.
  // The profile skeleton and the wish cards share the one measurement, and until it
  // lands the hook keeps the phone's `cardGrid(windowWidth, insets)` numbers.
  // Destructured: React's `refs` lint rule treats an object that holds a ref callback
  // as a ref, and a member read of it during render is an error.
  const { cardWidth, attachContainer } = useCardGrid();
  const params = useLocalSearchParams<{ nick?: string }>();
  const route = profileRoute(paramValue(params.nick));
  const nick = route?.nick ?? null;
  const next = route?.next ?? null;
  const [state, setState] = useState<ScreenState>(
    nick === null ? { status: "missing" } : { status: "loading" },
  );
  const [attempt, setAttempt] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [pendingNick, setPendingNick] = useState<string | null>(null);
  const [subscriptionNick, setSubscriptionNick] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const inviteInFlight = useRef<string | null>(null);
  const subscriptionInFlight = useRef<string | null>(null);
  const subscriptionSeq = useRef(0);
  const nickRef = useRef(nick);

  const ownerId = auth.state.status === "ready" ? auth.state.user.id : null;

  useEffect(function redirectAnonymous() {
    if (auth.state.status === "anonymous" && next !== null) {
      // The login screen owns the «Сессия закончилась» toast: it outlives this screen.
      router.replace({
        pathname: "/login",
        params: sessionExpired ? { next, reason: "session_expired" } : { next },
      });
    }
  }, [auth.state.status, next, sessionExpired]);

  /**
   * The stored session is dead: `signOut` clears the token and marks the app
   * anonymous, and the guard above opens login with the same safe `next`.
   */
  async function expireSession(): Promise<boolean> {
    setSessionExpired(true);
    const signedOut = await auth.signOut();
    if (!signedOut.ok) setSessionExpired(false);
    return signedOut.ok;
  }

  /**
   * A reused route with another nick is a different person: the current nick
   * moves to a ref (for late answers) and the request sequence is invalidated.
   * The optimistic `pendingNick` and the toast are keyed to a nick, so they
   * simply stop matching the new route instead of being reset by an effect.
   */
  useEffect(function rememberRouteNick() {
    nickRef.current = nick;
    requestSeq.current += 1;
    // A subscription answer belongs to the nick it was asked for; the new route
    // must never receive it as its own state.
    subscriptionSeq.current += 1;
  }, [nick]);

  useEffect(function loadProfile() {
    if (ownerId === null || nick === null) return;
    const currentNick = nick;
    let cancelled = false;

    async function requestProfile() {
      const result = await fetchProfile(currentNick);
      if (cancelled) return;
      if (result.ok) {
        setState(
          result.access === "not_found"
            ? { status: "missing" }
            : {
                status: "ready",
                nick: currentNick,
                gifts: result.gifts,
                owner: result.owner,
                relationship: result.relationship,
                inviteCooldown: result.inviteCooldown ?? null,
                subscribed: result.subscribed ?? false,
              },
        );
        return;
      }
      if ("code" in result && result.code === "UNAUTHENTICATED") {
        const signedOut = await expireSession();
        // A failed sign-out leaves the screen mounted: show the retry view, not a skeleton.
        if (!signedOut && !cancelled) {
          setState({ status: "error", kind: "network" });
          setToast({ message: t("form.network"), tone: "error", nick: currentNick });
        }
        return;
      }
      if ("code" in result && result.code === "NOT_FOUND") {
        setState({ status: "missing" });
        return;
      }
      const network = "network" in result;
      setState({ status: "error", kind: network ? "network" : "generic" });
      setToast({
        message: network
          ? t("form.network")
          : "invalid" in result
            ? common("errors.generic")
            : common(`errors.code.${result.code}`),
        tone: "error",
        nick: currentNick,
      });
    }

    void requestProfile();
    return function stopLoad() {
      cancelled = true;
    };
    // `auth` is only read on the expired-session branch; re-running the fetch on
    // every auth context update would refetch the profile for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, nick, attempt]);

  if (nick === null) {
    return <NotFoundScreen />;
  }

  if (auth.state.status === "error") {
    // A failed session read is not a sign-out: offer a retry instead of opening
    // login. A real UNAUTHENTICATED still reaches the anonymous redirect below.
    return <SessionErrorScreen onRetry={auth.retry} />;
  }

  if (auth.state.status !== "ready") return <SessionLoadingScreen />;

  // A reused route with a new nick reads as loading until its own answer lands.
  const view: ScreenState =
    state.status === "ready" && state.nick !== nick ? { status: "loading" } : state;
  const viewer = auth.state.user;

  function retry() {
    setToast(null);
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }

  function dismissToast() {
    setToast(null);
  }

  const ownProfile =
    view.status === "ready" &&
    view.owner.nick.toLowerCase() === viewer.nick.toLowerCase();
  const sending = pendingNick === nick;
  const sendingSubscription = subscriptionNick === nick;

  /**
   * Story 4.1.3 / 4.2.3: one action path for a first invite, an explicit
   * accept and an explicit reject. The optimistic relation is rolled back on
   * every failure, and an answer that belongs to a previous nick or an older
   * press is ignored.
   */
  async function relationshipAction(kind: RelationshipAction) {
    if (nick === null || inviteInFlight.current === nick) return;
    const requestedView = view;
    if (requestedView.status !== "ready") return;

    const requestedNick = nick;
    const previous = {
      relationship: requestedView.relationship,
      inviteCooldown: requestedView.inviteCooldown,
    };
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    inviteInFlight.current = requestedNick;
    setPendingNick(requestedNick);
    setToast(null);

    const optimistic = optimisticRelation(kind);
    setState(function applyOptimistic(current) {
      return current.status === "ready" && current.nick === requestedNick
        ? {
            ...current,
            relationship: optimistic.relationship,
            inviteCooldown: optimistic.inviteCooldown,
          }
        : current;
    });

    // One shared answer for the profile and the search row: outcomes and error
    // codes are read in `requestRelationshipAction`, never in the screen.
    const result = await requestRelationshipAction(kind, requestedNick, {
      relationship: profile,
      common,
    });
    if (seq !== requestSeq.current || nickRef.current !== requestedNick) {
      // The route moved on: drop this answer and release only its own slot.
      if (inviteInFlight.current === requestedNick) inviteInFlight.current = null;
      setPendingNick(function clearStalePending(current) {
        return current === requestedNick ? null : current;
      });
      return;
    }
    if (inviteInFlight.current === requestedNick) inviteInFlight.current = null;
    setPendingNick(function clearPending(current) {
      return current === requestedNick ? null : current;
    });

    function stillThisProfile(current: ScreenState): boolean {
      return current.status === "ready" && current.nick === requestedNick;
    }

    if (result.status === "rejected") {
      setState(function applyRejection(current) {
        return stillThisProfile(current)
          ? { ...current, relationship: "NONE", inviteCooldown: result.inviteCooldown }
          : current;
      });
      // The cooldown hours come only from the server's profile answer.
      setAttempt((value) => value + 1);
      return;
    }

    if (result.status === "friends") {
      setState(function applyFriendship(current) {
        return stillThisProfile(current)
          ? { ...current, relationship: "FRIENDS", inviteCooldown: null }
          : current;
      });
      setToast({
        message: profile("relationship.toast.friends", {
          name: requestedView.owner.displayName,
        }),
        tone: "info",
        nick: requestedNick,
      });
      // FRIENDS wishes only appear when the server says the edge exists.
      setAttempt((value) => value + 1);
      return;
    }

    if (result.status === "pending") {
      setState(function applyPending(current) {
        return stillThisProfile(current)
          ? { ...current, relationship: "OUTGOING_PENDING", inviteCooldown: null }
          : current;
      });
      setToast({
        message: profile("relationship.toast.invited"),
        tone: "info",
        nick: requestedNick,
      });
      return;
    }

    setState(function rollback(current) {
      return stillThisProfile(current)
        ? {
            ...current,
            relationship: previous.relationship,
            inviteCooldown: previous.inviteCooldown,
          }
        : current;
    });

    if (result.status === "expired") {
      const signedOut = await expireSession();
      if (!signedOut) {
        setToast({
          message: profile("relationship.network"),
          tone: "error",
          nick: requestedNick,
        });
      }
      return;
    }
    if (result.status === "missing") {
      setState({ status: "missing" });
      return;
    }
    if (result.status === "cooldown") {
      // The reason alone proves the window even when the hours are malformed;
      // the profile is reread so the rolled-back relationship and the stale
      // cooldown are replaced by the server's answer (hours and `rejected`).
      setToast({ message: result.message, tone: "error", nick: requestedNick });
      setAttempt((value) => value + 1);
      return;
    }
    setToast({ message: result.message, tone: "error", nick: requestedNick });
  }

  /**
   * Story 4.6: one subscription press. The optimistic flag is the requested
   * state; every failure rolls it back, and an answer that belongs to a
   * previous nick or an older press is ignored. The subscription has its own
   * in-flight slot and sequence, so it never cancels a friend action that is
   * still on the wire. The wishlist is not reread: a subscription opens only
   * `PUBLIC`, which the server has already filtered, and the screen must never
   * add `FRIENDS` or `SECRET` wishes on its own.
   */
  async function subscriptionAction(kind: SubscriptionAction) {
    if (nick === null || subscriptionInFlight.current === nick) return;
    const requestedView = view;
    if (requestedView.status !== "ready") return;

    const requestedNick = nick;
    const previous = requestedView.subscribed;
    const desired = kind === "subscribe";
    if (previous === desired) return;

    const seq = subscriptionSeq.current + 1;
    subscriptionSeq.current = seq;
    subscriptionInFlight.current = requestedNick;
    setSubscriptionNick(requestedNick);
    setToast(null);

    setState(function applyOptimisticSubscription(current) {
      return current.status === "ready" && current.nick === requestedNick
        ? { ...current, subscribed: desired }
        : current;
    });

    const result = await requestSubscriptionAction(kind, requestedNick, {
      profile,
      common,
    });
    if (seq !== subscriptionSeq.current || nickRef.current !== requestedNick) {
      // The route moved on: drop this answer and release only its own slot.
      if (subscriptionInFlight.current === requestedNick) subscriptionInFlight.current = null;
      setSubscriptionNick(function clearStaleSubscription(current) {
        return current === requestedNick ? null : current;
      });
      return;
    }
    if (subscriptionInFlight.current === requestedNick) subscriptionInFlight.current = null;
    setSubscriptionNick(function clearSubscription(current) {
      return current === requestedNick ? null : current;
    });

    function stillThisProfile(current: ScreenState): boolean {
      return current.status === "ready" && current.nick === requestedNick;
    }

    if (result.status === "subscribed" || result.status === "unsubscribed") {
      const subscribed = result.status === "subscribed";
      setState(function applySubscriptionAnswer(current) {
        return stillThisProfile(current) ? { ...current, subscribed } : current;
      });
      setToast({
        message: profile(
          result.status === "subscribed"
            ? "subscription.toast.subscribed"
            : "subscription.toast.unsubscribed",
        ),
        tone: "info",
        nick: requestedNick,
      });
      return;
    }

    setState(function rollbackSubscription(current) {
      return stillThisProfile(current) ? { ...current, subscribed: previous } : current;
    });

    if (result.status === "expired") {
      const signedOut = await expireSession();
      if (!signedOut) {
        setToast({
          message: profile("subscription.network"),
          tone: "error",
          nick: requestedNick,
        });
      }
      return;
    }
    if (result.status === "missing") {
      setState({ status: "missing" });
      return;
    }
    setToast({ message: result.message, tone: "error", nick: requestedNick });
  }

  return (
    <Screen>
      <SafeArea>
        <Stack.Screen options={{ title: profile("pageTitle", { brand }) }} />
        <PageScroll testID="profile-page">
          <PageContainer>
            <Column
              size="wide"
              flexGrow={1}
              paddingHorizontal="$page-gutter medium:$page-gutter-lg"
              paddingTop="$page-gutter"
              gap="$2"
            >
              <YStack
                testID="profile-content"
                ref={attachContainer}
                flexGrow={1}
                paddingTop="$2"
                paddingBottom="$section-gap"
                gap="$grid-gap"
              >
                {view.status === "loading" ? (
                  <LoadingCards
                    testID="profile-loading"
                    label={profile("loading")}
                    width={cardWidth}
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
                    testID="profile-not-found"
                    width="100%"
                    paddingVertical="$section-gap"
                  >
                    <Heading level={1} kind="display-sm" textAlign="center">
                      {profile("notFound")}
                    </Heading>
                  </YStack>
                ) : (
                  <>
                    <YStack testID="profile-owner" gap="$1">
                      <Heading level={1} kind="display-sm">
                        {view.owner.displayName}
                      </Heading>
                      <Text kind="caption" tone="muted">
                        {t("form.nickPreview", { nick: view.owner.nick })}
                      </Text>
                    </YStack>
                    <XStack flexWrap="wrap" alignItems="center" gap="$2">
                      <RelationshipActions
                        relationship={view.relationship}
                        inviteCooldown={view.inviteCooldown}
                        ownProfile={ownProfile}
                        busy={sending}
                        onAction={function actOnRelation(kind) {
                          void relationshipAction(kind);
                        }}
                      />
                      {/*
                        Story 4.6: a subscription is independent of the friend
                        action and sits next to it. The own profile and a
                        friendship have no subscription switch: EXPERIENCE says
                        a friend sees more than a subscriber already.
                      */}
                      {!ownProfile && view.relationship !== "FRIENDS" ? (
                        <SubscriptionActions
                          subscribed={view.subscribed}
                          busy={sendingSubscription}
                          onAction={function actOnSubscription(kind) {
                            void subscriptionAction(kind);
                          }}
                        />
                      ) : null}
                    </XStack>
                    {view.gifts.length === 0 ? (
                      <EmptyState title={wishlist("emptyTitle")} />
                    ) : (
                      <XStack role="list" flexWrap="wrap" gap="$grid-gap" alignItems="flex-start">
                        {view.gifts.map(function renderGift(gift) {
                          return (
                            <PublicGiftCard key={gift.id} gift={gift} width={cardWidth} />
                          );
                        })}
                      </XStack>
                    )}
                  </>
                )}
              </YStack>
              <SiteFooter />
            </Column>
          </PageContainer>
        </PageScroll>
        {toast !== null && toast.nick === nick ? (
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

ProfileScreen.displayName = "ProfileScreen";

/** A failed read: one line of text and the retry button. */
function RetryView({ text, label, onPress }: { text: string; label: string; onPress: () => void }) {
  return (
    <YStack
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
