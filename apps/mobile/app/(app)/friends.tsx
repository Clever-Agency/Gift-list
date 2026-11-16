import type { CircleCard, Me } from "@gift-list/contracts";
import {
  Button,
  Column,
  EmptyState,
  Heading,
  OverflowMenu,
  PageContainer,
  PageScroll,
  PersonRow,
  PersonRowSkeleton,
  Pressable,
  RelationshipChip,
  SafeArea,
  Screen,
  SearchField,
  SegmentTabs,
  Text,
  View,
  XStack,
  YStack,
  restoreFocus,
  type FocusTarget,
  type OverflowMenuItem,
} from "@gift-list/ui";
import { Link, router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import type { ClientResult } from "@/api/client";
import {
  cancelFriendInvite,
  fetchFriends,
  fetchInvites,
  fetchSubscribers,
  fetchSubscriptions,
  removeFriend,
  removeSubscriber,
} from "@/api/circle";
import { acceptFriendInvite, rejectFriendInvite, sendFriendInvite } from "@/api/friend-invite";
import { subscribeToNick, unsubscribeFromNick } from "@/api/subscription";
import { getBrandName } from "@/config/env";
import { appendCirclePage, focusNeighbour, isNearListEnd } from "@/friends/circle-list";
import {
  DEFAULT_SUBSCRIPTION_VIEW,
  type SubscriptionView,
} from "@/friends/subscription-view.types";
import { readSubscriptionView, writeSubscriptionView } from "@/friends/subscription-view";
import { profileRoute } from "@/profile/profile-route";
import { prepareUserSearchQuery } from "@/search/search-query";
import { useAuth } from "@/session/auth-context";
import { mutationErrorMessage } from "@/session/form-issue";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { PrimaryButton } from "@/ui/primary-button";
import { SessionErrorScreen } from "@/ui/session-error-screen";
import { SessionLoadingScreen } from "@/ui/session-loading-screen";
import { SiteFooter } from "@/ui/site-footer";
import { ToastHost } from "@/ui/toast";

/** One toast at a time, like the search and settings screens. */
type ToastState = { message: string; tone: "info" | "error" };

/** The three segments of `EXPERIENCE.md` → IA «Друзья». */
type TabKey = "friends" | "subscriptions" | "requests";

/** One paged list: rows, the full count and the cursor of the next page. */
type PageState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; kind: "network" | "generic" }
  | {
      status: "ready";
      items: CircleCard[];
      total: number;
      nextCursor: string | null;
      loadingMore: boolean;
    };

/** Both halves of «Запросы» and the incoming badge count (AD-10). */
type InvitesState =
  | { status: "loading" }
  | { status: "error"; kind: "network" | "generic" }
  | {
      status: "ready";
      incoming: CircleCard[];
      outgoing: CircleCard[];
      incomingCount: number;
      incomingCursor: string | null;
      outgoingCursor: string | null;
      loadingMore: boolean;
    };

/** One constant for the whole screen; the documents name no other value. */
const SEARCH_DEBOUNCE_MS = 300;

/** A failed read or action: the transport, the envelope or a broken contract. */
type FailedRequest =
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * «Друзья» (Story 4.3, EXPERIENCE «Друзья»): the session gate is the same as on
 * search and settings. An anonymous visitor leaves for login with a return here;
 * the lists start only after `/me` answers, so the screen never reads as a
 * stranger.
 */
export default function FriendsScreen() {
  const auth = useAuth();
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(
    function redirectAnonymous() {
      if (auth.state.status === "anonymous") {
        // The login screen owns the «Сессия закончилась» toast: it outlives this screen.
        router.replace({
          pathname: "/login",
          params: sessionExpired
            ? { next: "/friends", reason: "session_expired" }
            : { next: "/friends" },
        });
      }
    },
    [auth.state.status, sessionExpired],
  );

  function handleSessionExpired(expired: boolean) {
    setSessionExpired(expired);
  }

  if (auth.state.status === "error") {
    return <SessionErrorScreen onRetry={auth.retry} />;
  }

  if (auth.state.status !== "ready") return <SessionLoadingScreen />;

  return <FriendsContent user={auth.state.user} onSessionExpired={handleSessionExpired} />;
}

FriendsScreen.displayName = "FriendsScreen";

