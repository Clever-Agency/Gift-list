import type {
  GiftCard,
  ProfileInviteCooldown,
  ProfileRelationship,
} from "@gift-list/contracts";
import {
  Button,
  Column,
  Heading,
  LoadingCards,
  PageContainer,
  PageScroll,
  RelationshipChip,
  Screen,
  spacing,
  Text,
  XStack,
  YStack,
} from "@gift-list/ui";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import {
  acceptFriendInvite,
  rejectFriendInvite,
  sendFriendInvite,
} from "@/api/friend-invite";
import { fetchProfile, type ProfileOwner } from "@/api/profile";
import { getBrandName } from "@/config/env";
import { profileRoute } from "@/profile/profile-route";
import { useAuth } from "@/session/auth-context";
import { paramValue } from "@/session/return-path";
import { cardGrid, pageGutter } from "@/ui/card-grid";
import { EmptyState } from "@/ui/empty-state";
import { NotFoundScreen } from "@/ui/not-found-screen";
import { PrimaryButton } from "@/ui/primary-button";
import { PublicGiftCard } from "@/ui/public-gift-card";
import { SessionLoadingScreen } from "@/ui/session-loading-screen";
import { ToastHost } from "@/ui/toast";

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
    }
  | { status: "missing" }
  | { status: "error"; kind: "network" | "generic" };

type ToastState = { message: string; tone: "info" | "error"; nick: string };

type RelationshipAction = "add" | "accept" | "reject";

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
 */
