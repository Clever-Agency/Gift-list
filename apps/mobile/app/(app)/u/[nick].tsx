import {
  isValidBirthDate,
  type GiftCard,
  type ProfileDetails,
  type ProfileInviteCooldown,
  type ProfileRelationship,
} from "@gift-list/contracts";
import {
  Avatar,
  Button,
  Column,
  Heading,
  LinkText,
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
import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { fetchProfile, type ProfileOwner } from "@/api/profile";
import { getBrandName } from "@/config/env";
import { requestBlock } from "@/profile/block-action";
import { BlockConfirm } from "@/profile/block-confirm";
import {
  optimisticRelation,
  requestFriendRemoval,
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
import { CardGridList } from "@/ui/card-grid-list";
import { ClosedSection } from "@/ui/closed-section";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { EmptyState } from "@/ui/empty-state";
import { NotFoundScreen } from "@/ui/not-found-screen";
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
      /**
       * CLE-129/T8.4 (AD-7, AD-29): the profile fields the server allowed this
       * viewer. `null` is a hidden block — the screen renders nothing of it.
       */
      details: ProfileDetails | null;
    }
  | { status: "missing"; nick: string | null; viewerId: string | null }
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
 *
 * Story 4.4 adds «Удалить из друзей» next to the «Друзья» chip with the same
 * confirm as the friends list. The optimistically former friend loses the
 * `FRIENDS` wishes at once; a success rereads the profile and leaves the route
 * open, because the person still exists and keeps their `PUBLIC` wishes.
 *
 * Story 4.5 adds «Заблокировать» next to the other buttons. The confirm names
 * the person, and a success leaves the route once its toast has been read: after
 * a block the profile is `not_found` for both sides (AD-7).
 *
 * CLE-129/T8.4 adds the header of the opened profile: the initials circle, the
 * name and the nick, then the optional `details` block (a birthday without a
 * year, gender, country and «Обо мне») that the server sends only to the owner
 * and to a friend of an owner who opened the switch. The screen draws only that
 * block and never restores a hidden field; the own profile reads the same and
 * carries one extra «Изменить» link to `/profile`.
 */
export default function ProfileScreen() {
  const t = useTranslations("app");
  const profile = useTranslations("app.profile");
  const friends = useTranslations("app.friends");
  const wishlist = useTranslations("app.wishlist");
  const myWishlist = useTranslations("app.myWishlist");
  const closedCopy = useTranslations("app.gift.closed");
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
    nick === null ? { status: "missing", nick, viewerId: null } : { status: "loading" },
  );
  const [attempt, setAttempt] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [pendingNick, setPendingNick] = useState<string | null>(null);
  const [subscriptionNick, setSubscriptionNick] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const inviteInFlight = useRef<string | null>(null);
  const subscriptionInFlight = useRef<string | null>(null);
  const removalInFlight = useRef<string | null>(null);
  const subscriptionSeq = useRef(0);
  const nickRef = useRef(nick);
  const completedRead = useRef<{ ownerId: string; nick: string; attempt: number } | null>(null);
  // Story 4.4: the confirm of «Удалить из друзей» and its in-flight state.
  const [friendConfirmOpen, setFriendConfirmOpen] = useState(false);
  const [friendConfirmBusy, setFriendConfirmBusy] = useState(false);
  // Story 4.5: the confirm of «Заблокировать»; a success leaves this route.
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [blockConfirmBusy, setBlockConfirmBusy] = useState(false);
  const blockInFlight = useRef<string | null>(null);
  const [leaveAfterBlock, setLeaveAfterBlock] = useState(false);
  // Story 5.3: «Уже подарено» is closed until the visitor opens it.
  const [closedExpanded, setClosedExpanded] = useState(false);

  const ownerId = auth.state.status === "ready" ? auth.state.user.id : null;
  const showingCurrentProfile = state.status === "ready" && state.nick === nick;
  // Read one coherent profile after its access-changing actions settle.
  const profileReadPaused =
    (nick !== null && (pendingNick === nick || subscriptionNick === nick)) ||
    (showingCurrentProfile && (friendConfirmBusy || blockConfirmBusy || leaveAfterBlock)) ||
    (state.status === "missing" && state.nick === nick && state.viewerId === ownerId);

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
    completedRead.current = null;
    requestSeq.current += 1;
    // A subscription answer belongs to the nick it was asked for; the new route
    // must never receive it as its own state.
    subscriptionSeq.current += 1;
  }, [nick]);

  useEffect(function loadProfile() {
    if (ownerId === null || nick === null || profileReadPaused) return;
    const previousRead = completedRead.current;
    if (
      previousRead?.ownerId === ownerId &&
      previousRead.nick === nick &&
      previousRead.attempt === attempt
    ) {
      return;
    }
    const read = { ownerId, nick, attempt };
    const currentNick = nick;
    let cancelled = false;

    async function requestProfile() {
      const result = await fetchProfile(currentNick);
      if (cancelled) return;
      completedRead.current = read;
      if (result.ok) {
        setState(
          result.access === "not_found"
            ? { status: "missing", nick: currentNick, viewerId: ownerId }
            : {
                status: "ready",
                nick: currentNick,
                gifts: result.gifts,
                owner: result.owner,
                relationship: result.relationship,
                inviteCooldown: result.inviteCooldown ?? null,
                subscribed: result.subscribed ?? false,
                details: result.details ?? null,
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
  }, [ownerId, nick, attempt, profileReadPaused]);

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
    ((state.status === "ready" || state.status === "missing") && state.nick !== nick) ||
    (state.status === "missing" && state.viewerId !== ownerId)
      ? { status: "loading" }
      : state;
  const viewer = auth.state.user;
  // Story 5.3: the profile reads the same one list; closed wishes are shown in
  // «Уже подарено» without actions. `/u/:nick` cards never carry `undoUntil`, so
  // the owner's window and its actions stay on «Мой вишлист».
  const allGifts = view.status === "ready" ? view.gifts : [];
  const activeGifts = allGifts.filter(function notClosed(gift) {
    return gift.status !== "CLOSED";
  });
  const closedGifts = allGifts.filter(function onlyClosed(gift) {
    return gift.status === "CLOSED" && gift.archivedAt === null;
  });

  function retry() {
    setToast(null);
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }

  function dismissToast() {
    setToast(null);
    // Story 4.5: a block notice cannot outlive this route — the app has no
    // global toast host — so the leaving waits for the toast instead of
    // dropping it. Any other toast just closes.
    if (!leaveAfterBlock) return;
    setLeaveAfterBlock(false);
    if (router.canGoBack()) router.back();
    else router.replace("/friends");
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
      setState({ status: "missing", nick: requestedNick, viewerId: viewer.id });
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
   * still on the wire. A success rereads the profile so the server applies
   * the new visibility to the wishlist.
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
      setAttempt((value) => value + 1);
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
      setState({ status: "missing", nick: requestedNick, viewerId: viewer.id });
      return;
    }
    setToast({ message: result.message, tone: "error", nick: requestedNick });
  }

  /**
   * Story 4.4: the confirm of «Удалить из друзей» on the profile. The optimistic
   * relation is `NONE`, so the «Друзья» chip becomes the actions of a former
   * friend, and the wishes only a friend sees leave at once (`EXPERIENCE.md` →
   * «Друзья»); the subscription edge is untouched. A success rereads the profile
   * so the wishlist and the relation come from the server, and every failure
   * rolls the optimistic state back. The route stays open in both cases.
   */
  async function removeFriendAction() {
    if (nick === null || removalInFlight.current === nick) return;
    const requestedView = view;
    if (requestedView.status !== "ready" || requestedView.relationship !== "FRIENDS") return;

    const requestedNick = nick;
    const previous = {
      relationship: requestedView.relationship,
      inviteCooldown: requestedView.inviteCooldown,
      gifts: requestedView.gifts,
      details: requestedView.details,
    };
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    removalInFlight.current = requestedNick;
    setToast(null);

    setState(function applyOptimisticRemoval(current) {
      return current.status === "ready" && current.nick === requestedNick
        ? {
            ...current,
            relationship: "NONE",
            inviteCooldown: null,
            // A friend may see `FRIENDS`; `SECRET` never arrives from the server,
            // but the rule stays closed: only `PUBLIC` survives the removal.
            gifts: current.gifts.filter((gift) => gift.visibility === "PUBLIC"),
            details: null,
          }
        : current;
    });

    const result = await requestFriendRemoval(requestedNick, { relationship: profile, common });
    if (seq !== requestSeq.current || nickRef.current !== requestedNick) {
      // The route moved on: drop this answer and release only its own slot.
      if (removalInFlight.current === requestedNick) removalInFlight.current = null;
      return;
    }
    if (removalInFlight.current === requestedNick) removalInFlight.current = null;

    function stillThisProfile(current: ScreenState): boolean {
      return current.status === "ready" && current.nick === requestedNick;
    }

    if (result.status === "removed") {
      setFriendConfirmOpen(false);
      setToast({
        message: friends("toast.friendRemoved", { name: requestedView.owner.displayName }),
        tone: "info",
        nick: requestedNick,
      });
      // The server owns the wishlist and the relation: read them back.
      setAttempt((value) => value + 1);
      return;
    }

    setState(function rollbackRemoval(current) {
      return stillThisProfile(current)
        ? {
            ...current,
            relationship: previous.relationship,
            inviteCooldown: previous.inviteCooldown,
            gifts: previous.gifts,
            details: previous.details,
          }
        : current;
    });
    setFriendConfirmOpen(false);

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
      setState({ status: "missing", nick: requestedNick, viewerId: viewer.id });
      return;
    }
    setToast({ message: result.message, tone: "error", nick: requestedNick });
  }

  function confirmFriendRemoval() {
    if (friendConfirmBusy) return;
    setFriendConfirmBusy(true);
    void removeFriendAction().finally(function release() {
      setFriendConfirmBusy(false);
    });
  }

  function cancelFriendRemoval() {
    if (friendConfirmBusy) return;
    setFriendConfirmOpen(false);
  }

  function askRemoveFriend() {
    setToast(null);
    setFriendConfirmOpen(true);
  }

  /**
   * Story 4.5 (FR-24, AD-10 step 4): a block cuts the friendship and both
   * subscriptions of the pair and hides each of them from the other (AD-7), so
   * the profile stops existing for this viewer: after the toast it leaves back
   * (or to `/friends` when the route was opened directly). There is no
   * optimistic state to roll back — nothing on this screen survives the press.
   */
  async function blockAction() {
    if (nick === null || blockInFlight.current === nick) return;
    const requestedView = view;
    if (requestedView.status !== "ready") return;

    const requestedNick = nick;
    blockInFlight.current = requestedNick;
    setToast(null);

    const result = await requestBlock(requestedNick, { profile, common });
    if (blockInFlight.current === requestedNick) blockInFlight.current = null;
    if (nickRef.current !== requestedNick) return;

    setBlockConfirmOpen(false);
    if (result.status === "blocked") {
      // `BLOCKED` and the idempotent `ALREADY_BLOCKED` are both successes.
      setToast({
        message: friends("toast.blocked", { name: requestedView.owner.displayName }),
        tone: "info",
        nick: requestedNick,
      });
      setLeaveAfterBlock(true);
      return;
    }
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
      setState({ status: "missing", nick: requestedNick, viewerId: viewer.id });
      return;
    }
    setToast({ message: result.message, tone: "error", nick: requestedNick });
  }

  function confirmBlock() {
    if (blockConfirmBusy) return;
    setBlockConfirmBusy(true);
    void blockAction().finally(function release() {
      setBlockConfirmBusy(false);
    });
  }

  function cancelBlock() {
    if (blockConfirmBusy) return;
    setBlockConfirmOpen(false);
  }

  function askBlock() {
    setToast(null);
    setBlockConfirmOpen(true);
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
                    <XStack testID="profile-owner" gap="$3" alignItems="center" width="100%">
                      <Avatar
                        name={view.owner.displayName}
                        size="lg"
                        decorative
                        testID="profile-avatar"
                      />
                      <YStack flex={1} minWidth={0} gap="$1">
                        <Heading level={1} kind="display-sm">
                          {view.owner.displayName}
                        </Heading>
                        <Text kind="caption" tone="muted">
                          {t("form.nickPreview", { nick: view.owner.nick })}
                        </Text>
                      </YStack>
                      {ownProfile ? (
                        <Link href="/profile" asChild>
                          <LinkText
                            render="a"
                            role="link"
                            aria-label={profile("editLabel")}
                            testID="profile-edit"
                          >
                            {profile("edit")}
                          </LinkText>
                        </Link>
                      ) : null}
                    </XStack>
                    {view.details !== null ? (
                      <ProfileDetailsBlock details={view.details} />
                    ) : null}
                    <XStack flexWrap="wrap" alignItems="center" gap="$2">
                      <RelationshipActions
                        relationship={view.relationship}
                        inviteCooldown={view.inviteCooldown}
                        ownProfile={ownProfile}
                        busy={sending}
                        onAction={function actOnRelation(kind) {
                          void relationshipAction(kind);
                        }}
                        onRemoveFriend={ownProfile ? undefined : askRemoveFriend}
                        onBlock={ownProfile ? undefined : askBlock}
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
                    {allGifts.length === 0 ? (
                      <EmptyState title={wishlist("emptyTitle")} />
                    ) : (
                      <>
                        {activeGifts.length > 0 ? (
                          <CardGridList alignStart>
                            {activeGifts.map(function renderGift(gift) {
                              return (
                                <PublicGiftCard
                                  key={gift.id}
                                  gift={gift}
                                  width={cardWidth}
                                />
                              );
                            })}
                          </CardGridList>
                        ) : null}
                        {closedGifts.length > 0 ? (
                          <ClosedSection
                            label={closedCopy("sectionViewer")}
                            expanded={closedExpanded}
                            onToggle={function toggleClosed() {
                              setClosedExpanded((open) => !open);
                            }}
                            testID="profile-closed"
                            toggleTestID="profile-closed-toggle"
                          >
                            {closedGifts.map(function renderClosed(gift) {
                              return (
                                <PublicGiftCard
                                  key={gift.id}
                                  gift={gift}
                                  width={cardWidth}
                                />
                              );
                            })}
                          </ClosedSection>
                        ) : null}
                      </>
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
        <ConfirmDialog
          variant="confirm"
          visible={friendConfirmOpen}
          title={friends("removeFriend.title", {
            name: view.status === "ready" ? view.owner.displayName : "",
          })}
          body={friends("removeFriend.body")}
          confirmLabel={friends("removeFriend.confirm")}
          cancelLabel={friends("removeFriend.cancel")}
          busy={friendConfirmBusy}
          onConfirm={confirmFriendRemoval}
          onCancel={cancelFriendRemoval}
          onClosed={function friendConfirmClosed() {
            setFriendConfirmBusy(false);
          }}
        />
        <BlockConfirm
          name={
            blockConfirmOpen && view.status === "ready" ? view.owner.displayName : null
          }
          busy={blockConfirmBusy}
          onConfirm={confirmBlock}
          onCancel={cancelBlock}
          onClosed={function blockClosed() {
            setBlockConfirmBusy(false);
          }}
        />
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
      <Button label={label} onPress={onPress} />
    </YStack>
  );
}

RetryView.displayName = "RetryView";

/**
 * «12 марта»: the day and the month of the interface locale, never a year — the
 * profile stores no year (AD-23, AD-29). The year 2000 only stands in for `Intl`,
 * which cannot format a day and a month without one; it is never displayed.
 */
function birthdayText(day: number, month: number, locale: string): string {
  const format = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" });
  return format.format(new Date(Date.UTC(2000, month - 1, day)));
}

/**
 * The country name in the reader's language from the built-in `Intl.DisplayNames`
 * (D-64.3); the stored value stays the ISO code and an unknown one falls back to
 * itself, so nothing ever throws on a value the list did not cover.
 */
function countryText(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** One line of the details block: the label and the value next to it. */
function DetailRow({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <XStack testID={testID} gap="$2" alignItems="baseline" flexWrap="wrap">
      <Text kind="caption" tone="muted">
        {label}
      </Text>
      <Text>{value}</Text>
    </XStack>
  );
}

DetailRow.displayName = "DetailRow";

/**
 * CLE-129/T8.4 (AD-7 ред. 2026-11-26, AD-29): the profile fields the server sent
 * in the optional `details` block. Only those five fields are drawn, and only the
 * non-empty ones: a profile with nothing filled in shows no block at all, so a
 * stranger cannot tell that the fields exist. «Обо мне» is plain text — React
 * escapes it, and its line breaks stay as written.
 */
function ProfileDetailsBlock({ details }: { details: ProfileDetails }) {
  const profile = useTranslations("app.profile");
  const locale = useLocale();

  const birthday =
    details.birthDay !== null &&
    details.birthMonth !== null &&
    isValidBirthDate(details.birthDay, details.birthMonth)
      ? birthdayText(details.birthDay, details.birthMonth, locale)
      : null;
  const gender =
    details.gender === null
      ? null
      : profile(details.gender === "MALE" ? "genderMale" : "genderFemale");
  const country =
    details.country === null ? null : countryText(details.country, locale);
  const about = details.about === null ? null : details.about.trim();

  if (birthday === null && gender === null && country === null && about === null) {
    return null;
  }

  return (
    <YStack
      testID="profile-details"
      width="100%"
      maxWidth="$max-content"
      gap="$2"
      padding="$3"
      borderWidth={1}
      borderColor="$border"
      borderRadius="$md"
      backgroundColor="$surface"
    >
      {birthday !== null ? (
        <DetailRow label={profile("birthday")} value={birthday} testID="profile-birthday" />
      ) : null}
      {gender !== null ? (
        <DetailRow label={profile("gender")} value={gender} testID="profile-gender" />
      ) : null}
      {country !== null ? (
        <DetailRow label={profile("country")} value={country} testID="profile-country" />
      ) : null}
      {about !== null && about !== "" ? (
        <YStack testID="profile-about" gap="$1">
          <Text kind="caption" tone="muted">
            {profile("about")}
          </Text>
          <Text>{about}</Text>
        </YStack>
      ) : null}
    </YStack>
  );
}

ProfileDetailsBlock.displayName = "ProfileDetailsBlock";