function FriendsContent({
  user,
  onSessionExpired,
}: {
  user: Me;
  onSessionExpired: (expired: boolean) => void;
}) {
  const app = useTranslations("app");
  const friends = useTranslations("app.friends");
  const profile = useTranslations("app.profile");
  const common = useTranslations("common");
  const brand = getBrandName();
  const auth = useAuth();

  const [tab, setTab] = useState<TabKey>("friends");
  const [toast, setToast] = useState<ToastState | null>(null);

  // Friends: the pinned search field, its debounced answer and the pages.
  const [query, setQuery] = useState("");
  const [friendsList, setFriendsList] = useState<PageState>({ status: "loading" });
  const friendsRequest = useRef(0);

  // Subscriptions: two lists, each with its own count and cursor.
  const [subscriptionView, setSubscriptionView] =
    useState<SubscriptionView>(DEFAULT_SUBSCRIPTION_VIEW);
  const [subscribedList, setSubscribedList] = useState<PageState>({ status: "idle" });
  const [subscribersList, setSubscribersList] = useState<PageState>({ status: "idle" });
  const subscribedRequest = useRef(0);
  const subscribersRequest = useRef(0);

  // Requests: both pending halves and the badge count.
  const [invites, setInvites] = useState<InvitesState>({ status: "loading" });
  const invitesRequest = useRef(0);

  // One action at a time across every list: a second row cannot start a request
  // while the first answer is still missing.
  const [pendingNick, setPendingNick] = useState<string | null>(null);
  const inFlight = useRef<string | null>(null);

  // The subscriber confirm (`EXPERIENCE.md` → правила confirm).
  const [subscriberConfirm, setSubscriberConfirm] = useState<CircleCard | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  // Story 4.4: «Удалить из друзей» has its own confirm, next to the subscriber one.
  const [friendConfirm, setFriendConfirm] = useState<CircleCard | null>(null);
  const [friendConfirmBusy, setFriendConfirmBusy] = useState(false);

  // Focus: the ⋯ of each row, so an action can put focus back; the page title is
  // the last resort of «Куда уходит фокус».
  const menuNodes = useRef(new Map<string, FocusTarget | null>());
  const headingNode = useRef<FocusTarget | null>(null);

  const prepared = prepareUserSearchQuery(query);

  /**
   * The stored session is dead: `signOut` clears the token and marks the app
   * anonymous, and the guard above opens login with the reason. A failed
   * sign-out leaves the screen mounted and returns `false`.
   */
  async function expireSession(): Promise<boolean> {
    onSessionExpired(true);
    const signedOut = await auth.signOut();
    if (!signedOut.ok) {
      onSessionExpired(false);
      setToast({ message: app("form.network"), tone: "error" });
    }
    return signedOut.ok;
  }

  /** A failed mutation: its catalog sentence, or the expired session it found. */
  async function reportFailure(result: FailedRequest) {
    if ("network" in result) {
      setToast({ message: profile("subscription.network"), tone: "error" });
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
    setToast({ message: mutationErrorMessage(result, common), tone: "error" });
  }

  /** `GET /me/friends` with the current query; only the newest answer lands. */
  async function loadFriends(value: string, id: number) {
    const result = await fetchFriends(value);
    if (id !== friendsRequest.current) return;

    if (result.ok) {
      setFriendsList({
        status: "ready",
        items: result.page.items,
        total: result.page.total,
        nextCursor: result.page.nextCursor,
        loadingMore: false,
      });
      return;
    }
    if ("code" in result && result.code === "UNAUTHENTICATED") {
      await expireSession();
      return;
    }
    setFriendsList({
      status: "error",
      kind: "network" in result ? "network" : "generic",
    });
  }

  useEffect(
    function loadFriendsOnQuery() {
      const id = ++friendsRequest.current;
      if (prepared === "") {
        // The whole circle is the first thing the tab shows; no pause for it.
        void loadFriends("", id);
        return;
      }

      const timer = setTimeout(function requestAfterPause() {
        void loadFriends(prepared, id);
      }, SEARCH_DEBOUNCE_MS);

      return function cancelQuery() {
        clearTimeout(timer);
        friendsRequest.current += 1;
      };
      // The request helper reads the latest auth callbacks; the normalized query
      // is the only trigger, like the search screen.
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prepared],
  );

  /** `GET /me/invites`: both halves and the incoming badge count. */
  async function loadInvites(id: number) {
    const result = await fetchInvites();
    if (id !== invitesRequest.current) return;

    if (result.ok) {
      setInvites({
        status: "ready",
        incoming: result.invites.incoming.items,
        outgoing: result.invites.outgoing.items,
        incomingCount: result.invites.incomingCount,
        incomingCursor: result.invites.incoming.nextCursor,
        outgoingCursor: result.invites.outgoing.nextCursor,
        loadingMore: false,
      });
      return;
    }
    if ("code" in result && result.code === "UNAUTHENTICATED") {
      await expireSession();
      return;
    }
    setInvites({ status: "error", kind: "network" in result ? "network" : "generic" });
  }

  useEffect(
    function loadInvitesOnMount() {
      const id = ++invitesRequest.current;
      void loadInvites(id);
      // The mount read is the badge and the incoming count; a tab switch does not
      // repeat it, and the retry button owns a second attempt.
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** `GET /me/subscriptions` and `/me/subscribers`: each list on its own. */
  async function loadSubscribed(id: number) {
    const result = await fetchSubscriptions();
    if (id !== subscribedRequest.current) return;

    if (result.ok) {
      setSubscribedList({
        status: "ready",
        items: result.page.items,
        total: result.page.total,
        nextCursor: result.page.nextCursor,
        loadingMore: false,
      });
      return;
    }
    if ("code" in result && result.code === "UNAUTHENTICATED") {
      await expireSession();
      return;
    }
    setSubscribedList({ status: "error", kind: "network" in result ? "network" : "generic" });
  }

  async function loadSubscribers(id: number) {
    const result = await fetchSubscribers();
    if (id !== subscribersRequest.current) return;

    if (result.ok) {
      setSubscribersList({
        status: "ready",
        items: result.page.items,
        total: result.page.total,
        nextCursor: result.page.nextCursor,
        loadingMore: false,
      });
      return;
    }
    if ("code" in result && result.code === "UNAUTHENTICATED") {
      await expireSession();
      return;
    }
    setSubscribersList({ status: "error", kind: "network" in result ? "network" : "generic" });
  }

  // The switch is remembered per person: a device shared by two accounts does not
  // hand one of them the other's choice.
  useEffect(
    function restoreSubscriptionView() {
      let live = true;
      void readSubscriptionView(user.nick).then(function applyStoredView(stored) {
        if (live && stored !== null) setSubscriptionView(stored);
      });
      return function stopRestore() {
        live = false;
      };
    },
    [user.nick],
  );

  // The two subscription lists load together on the first visit: both segment
  // labels carry their full counts (`EXPERIENCE.md` → Followers). An `idle` half
  // renders as skeletons, so the effect only starts the reads.
  useEffect(
    function loadSubscriptionLists() {
      if (tab !== "subscriptions") return;
      if (subscribedList.status === "idle") {
        void loadSubscribed(++subscribedRequest.current);
      }
      if (subscribersList.status === "idle") {
        void loadSubscribers(++subscribersRequest.current);
      }
      // The request helpers read the latest auth callbacks; the tab and the idle
      // halves are the triggers.
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tab, subscribedList.status, subscribersList.status],
  );

  function changeTab(next: TabKey) {
    setTab(next);
  }

  function changeQuery(value: string) {
    // The field answers with skeletons while the pause runs, like the search
    // screen; whitespace around the same query is not a new search.
    if (prepareUserSearchQuery(value) !== prepared) setFriendsList({ status: "loading" });
    setQuery(value);
  }

  function retryFriends() {
    setFriendsList({ status: "loading" });
    void loadFriends(prepared, ++friendsRequest.current);
  }

  function retryInvites() {
    setInvites({ status: "loading" });
    void loadInvites(++invitesRequest.current);
  }

  function retrySubscribed() {
    setSubscribedList({ status: "loading" });
    void loadSubscribed(++subscribedRequest.current);
  }

  function retrySubscribers() {
    setSubscribersList({ status: "loading" });
    void loadSubscribers(++subscribersRequest.current);
  }

  /** The next page of the friends list; the server owns the order and the cursor. */
  async function loadMoreFriends() {
    if (friendsList.status !== "ready") return;
    if (friendsList.nextCursor === null || friendsList.loadingMore) return;
    const id = friendsRequest.current;
    const cursor = friendsList.nextCursor;
    setFriendsList({ ...friendsList, loadingMore: true });
    const result = await fetchFriends(prepared, cursor);
    if (id !== friendsRequest.current) return;

    if (result.ok) {
      setFriendsList(function applyNextPage(current) {
        if (current.status !== "ready") return current;
        return {
          ...current,
          items: appendCirclePage(current.items, result.page.items),
          total: result.page.total,
          nextCursor: result.page.nextCursor,
          loadingMore: false,
        };
      });
      return;
    }
    if ("code" in result && result.code === "UNAUTHENTICATED") {
      await expireSession();
      return;
    }
    setFriendsList(function stopSpinner(current) {
      return current.status === "ready" ? { ...current, loadingMore: false } : current;
    });
    await reportFailure(result);
  }

  async function loadMoreSubscribed() {
    if (subscribedList.status !== "ready") return;
    if (subscribedList.nextCursor === null || subscribedList.loadingMore) return;
    const id = subscribedRequest.current;
    const cursor = subscribedList.nextCursor;
    setSubscribedList({ ...subscribedList, loadingMore: true });
    const result = await fetchSubscriptions(cursor);
    if (id !== subscribedRequest.current) return;

    if (result.ok) {
      setSubscribedList(function applyNextPage(current) {
        if (current.status !== "ready") return current;
        return {
          ...current,
          items: appendCirclePage(current.items, result.page.items),
          total: result.page.total,
          nextCursor: result.page.nextCursor,
          loadingMore: false,
        };
      });
      return;
    }
    if ("code" in result && result.code === "UNAUTHENTICATED") {
      await expireSession();
      return;
    }
    setSubscribedList(function stopSpinner(current) {
      return current.status === "ready" ? { ...current, loadingMore: false } : current;
    });
    await reportFailure(result);
  }

  async function loadMoreSubscribers() {
    if (subscribersList.status !== "ready") return;
    if (subscribersList.nextCursor === null || subscribersList.loadingMore) return;
    const id = subscribersRequest.current;
    const cursor = subscribersList.nextCursor;
    setSubscribersList({ ...subscribersList, loadingMore: true });
    const result = await fetchSubscribers(cursor);
    if (id !== subscribersRequest.current) return;

    if (result.ok) {
      setSubscribersList(function applyNextPage(current) {
        if (current.status !== "ready") return current;
        return {
          ...current,
          items: appendCirclePage(current.items, result.page.items),
          total: result.page.total,
          nextCursor: result.page.nextCursor,
          loadingMore: false,
        };
      });
      return;
    }
    if ("code" in result && result.code === "UNAUTHENTICATED") {
      await expireSession();
      return;
    }
    setSubscribersList(function stopSpinner(current) {
      return current.status === "ready" ? { ...current, loadingMore: false } : current;
    });
    await reportFailure(result);
  }

  /** The next page of either request half; one request carries both cursors. */
  async function loadMoreInvites() {
    if (invites.status !== "ready") return;
    const { incomingCursor, outgoingCursor, loadingMore } = invites;
    if (loadingMore || (incomingCursor === null && outgoingCursor === null)) return;
    const id = invitesRequest.current;
    setInvites({ ...invites, loadingMore: true });
    const result = await fetchInvites(incomingCursor ?? undefined, outgoingCursor ?? undefined);
    if (id !== invitesRequest.current) return;

    if (result.ok) {
      setInvites(function applyNextPage(current) {
        if (current.status !== "ready") return current;
        return {
          ...current,
          incoming: appendCirclePage(current.incoming, result.invites.incoming.items),
          outgoing: appendCirclePage(current.outgoing, result.invites.outgoing.items),
          incomingCount: result.invites.incomingCount,
          incomingCursor: result.invites.incoming.nextCursor,
          outgoingCursor: result.invites.outgoing.nextCursor,
          loadingMore: false,
        };
      });
      return;
    }
    if ("code" in result && result.code === "UNAUTHENTICATED") {
      await expireSession();
      return;
    }
    setInvites(function stopSpinner(current) {
      return current.status === "ready" ? { ...current, loadingMore: false } : current;
    });
    await reportFailure(result);
  }

  /**
   * `EXPERIENCE.md` → Friends infinite list: the next page starts 200 px before
   * the end of the page. The event shape is read on both runtimes by
   * `isNearListEnd`; one page per approach, the in-flight flag stops a storm of
   * scroll events.
   */
  function handleScroll(event: unknown) {
    if (!isNearListEnd(event)) return;
    if (tab === "friends") {
      void loadMoreFriends();
      return;
    }
    if (tab === "subscriptions") {
      if (subscriptionView === "subscribed") void loadMoreSubscribed();
      else void loadMoreSubscribers();
      return;
    }
    void loadMoreInvites();
  }

  /** The neighbour's ⋯ gets focus after a row disappears, else the page title. */
  function focusAfterRemoval(items: readonly CircleCard[], nick: string) {
    const next = focusNeighbour(
      items.map((item) => item.nick),
      nick,
    );
    setTimeout(function moveFocus() {
      restoreFocus(next === null ? headingNode.current : menuNodes.current.get(next));
    }, 0);
  }

  /** A row that stays puts focus back on its own ⋯. */
  function focusSameRow(nick: string) {
    setTimeout(function moveFocus() {
      restoreFocus(menuNodes.current.get(nick));
    }, 0);
  }

  function startAction(card: CircleCard): boolean {
    if (inFlight.current !== null) return false;
    inFlight.current = card.nick;
    setPendingNick(card.nick);
    setToast(null);
    return true;
  }

  function finishAction(card: CircleCard) {
    if (inFlight.current === card.nick) inFlight.current = null;
    setPendingNick(function clearPending(current) {
      return current === card.nick ? null : current;
    });
  }

  async function unsubscribeRow(card: CircleCard, list: "subscribed" | "subscribers") {
    if (!startAction(card)) return;
    const state = list === "subscribed" ? subscribedList : subscribersList;
    if (state.status !== "ready") {
      finishAction(card);
      return;
    }
    const snapshot = state;
    const setList = list === "subscribed" ? setSubscribedList : setSubscribersList;

    // Optimistic: «Я подписан» loses the row, «Мои подписчики» keeps it and only
    // the viewer's own edge goes away (`EXPERIENCE.md` → правила).
    if (list === "subscribed") {
      setList({
        ...snapshot,
        items: snapshot.items.filter((item) => item.nick !== card.nick),
        total: Math.max(0, snapshot.total - 1),
      });
    } else {
      setList({
        ...snapshot,
        items: snapshot.items.map((item) =>
          item.nick === card.nick ? { ...item, subscribed: false } : item,
        ),
      });
    }

    const result = await unsubscribeFromNick(card.nick).finally(function release() {
      finishAction(card);
    });

    if (result.ok) {
      setToast({ message: profile("subscription.toast.unsubscribed"), tone: "info" });
      if (list === "subscribed") focusAfterRemoval(snapshot.items, card.nick);
      else focusSameRow(card.nick);
      return;
    }
    setList(snapshot);
    await reportFailure(result);
  }

  /** A subscriber removed by the profile owner: optimistic, the confirm has said so. */
  async function removeSubscriberRow(card: CircleCard) {
    if (!startAction(card)) return;
    const state = subscribersList;
    if (state.status !== "ready") {
      finishAction(card);
      return;
    }
    const snapshot = state;
    setSubscribersList({
      ...state,
      items: state.items.filter((item) => item.nick !== card.nick),
      total: Math.max(0, state.total - 1),
    });

    const result = await removeSubscriber(user.nick, card.nick).finally(function release() {
      finishAction(card);
    });

    if (result.ok) {
      setSubscriberConfirm(null);
      setToast({
        message: friends("toast.subscriberRemoved", { name: card.displayName }),
        tone: "info",
      });
      focusAfterRemoval(snapshot.items, card.nick);
      return;
    }
    setSubscribersList(snapshot);
    setSubscriberConfirm(null);
    await reportFailure(result);
  }

  /**
   * Story 4.4: either side of the friendship removes it; the confirm has said so.
   * Only the friends list loses the row — a subscription in either direction is
   * not touched (`EXPERIENCE.md` → правила), and the other tabs keep their rows.
   */
  async function removeFriendRow(card: CircleCard) {
    if (!startAction(card)) return;
    const state = friendsList;
    if (state.status !== "ready") {
      finishAction(card);
      return;
    }
    const snapshot = state;
    setFriendsList({
      ...state,
      items: state.items.filter((item) => item.nick !== card.nick),
      total: Math.max(0, state.total - 1),
    });

    const result = await removeFriend(card.nick).finally(function release() {
      finishAction(card);
    });

    if (result.ok) {
      // `REMOVED` and the idempotent `ALREADY_REMOVED` are both successes.
      setFriendConfirm(null);
      setToast({
        message: friends("toast.friendRemoved", { name: card.displayName }),
        tone: "info",
      });
      focusAfterRemoval(snapshot.items, card.nick);
      return;
    }
    setFriendsList(snapshot);
    setFriendConfirm(null);
    await reportFailure(result);
  }

  async function subscribeRow(card: CircleCard) {
    if (!startAction(card)) return;
    const state = subscribersList;
    if (state.status !== "ready") {
      finishAction(card);
      return;
    }
    const snapshot = state;
    setSubscribersList({
      ...state,
      items: state.items.map((item) =>
        item.nick === card.nick ? { ...item, subscribed: true } : item,
      ),
    });

    const result = await subscribeToNick(card.nick).finally(function release() {
      finishAction(card);
    });

    if (result.ok) {
      setToast({ message: profile("subscription.toast.subscribed"), tone: "info" });
      focusSameRow(card.nick);
      return;
    }
    setSubscribersList(snapshot);
    await reportFailure(result);
  }

  async function addFriend(card: CircleCard) {
    if (!startAction(card)) return;
    const result = await sendFriendInvite(card.nick).finally(function release() {
      finishAction(card);
    });

    if (result.ok) {
      const becameFriends =
        result.outcome === "FRIENDS_CREATED" || result.outcome === "ALREADY_FRIENDS";
      setToast({
        message: becameFriends
          ? profile("relationship.toast.friends", { name: card.displayName })
          : profile("relationship.toast.invited"),
        tone: "info",
      });
      focusSameRow(card.nick);
      return;
    }
    await reportFailure(result);
  }

  async function acceptInvite(card: CircleCard) {
    if (!startAction(card)) return;
    const state = invites;
    if (state.status !== "ready") {
      finishAction(card);
      return;
    }
    const snapshot = state;
    setInvites({
      ...state,
      incoming: state.incoming.filter((item) => item.nick !== card.nick),
      incomingCount: Math.max(0, state.incomingCount - 1),
    });

    const result = await acceptFriendInvite(card.nick).finally(function release() {
      finishAction(card);
    });

    if (result.ok) {
      setToast({
        message: profile("relationship.toast.friends", { name: card.displayName }),
        tone: "info",
      });
      focusAfterRemoval(snapshot.incoming, card.nick);
      return;
    }
    setInvites(snapshot);
    await reportFailure(result);
  }

  async function rejectInvite(card: CircleCard) {
    if (!startAction(card)) return;
    const state = invites;
    if (state.status !== "ready") {
      finishAction(card);
      return;
    }
    const snapshot = state;
    setInvites({
      ...state,
      incoming: state.incoming.filter((item) => item.nick !== card.nick),
      incomingCount: Math.max(0, state.incomingCount - 1),
    });

    const result = await rejectFriendInvite(card.nick).finally(function release() {
      finishAction(card);
    });

    if (result.ok) {
      // The pair cooldown is written by the server; the row is gone and the
      // screen never calls it «Отклонено» (Story 4.3 decision 2).
      focusAfterRemoval(snapshot.incoming, card.nick);
      return;
    }
    setInvites(snapshot);
    await reportFailure(result);
  }

  async function cancelInvite(card: CircleCard) {
    if (!startAction(card)) return;
    const state = invites;
    if (state.status !== "ready") {
      finishAction(card);
      return;
    }
    const snapshot = state;
    setInvites({
      ...state,
      outgoing: state.outgoing.filter((item) => item.nick !== card.nick),
    });

    const result = await cancelFriendInvite(card.nick).finally(function release() {
      finishAction(card);
    });

    if (result.ok) {
      setToast({ message: friends("toast.inviteCancelled"), tone: "info" });
      focusAfterRemoval(snapshot.outgoing, card.nick);
      return;
    }
    setInvites(snapshot);
    await reportFailure(result);
  }

  function openProfile(nick: string) {
    const route = profileRoute(nick);
    if (route === null) return;
    router.push({ pathname: "/u/[nick]", params: { nick: route.nick } });
  }

  function openSearch(query?: string) {
    if (query === undefined || query === "") {
      router.push("/search");
      return;
    }
    router.push({ pathname: "/search", params: { q: query } });
  }

  function openFindContacts() {
    // NOTE FOR UX: «Найти знакомых» (`/friends/contacts`) is outside Story 4.3
    // and awaits its own story; until it exists both the top row and the empty
    // CTA open `/search`, like the temporary «Поиск» entry of Story 3.5.
    openSearch();
  }

  function selectSubscriptionView(next: string) {
    if (next !== "subscribed" && next !== "subscribers") return;
    setSubscriptionView(next);
    void writeSubscriptionView(user.nick, next);
  }

  function goBack() {
    // A direct link has no history behind it: fall back to the wishlist.
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  function dismissToast() {
    setToast(null);
  }

  function registerMenuNode(nick: string, node: FocusTarget | null) {
    menuNodes.current.set(nick, node);
  }

  /** The one item every circle row shares: open the person's profile. */
  function openProfileItem(card: CircleCard): OverflowMenuItem {
    return {
      key: "profile",
      label: friends("menu.openProfile"),
      onPress: function openViaMenu() {
        openProfile(card.nick);
      },
    };
  }

  /**
   * The ⋯ of «Друзья» (`EXPERIENCE.md` → Отношение → статус и меню): «Открыть
   * профиль», then the destructive «Удалить из друзей» with its confirm. Story
   * 4.5 adds «Заблокировать» after it.
   */
  function profileItems(card: CircleCard): OverflowMenuItem[] {
    return [
      openProfileItem(card),
      {
        key: "remove-friend",
        label: friends("menu.removeFriend"),
        destructive: true,
        onPress: function askRemoveFriend() {
          setToast(null);
          setFriendConfirm(card);
        },
      },
    ];
  }

  /** The ⋯ of «Я подписан»: the table minus «Удалить из друзей» and «Заблокировать». */
  function subscribedItems(card: CircleCard): OverflowMenuItem[] {
    const items = [openProfileItem(card)];
    if (card.relationship === "NONE") {
      items.push({
        key: "friend",
        label: profile("relationship.addFriend"),
        onPress: function inviteFriend() {
          void addFriend(card);
        },
      });
    }
    items.push({
      key: "unsubscribe",
      label: profile("subscription.unsubscribe"),
      onPress: function unsubscribe() {
        void unsubscribeRow(card, "subscribed");
      },
    });
    return items;
  }

  /** The ⋯ of «Мои подписчики»: the subscription back and the removal with confirm. */
  function subscriberItems(card: CircleCard): OverflowMenuItem[] {
    const items = [openProfileItem(card)];
    if (card.relationship === "NONE") {
      items.push({
        key: "friend",
        label: profile("relationship.addFriend"),
        onPress: function inviteFriend() {
          void addFriend(card);
        },
      });
    }
    items.push(
      card.subscribed
        ? {
            key: "unsubscribe",
            label: profile("subscription.unsubscribe"),
            onPress: function unsubscribe() {
              void unsubscribeRow(card, "subscribers");
            },
          }
        : {
            key: "subscribe",
            label: profile("subscription.subscribe"),
            onPress: function subscribe() {
              void subscribeRow(card);
            },
          },
    );
    items.push({
      key: "remove-subscriber",
      label: friends("menu.removeSubscriber"),
      onPress: function askRemove() {
        setSubscriberConfirm(card);
      },
    });
    return items;
  }

  const badge =
    invites.status === "ready" && invites.incomingCount > 0 ? invites.incomingCount : undefined;

  return (
    <Screen>
      <SafeArea>
        <Stack.Screen options={{ title: friends("pageTitle", { brand }) }} />
        <PageScroll
          testID="friends-page"
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <PageContainer>
            <Column
              size="content"
              flexGrow={1}
              paddingHorizontal="$page-gutter medium:$page-gutter-lg"
              paddingTop="$page-gutter"
              gap="$2"
            >
              <Pressable
                role="button"
                aria-label={friends("back")}
                onPress={goBack}
                alignSelf="flex-start"
                justifyContent="center"
                minHeight="$touch-target"
                minWidth="$touch-target"
              >
                <Text kind="button" tone="primary">
                  {friends("back")}
                </Text>
              </Pressable>
              <Text kind="display-sm" tone="primary" textAlign="center">
                {common("brandName", { brand })}
              </Text>
              <View ref={headingNode as never} tabIndex={-1} alignSelf="flex-start" outlineWidth={0}>
                <Heading level={1}>{friends("title")}</Heading>
              </View>
              <Pressable
                role="button"
                testID="friends-find-contacts"
                onPress={openFindContacts}
                minHeight="$touch-target"
                justifyContent="center"
                alignSelf="flex-start"
              >
                <Text kind="button" tone="primary">
                  {friends("findContacts")}
                </Text>
              </Pressable>
              <SegmentTabs
                label={friends("tabs.label")}
                value={tab}
                onChange={function selectTab(next) {
                  if (next === "friends" || next === "subscriptions" || next === "requests") {
                    changeTab(next);
                  }
                }}
                testID="friends-tabs"
                tabs={[
                  { key: "friends", label: friends("tabs.friends") },
                  { key: "subscriptions", label: friends("tabs.subscriptions") },
                  { key: "requests", label: friends("tabs.requests"), badge },
                ]}
              />
              <YStack paddingTop="$2" paddingBottom="$section-gap" gap="$grid-gap" flexGrow={1}>
                {tab === "friends" ? (
                  <FriendsPanel
                    list={friendsList}
                    query={query}
                    prepared={prepared}
                    onQueryChange={changeQuery}
                    onRetry={retryFriends}
                    onOpenFindContacts={openFindContacts}
                    onOpenSearch={openSearch}
                    menuFor={profileItems}
                    onMenuNode={registerMenuNode}
                  />
                ) : tab === "subscriptions" ? (
                  <SubscriptionsPanel
                    view={subscriptionView}
                    subscribed={subscribedList}
                    subscribers={subscribersList}
                    onViewChange={selectSubscriptionView}
                    onRetrySubscribed={retrySubscribed}
                    onRetrySubscribers={retrySubscribers}
                    subscribedMenuFor={subscribedItems}
                    subscriberMenuFor={subscriberItems}
                    onMenuNode={registerMenuNode}
                  />
                ) : (
                  <RequestsPanel
                    invites={invites}
                    onRetry={retryInvites}
                    onAccept={acceptInvite}
                    onReject={rejectInvite}
                    onCancel={cancelInvite}
                    pendingNick={pendingNick}
                    onRowNode={registerMenuNode}
                  />
                )}
              </YStack>
              <SiteFooter />
            </Column>
          </PageContainer>
        </PageScroll>
        <ConfirmDialog
          variant="confirm"
          visible={subscriberConfirm !== null}
          title={friends("removeSubscriber.title")}
          body={friends("removeSubscriber.body", {
            name: subscriberConfirm?.displayName ?? "",
          })}
          confirmLabel={friends("removeSubscriber.confirm")}
          cancelLabel={friends("removeSubscriber.cancel")}
          busy={confirmBusy}
          onConfirm={function confirmRemove() {
            if (subscriberConfirm === null) return;
            setConfirmBusy(true);
            void removeSubscriberRow(subscriberConfirm).finally(function release() {
              setConfirmBusy(false);
            });
          }}
          onCancel={function cancelRemove() {
            if (confirmBusy) return;
            setSubscriberConfirm(null);
          }}
          onClosed={function confirmClosed() {
            setConfirmBusy(false);
          }}
        />
        <ConfirmDialog
          variant="confirm"
          visible={friendConfirm !== null}
          title={friends("removeFriend.title", { name: friendConfirm?.displayName ?? "" })}
          body={friends("removeFriend.body")}
          confirmLabel={friends("removeFriend.confirm")}
          cancelLabel={friends("removeFriend.cancel")}
          busy={friendConfirmBusy}
          onConfirm={function confirmRemoveFriend() {
            if (friendConfirm === null) return;
            setFriendConfirmBusy(true);
            void removeFriendRow(friendConfirm).finally(function release() {
              setFriendConfirmBusy(false);
            });
          }}
          onCancel={function cancelRemoveFriend() {
            if (friendConfirmBusy) return;
            setFriendConfirm(null);
          }}
          onClosed={function friendConfirmClosed() {
            setFriendConfirmBusy(false);
          }}
        />
        {toast ? <ToastHost message={toast.message} tone={toast.tone} onDismiss={dismissToast} /> : null}
      </SafeArea>
    </Screen>
  );
}

FriendsContent.displayName = "FriendsContent";

function ListFooter({ state, testID }: { state: PageState; testID: string }) {
  const friends = useTranslations("app.friends");
  if (state.status !== "ready") return null;
  if (state.loadingMore) {
    return (
      <Text kind="caption" tone="muted" textAlign="center" testID={`${testID}-loading-more`}>
        {friends("list.loading")}
      </Text>
    );
  }
  if (state.nextCursor === null) {
    return (
      <Text kind="caption" tone="muted" textAlign="center" testID={`${testID}-all-shown`}>
        {friends("list.allShown", { count: state.total })}
      </Text>
    );
  }
  return null;
}

ListFooter.displayName = "ListFooter";

/** `EXPERIENCE.md` → Cold load: skeletons of the rows, never a lasting spinner. */
function SkeletonList({ testID }: { testID: string }) {
  const friends = useTranslations("app.friends");
  return (
    <YStack
      testID={testID}
      role="status"
      aria-busy
      aria-label={friends("list.loading")}
      gap="$grid-gap"
    >
      {[0, 1, 2].map(function skeletonKey(key) {
        return <PersonRowSkeleton key={key} testID="person-row-skeleton" />;
      })}
    </YStack>
  );
}

SkeletonList.displayName = "SkeletonList";

function RetryView({ text, onPress }: { text: string; onPress: () => void }) {
  const friends = useTranslations("app.friends");
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
      <PrimaryButton label={friends("retry")} onPress={onPress} />
    </YStack>
  );
}

RetryView.displayName = "RetryView";

type FriendsPanelProps = {
  list: PageState;
  query: string;
  prepared: string;
  onQueryChange: (value: string) => void;
  onRetry: () => void;
  onOpenFindContacts: () => void;
  onOpenSearch: (query?: string) => void;
  menuFor: (card: CircleCard) => OverflowMenuItem[];
  onMenuNode: (nick: string, node: FocusTarget | null) => void;
};

/** `EXPERIENCE.md` → Friends search и Friends infinite list, with the pinned field. */
function FriendsPanel({
  list,
  query,
  prepared,
  onQueryChange,
  onRetry,
  onOpenFindContacts,
  onOpenSearch,
  menuFor,
  onMenuNode,
}: FriendsPanelProps) {
  const friends = useTranslations("app.friends");

  return (
    <YStack testID="friends-panel" flexGrow={1} gap="$grid-gap">
      <SearchField
        label={friends("friendsSearch.label")}
        placeholder={friends("friendsSearch.label")}
        value={query}
        onChangeText={onQueryChange}
        clearLabel={friends("friendsSearch.clear")}
        testID="friends-search-input"
        input={{ autoCapitalize: "none", autoCorrect: false, returnKeyType: "search" }}
      />
      {list.status === "ready" && list.total > 0 ? (
        <Text kind="caption" tone="muted" testID="friends-counter">
          {friends("friendsSearch.counter", { shown: list.items.length, total: list.total })}
        </Text>
      ) : null}
      {list.status === "loading" || list.status === "idle" ? (
        <SkeletonList testID="friends-loading" />
      ) : list.status === "error" ? (
        <RetryView
          text={list.kind === "network" ? friends("loadError") : friends("loadErrorGeneric")}
          onPress={onRetry}
        />
      ) : list.items.length === 0 ? (
        prepared === "" ? (
          <EmptyState
            title={friends("empty.friendsTitle")}
            body={friends("empty.friendsBody")}
            action={<PrimaryButton label={friends("findContacts")} onPress={onOpenFindContacts} />}
          />
        ) : (
          <YStack
            width="100%"
            maxWidth="$max-form"
            alignSelf="center"
            gap="$grid-gap"
            paddingVertical="$section-gap"
          >
            <Heading level={2} kind="display-sm" textAlign="center">
              {friends("friendsSearch.emptyTitle", { query: prepared })}
            </Heading>
            <Text tone="muted" textAlign="center">
              {friends("friendsSearch.emptyBody")}
            </Text>
            <Pressable
              role="button"
              onPress={function searchEveryone() {
                onOpenSearch(prepared);
              }}
              alignSelf="center"
              minHeight="$touch-target"
              justifyContent="center"
            >
              <Text kind="button" tone="primary">
                {friends("searchAll")}
              </Text>
            </Pressable>
          </YStack>
        )
      ) : (
        <>
          <YStack role="list" gap="$2">
            {list.items.map(function renderFriend(card) {
              return (
                <PersonItem
                  key={card.nick}
                  card={card}
                  menu={menuFor(card)}
                  onMenuNode={onMenuNode}
                />
              );
            })}
          </YStack>
          <ListFooter state={list} testID="friends" />
        </>
      )}
    </YStack>
  );
}

FriendsPanel.displayName = "FriendsPanel";

type SubscriptionsPanelProps = {
  view: SubscriptionView;
  subscribed: PageState;
  subscribers: PageState;
  onViewChange: (key: string) => void;
  onRetrySubscribed: () => void;
  onRetrySubscribers: () => void;
  subscribedMenuFor: (card: CircleCard) => OverflowMenuItem[];
  subscriberMenuFor: (card: CircleCard) => OverflowMenuItem[];
  onMenuNode: (nick: string, node: FocusTarget | null) => void;
};

/** `EXPERIENCE.md` → Followers: the remembered switch and the two lists. */
function SubscriptionsPanel({
  view,
  subscribed,
  subscribers,
  onViewChange,
  onRetrySubscribed,
  onRetrySubscribers,
  subscribedMenuFor,
  subscriberMenuFor,
  onMenuNode,
}: SubscriptionsPanelProps) {
  const friends = useTranslations("app.friends");
  const profile = useTranslations("app.profile");
  const state = view === "subscribed" ? subscribed : subscribers;
  const subscribedTotal = subscribed.status === "ready" ? subscribed.total : undefined;
  const subscribersTotal = subscribers.status === "ready" ? subscribers.total : undefined;

  return (
    <YStack testID="subscriptions-panel" flexGrow={1} gap="$grid-gap">
      <SegmentTabs
        label={friends("subscriptions.label")}
        value={view}
        onChange={onViewChange}
        testID="friends-subscription-switch"
        tabs={[
          {
            key: "subscribed",
            label:
              subscribedTotal === undefined
                ? friends("subscriptions.subscribedPlain")
                : friends("subscriptions.subscribed", { count: subscribedTotal }),
          },
          {
            key: "subscribers",
            label:
              subscribersTotal === undefined
                ? friends("subscriptions.subscribersPlain")
                : friends("subscriptions.subscribers", { count: subscribersTotal }),
          },
        ]}
      />
      {state.status === "idle" || state.status === "loading" ? (
        <SkeletonList testID="subscriptions-loading" />
      ) : state.status === "error" ? (
        <RetryView
          text={state.kind === "network" ? friends("loadError") : friends("loadErrorGeneric")}
          onPress={view === "subscribed" ? onRetrySubscribed : onRetrySubscribers}
        />
      ) : state.items.length === 0 ? (
        <EmptyState
          title={
            view === "subscribed"
              ? friends("empty.subscribedTitle")
              : friends("empty.subscribersTitle")
          }
          body={
            view === "subscribed"
              ? friends("empty.subscribedBody")
              : friends("empty.subscribersBody")
          }
        />
      ) : (
        <>
          <YStack role="list" gap="$2">
            {state.items.map(function renderSubscriber(card) {
              if (view === "subscribed") {
                return (
                  <PersonItem
                    key={card.nick}
                    card={card}
                    menu={subscribedMenuFor(card)}
                    onMenuNode={onMenuNode}
                  />
                );
              }
              const chip = card.subscribed
                ? profile("relationship.chips.MUTUAL")
                : profile("relationship.chips.FOLLOWS_YOU");
              return (
                <PersonItem
                  key={card.nick}
                  card={card}
                  chip={chip}
                  menu={subscriberMenuFor(card)}
                  onMenuNode={onMenuNode}
                />
              );
            })}
          </YStack>
          <ListFooter state={state} testID={view === "subscribed" ? "subscribed" : "subscribers"} />
        </>
      )}
    </YStack>
  );
}

SubscriptionsPanel.displayName = "SubscriptionsPanel";

type RequestsPanelProps = {
  invites: InvitesState;
  onRetry: () => void;
  onAccept: (card: CircleCard) => void;
  onReject: (card: CircleCard) => void;
  onCancel: (card: CircleCard) => void;
  pendingNick: string | null;
  /** Stores the row's main action, so the next row can take focus after a removal. */
  onRowNode: (nick: string, node: FocusTarget | null) => void;
};

/** `EXPERIENCE.md` → Incoming / Outgoing invite row: incoming above outgoing. */
function RequestsPanel({
  invites,
  onRetry,
  onAccept,
  onReject,
  onCancel,
  pendingNick,
  onRowNode,
}: RequestsPanelProps) {
  const friends = useTranslations("app.friends");
  const profile = useTranslations("app.profile");

  function incomingRow(card: CircleCard) {
    return (
      <YStack role="listitem" key={card.nick} gap="$2">
        <PersonRow
          displayName={card.displayName}
          nick={card.nick}
          pressLabel={friends("openProfileChipLabel", {
            name: card.displayName,
            nick: card.nick,
            chip: profile("relationship.chips.INCOMING_PENDING"),
          })}
          chip={
            <RelationshipChip
              label={profile("relationship.chips.INCOMING_PENDING")}
              emphasis
            />
          }
          actions={
            <XStack gap="$2" flexWrap="wrap">
              <Button
                ref={function setActionNode(node) {
                  onRowNode(card.nick, node);
                }}
                label={friends("actions.accept")}
                ariaLabel={`${friends("actions.accept")}: ${card.displayName}`}
                busy={pendingNick === card.nick}
                onPress={function accept() {
                  onAccept(card);
                }}
                testID={`friends-accept-${card.nick}`}
              />
              <Button
                label={friends("actions.reject")}
                ariaLabel={`${friends("actions.reject")}: ${card.displayName}`}
                variant="ghost"
                busy={pendingNick === card.nick}
                onPress={function reject() {
                  onReject(card);
                }}
                testID={`friends-reject-${card.nick}`}
              />
            </XStack>
          }
          testID={`friends-row-${card.nick}`}
        />
      </YStack>
    );
  }

  function outgoingRow(card: CircleCard) {
    return (
      <YStack role="listitem" key={card.nick} gap="$2">
        <PersonRow
          displayName={card.displayName}
          nick={card.nick}
          pressLabel={friends("openProfileChipLabel", {
            name: card.displayName,
            nick: card.nick,
            chip: profile("relationship.chips.OUTGOING_PENDING"),
          })}
          chip={<RelationshipChip label={profile("relationship.chips.OUTGOING_PENDING")} />}
          actions={
            <Button
              ref={function setActionNode(node) {
                onRowNode(card.nick, node);
              }}
              label={friends("actions.cancel")}
              ariaLabel={`${friends("actions.cancel")}: ${card.displayName}`}
              variant="ghost"
              busy={pendingNick === card.nick}
              onPress={function cancel() {
                onCancel(card);
              }}
              testID={`friends-cancel-${card.nick}`}
            />
          }
          testID={`friends-row-${card.nick}`}
        />
      </YStack>
    );
  }

  return (
    <YStack testID="requests-panel" flexGrow={1} gap="$section-gap">
      {invites.status === "loading" ? (
        <SkeletonList testID="requests-loading" />
      ) : invites.status === "error" ? (
        <RetryView
          text={invites.kind === "network" ? friends("loadError") : friends("loadErrorGeneric")}
          onPress={onRetry}
        />
      ) : invites.incoming.length === 0 && invites.outgoing.length === 0 ? (
        <EmptyState title={friends("empty.requestsTitle")} body={friends("empty.requestsBody")} />
      ) : (
        <>
          {invites.incoming.length > 0 ? (
            <YStack gap="$2">
              <Heading level={2} kind="heading">
                {friends("requests.incoming")}
              </Heading>
              <YStack role="list" gap="$2">
                {invites.incoming.map(incomingRow)}
              </YStack>
            </YStack>
          ) : null}
          {invites.outgoing.length > 0 ? (
            <YStack gap="$2">
              <Heading level={2} kind="heading">
                {friends("requests.outgoing")}
              </Heading>
              <YStack role="list" gap="$2">
                {invites.outgoing.map(outgoingRow)}
              </YStack>
            </YStack>
          ) : null}
          {invites.loadingMore ? (
            <Text kind="caption" tone="muted" textAlign="center" testID="requests-loading-more">
              {friends("list.loading")}
            </Text>
          ) : invites.incomingCursor === null && invites.outgoingCursor === null ? (
            <Text kind="caption" tone="muted" textAlign="center" testID="requests-all-shown">
              {friends("list.allShown", {
                count: invites.incomingCount + invites.outgoing.length,
              })}
            </Text>
          ) : null}
        </>
      )}
    </YStack>
  );
}

RequestsPanel.displayName = "RequestsPanel";

type PersonItemProps = {
  card: CircleCard;
  /** The relation or subscription chip, already translated; `undefined` hides it. */
  chip?: string;
  /** The ⋯ actions of the row; `undefined` renders the row without a menu. */
  menu?: OverflowMenuItem[];
  /** Stores the ⋯ trigger of this row, so an action can put focus back on it. */
  onMenuNode: (nick: string, node: FocusTarget | null) => void;
};

/**
 * `DESIGN.md` → PersonRow in a circle list: the name, `@ник`, one optional chip
 * and the ⋯ menu beside the profile link. The chip is part of the paragraph the
 * reader announces (`EXPERIENCE.md` → подпись строки); ⋯ is a sibling of the
 * link, never its child.
 */
function PersonItem({ card, chip, menu, onMenuNode }: PersonItemProps) {
  const friends = useTranslations("app.friends");
  const route = profileRoute(card.nick);
  const pressLabel =
    chip === undefined
      ? friends("openProfileLabel", { name: card.displayName, nick: card.nick })
      : friends("openProfileChipLabel", { name: card.displayName, nick: card.nick, chip });

  const row = (
    <PersonRow
      displayName={card.displayName}
      nick={card.nick}
      pressLabel={pressLabel}
      chip={chip === undefined ? undefined : <RelationshipChip label={chip} />}
      actions={
        menu === undefined ? undefined : (
          <OverflowMenu
            ref={function setMenuNode(node) {
              onMenuNode(card.nick, node);
            }}
            label={friends("menu.actions", { name: card.displayName })}
            title={card.displayName}
            items={menu}
            testID={`friends-menu-${card.nick}`}
          />
        )
      }
      testID={`friends-row-${card.nick}`}
    />
  );

  return (
    <YStack role="listitem" gap="$2">
      {route === null ? (
        row
      ) : (
        <Link href={route.next} asChild>
          {row}
        </Link>
      )}
    </YStack>
  );
}

PersonItem.displayName = "PersonItem";