export default function ProfileScreen() {
  const t = useTranslations("app");
  const profile = useTranslations("app.profile");
  const wishlist = useTranslations("app.wishlist");
  const myWishlist = useTranslations("app.myWishlist");
  const common = useTranslations("common");
  const brand = getBrandName();
  const auth = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const grid = cardGrid(width, insets);
  const gutter = pageGutter(width);
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
  const requestSeq = useRef(0);
  const inviteInFlight = useRef<string | null>(null);
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

    const optimistic: ProfileRelationship =
      kind === "accept" ? "FRIENDS" : kind === "reject" ? "NONE" : "OUTGOING_PENDING";
    // Reject writes the 24-hour window in the same transaction (AD-10 step 3).
    // The refetch below replaces this estimate with the server's whole hours.
    const optimisticCooldown: ProfileInviteCooldown | null =
      kind === "reject" ? { hours: 24, rejected: false } : null;
    setState(function applyOptimistic(current) {
      return current.status === "ready" && current.nick === requestedNick
        ? { ...current, relationship: optimistic, inviteCooldown: optimisticCooldown }
        : current;
    });

    const result =
      kind === "reject"
        ? await rejectFriendInvite(requestedNick)
        : kind === "accept"
          ? await acceptFriendInvite(requestedNick)
          : await sendFriendInvite(requestedNick);
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

    if (result.ok) {
      if (kind === "reject") {
        setState(function applyRejection(current) {
          return stillThisProfile(current)
            ? { ...current, relationship: "NONE", inviteCooldown: optimisticCooldown }
            : current;
        });
        // The cooldown hours come only from the server's profile answer.
        setAttempt((value) => value + 1);
        return;
      }

      if (result.outcome === "FRIENDS_CREATED" || result.outcome === "ALREADY_FRIENDS") {
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

    if ("network" in result) {
      setToast({
        message: profile("relationship.network"),
        tone: "error",
        nick: requestedNick,
      });
      return;
    }
    if ("invalid" in result) {
      setToast({
        message: common("errors.generic"),
        tone: "error",
        nick: requestedNick,
      });
      return;
    }
    if (result.code === "UNAUTHENTICATED") {
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
    if (result.code === "NOT_FOUND") {
      setState({ status: "missing" });
      return;
    }
    // A stale screen can still offer the button while the server already holds
    // the rejection window. The closed reason carries the remaining hours, so
    // the toast uses the catalogue phrase instead of the generic rate-limit
    // text, and the profile is reread so the rolled-back relationship and the
    // stale cooldown are replaced by the server's answer (hours and `rejected`).
    // A malformed `hours` still rereads: the reason alone proves the window.
    if (result.code === "RATE_LIMITED" && result.reason === "INVITE_COOLDOWN") {
      const hours = result.params?.hours;
      const message =
        typeof hours === "number" && Number.isInteger(hours) && hours >= 1
          ? common("errors.reason.INVITE_COOLDOWN", { hours })
          : common("errors.code.RATE_LIMITED");
      setToast({ message, tone: "error", nick: requestedNick });
      setAttempt((value) => value + 1);
      return;
    }
    setToast({
      message: common(`errors.code.${result.code}`),
      tone: "error",
      nick: requestedNick,
    });
  }

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <Stack.Screen options={{ title: profile("pageTitle", { brand }) }} />
        <PageScroll testID="profile-page">
          <PageContainer>
            <Column
              size="wide"
              flexGrow={1}
              paddingHorizontal={gutter}
              paddingTop="$page-gutter"
              gap="$2"
            >
              <YStack
                flexGrow={1}
                paddingTop={spacing["grid-gap"] / 2}
                paddingBottom={spacing["section-gap"]}
                gap={spacing["grid-gap"]}
              >
                {view.status === "loading" ? (
                  <LoadingCards
                    testID="profile-loading"
                    label={profile("loading")}
                    width={grid.cardWidth}
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
                    paddingVertical={spacing["section-gap"]}
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
                    <XStack
                      testID="profile-relationship"
                      alignItems="center"
                      flexWrap="wrap"
                      gap="$2"
                    >
                      {ownProfile ? (
                        <RelationshipChip
                          label={profile("relationship.chips.SELF")}
                          testID="profile-relationship-chip"
                        />
                      ) : view.inviteCooldown !== null ? (
                        view.inviteCooldown.rejected ? (
                          <RelationshipChip
                            label={profile("relationship.chips.REJECTED")}
                            testID="profile-relationship-chip"
                          />
                        ) : (
                          <>
                            <Button
                              label={profile("relationship.addFriend")}
                              disabled
                              focusableWhenDisabled
                              testID="profile-add-friend"
                            />
                            <Text kind="caption" tone="muted" testID="profile-invite-cooldown">
                              {profile("relationship.cooldown", {
                                hours: view.inviteCooldown.hours,
                              })}
                            </Text>
                          </>
                        )
                      ) : view.relationship === "FRIENDS" ? (
                        <RelationshipChip
                          label={profile("relationship.chips.FRIENDS")}
                          testID="profile-relationship-chip"
                        />
                      ) : view.relationship === "OUTGOING_PENDING" ? (
                        <RelationshipChip
                          label={profile("relationship.chips.OUTGOING_PENDING")}
                          testID="profile-relationship-chip"
                        />
                      ) : view.relationship === "INCOMING_PENDING" ? (
                        <>
                          <RelationshipChip
                            label={profile("relationship.chips.INCOMING_PENDING")}
                            emphasis
                            testID="profile-relationship-chip"
                          />
                          <Button
                            label={profile("relationship.acceptInvite")}
                            onPress={function acceptInvite() {
                              void relationshipAction("accept");
                            }}
                            busy={sending}
                            testID="profile-accept-invite"
                          />
                          <Button
                            label={profile("relationship.rejectInvite")}
                            variant="ghost"
                            onPress={function rejectInvite() {
                              void relationshipAction("reject");
                            }}
                            busy={sending}
                            testID="profile-reject-invite"
                          />
                        </>
                      ) : (
                        <Button
                          label={profile("relationship.addFriend")}
                          onPress={function addFriend() {
                            void relationshipAction("add");
                          }}
                          busy={sending}
                          testID="profile-add-friend"
                        />
                      )}
                    </XStack>
                    {view.gifts.length === 0 ? (
                      <EmptyState title={wishlist("emptyTitle")} />
                    ) : (
                      <XStack role="list" flexWrap="wrap" gap="$grid-gap" alignItems="flex-start">
                        {view.gifts.map(function renderGift(gift) {
                          return (
                            <PublicGiftCard key={gift.id} gift={gift} width={grid.cardWidth} />
                          );
                        })}
                      </XStack>
                    )}
                  </>
                )}
              </YStack>
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
      </SafeAreaView>
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
      paddingVertical={spacing["section-gap"] / 2}
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
