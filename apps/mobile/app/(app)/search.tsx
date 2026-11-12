import {
  USER_SEARCH_QUERY_MAX,
  type ProfileInviteCooldown,
  type ProfileRelationship,
  type UserSearchCard,
} from "@gift-list/contracts";
import {
  Column,
  EmptyState,
  Heading,
  PageContainer,
  PageScroll,
  PersonRow,
  PersonRowSkeleton,
  Pressable,
  SafeArea,
  Screen,
  SearchField,
  Text,
  YStack,
} from "@gift-list/ui";
import { Link, router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { searchUsers } from "@/api/search";
import { getBrandName } from "@/config/env";
import {
  optimisticRelation,
  requestRelationshipAction,
  type RelationshipAction,
} from "@/profile/relationship-action";
import { RelationshipActions } from "@/profile/relationship-actions";
import { profileRoute } from "@/profile/profile-route";
import { prepareUserSearchQuery } from "@/search/search-query";
import { useAuth } from "@/session/auth-context";
import { PrimaryButton } from "@/ui/primary-button";
import { SessionErrorScreen } from "@/ui/session-error-screen";
import { SessionLoadingScreen } from "@/ui/session-loading-screen";
import { SiteFooter } from "@/ui/site-footer";
import { ToastHost } from "@/ui/toast";

/**
 * Story 3.5 / EXPERIENCE «Поиск»: before the first character there is no
 * request and no heading, an empty answer is an empty state and not an error,
 * and a failed read offers «Повторить». The answer is a list of people only:
 * wishes, email, id and `hideFromSearch` never reach the screen (NFR-3, AD-13).
 */
type SearchAnswer =
  | { status: "ready"; query: string; users: UserSearchCard[] }
  | { status: "error"; query: string; kind: "network" | "generic" };

/** One toast at a time: a failed sign-out and a failed relation press reach it. */
type ToastState = { message: string; tone: "info" | "error" };

/** One constant for the whole screen; the documents name no other value. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The same card with one relation field replaced. The contract has no `null`
 * cooldown, so a closed window drops the key instead of writing `undefined`.
 */
function withRelation(
  card: UserSearchCard,
  relationship: ProfileRelationship,
  inviteCooldown: ProfileInviteCooldown | null,
): UserSearchCard {
  const next: UserSearchCard = { ...card, relationship };
  if (inviteCooldown === null) delete next.inviteCooldown;
  else next.inviteCooldown = inviteCooldown;
  return next;
}

/**
 * `/search` (Story 3.5, UX-A13): the session gate is the same as on settings.
 * An anonymous visitor leaves for login with a return here; the search itself
 * starts only after `/me` answers, so the screen never queries as a stranger.
 */
export default function SearchScreen() {
  const auth = useAuth();
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(function redirectAnonymous() {
    if (auth.state.status === "anonymous") {
      // The login screen owns the «Сессия закончилась» toast: it outlives this screen.
      router.replace({
        pathname: "/login",
        params: sessionExpired
          ? { next: "/search", reason: "session_expired" }
          : { next: "/search" },
      });
    }
  }, [auth.state.status, sessionExpired]);

  function handleSessionExpired(expired: boolean) {
    setSessionExpired(expired);
  }

  if (auth.state.status === "error") {
    return <SessionErrorScreen onRetry={auth.retry} />;
  }

  if (auth.state.status !== "ready") return <SessionLoadingScreen />;

  return <SearchScreenContent onSessionExpired={handleSessionExpired} />;
}

SearchScreen.displayName = "SearchScreen";

function SearchScreenContent({
  onSessionExpired,
}: {
  onSessionExpired: (expired: boolean) => void;
}) {
  const app = useTranslations("app");
  const search = useTranslations("app.search");
  const profile = useTranslations("app.profile");
  const common = useTranslations("common");
  const brand = getBrandName();
  const auth = useAuth();

  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<SearchAnswer | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  // One relation press at a time across the list: a second row cannot start an
  // invite while the first answer is still missing.
  const [pendingNick, setPendingNick] = useState<string | null>(null);
  const inviteInFlight = useRef<string | null>(null);
  // Only the newest answer may touch the list: a slow earlier request cannot
  // overwrite a newer one, and a cleared field cancels whatever was in flight.
  const latest = useRef(0);

  // Derived, not stored: an empty field (and a lone @) is «до ввода» with no
  // request, and a query without an answer yet is the loading state.
  const prepared = prepareUserSearchQuery(query);

  useEffect(function debounceQuery() {
    const id = ++latest.current;
    if (prepared === "") return;

    const timer = setTimeout(function requestAfterPause() {
      void load(prepared, id);
    }, SEARCH_DEBOUNCE_MS);

    return function cancelQuery() {
      clearTimeout(timer);
      latest.current += 1;
    };
    // The request helper reads the latest auth callbacks; the normalized query
    // is the only trigger, like the settings screen's form effects. Whitespace
    // around the same value is not a new search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared]);

  async function load(value: string, id: number) {
    const result = await searchUsers(value);
    if (id !== latest.current) return;

    if (result.ok) {
      setAnswer({ status: "ready", query: value, users: result.users });
      setRetrying(false);
      return;
    }
    if ("network" in result) {
      setAnswer({ status: "error", query: value, kind: "network" });
      setRetrying(false);
      return;
    }
    if ("invalid" in result) {
      setAnswer({ status: "error", query: value, kind: "generic" });
      setRetrying(false);
      return;
    }
    if (result.code === "UNAUTHENTICATED") {
      // Same as the other `(app)` screens: clear the dead session and let the
      // guard open login with the reason and a return to the search.
      onSessionExpired(true);
      const signedOut = await auth.signOut();
      if (!signedOut.ok && id === latest.current) {
        onSessionExpired(false);
        setAnswer({ status: "error", query: value, kind: "network" });
        setRetrying(false);
        setToast({ message: app("form.network"), tone: "error" });
      }
      return;
    }
    setAnswer({ status: "error", query: value, kind: "generic" });
    setRetrying(false);
  }

  function changeQuery(value: string) {
    setQuery(value);
  }

  function retry() {
    if (prepared === "") return;
    const id = ++latest.current;
    setRetrying(true);
    void load(prepared, id);
  }

  /**
   * Replaces one card of the newest answer. A card that left the list (the
   * query moved on) simply keeps the list as it is: an answer never resurrects
   * a person the current search no longer returns.
   */
  function updateCard(nick: string, apply: (card: UserSearchCard) => UserSearchCard) {
    setAnswer(function applyToCard(current) {
      if (current === null || current.status !== "ready") return current;
      if (!current.users.some((card) => card.nick === nick)) return current;
      return {
        ...current,
        users: current.users.map((card) => (card.nick === nick ? apply(card) : card)),
      };
    });
  }

  /**
   * Story 4.1.3 / 4.2.3 / CLE-89: the profile's relation automaton on one search
   * row. The optimistic chip is rolled back on every failure; the invite answer
   * carries no profile, so the card is updated in place and no `/u/:nick` read
   * or wish read follows (NFR-3). A `INVITE_COOLDOWN` shows the server's hours
   * on the card when it named them.
   */
  async function relationshipAction(user: UserSearchCard, kind: RelationshipAction) {
    if (inviteInFlight.current !== null) return;
    const requestedNick = user.nick;
    const previous = {
      relationship: user.relationship,
      inviteCooldown: user.inviteCooldown ?? null,
    };
    inviteInFlight.current = requestedNick;
    setPendingNick(requestedNick);
    setToast(null);

    const optimistic = optimisticRelation(kind);
    updateCard(requestedNick, function applyOptimistic(card) {
      return withRelation(card, optimistic.relationship, optimistic.inviteCooldown);
    });

    const result = await requestRelationshipAction(kind, requestedNick, {
      relationship: profile,
      common,
    });
    if (inviteInFlight.current === requestedNick) inviteInFlight.current = null;
    setPendingNick(function clearPending(current) {
      return current === requestedNick ? null : current;
    });

    if (result.status === "friends") {
      updateCard(requestedNick, function applyFriendship(card) {
        return withRelation(card, "FRIENDS", null);
      });
      setToast({
        message: profile("relationship.toast.friends", { name: user.displayName }),
        tone: "info",
      });
      return;
    }
    if (result.status === "pending") {
      updateCard(requestedNick, function applyPending(card) {
        return withRelation(card, "OUTGOING_PENDING", null);
      });
      setToast({ message: profile("relationship.toast.invited"), tone: "info" });
      return;
    }
    if (result.status === "rejected") {
      // The rejection window is written in the same transaction (AD-10 step 3);
      // a search row keeps the estimate because no profile read follows.
      updateCard(requestedNick, function applyRejection(card) {
        return withRelation(card, "NONE", result.inviteCooldown);
      });
      return;
    }

    function rollback(card: UserSearchCard): UserSearchCard {
      return withRelation(card, previous.relationship, previous.inviteCooldown);
    }

    if (result.status === "cooldown") {
      if (result.inviteCooldown !== null) {
        const cooldown = result.inviteCooldown;
        updateCard(requestedNick, function applyCooldown(card) {
          return withRelation(card, "NONE", cooldown);
        });
      } else {
        updateCard(requestedNick, rollback);
      }
      setToast({ message: result.message, tone: "error" });
      return;
    }
    updateCard(requestedNick, rollback);

    if (result.status === "expired") {
      // Same as the other `(app)` screens: clear the dead session and let the
      // guard open login with the reason and a return to the search.
      onSessionExpired(true);
      const signedOut = await auth.signOut();
      if (!signedOut.ok) {
        onSessionExpired(false);
        setToast({ message: app("form.network"), tone: "error" });
      }
      return;
    }
    if (result.status === "missing") {
      setToast({ message: common("errors.code.NOT_FOUND"), tone: "error" });
      return;
    }
    setToast({ message: result.message, tone: "error" });
  }

  // `null` until the first answer. An answer for another query belongs to the
  // previous text, so the current one is still loading.
  const current = answer?.query === prepared ? answer : null;
  const loading = prepared !== "" && (current === null || retrying);
  // A search may return the viewer's own card; the relation has no `SELF`
  // value, so the screen compares the nick with the session like the profile.
  const viewerNick = auth.state.status === "ready" ? auth.state.user.nick : null;

  function goBack() {
    // A direct link has no history behind it: fall back to the wishlist.
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  function dismissToast() {
    setToast(null);
  }

  return (
    <Screen>
      <SafeArea>
        <Stack.Screen options={{ title: search("pageTitle", { brand }) }} />
        <PageScroll testID="search-page" keyboardShouldPersistTaps="handled">
          <PageContainer>
            {/* A list of people reads best at the content width; the gutter is
                the Tamagui media clause, so the browser turns it into CSS and
                the window width is never read in JS (W12.16). */}
            <Column
              size="content"
              flexGrow={1}
              paddingHorizontal="$page-gutter medium:$page-gutter-lg"
              paddingTop="$page-gutter"
              gap="$2"
            >
              <Pressable
                role="button"
                aria-label={search("back")}
                onPress={goBack}
                alignSelf="flex-start"
                justifyContent="center"
                minHeight="$touch-target"
                minWidth="$touch-target"
              >
                <Text kind="button" tone="primary">
                  {search("back")}
                </Text>
              </Pressable>
              <Text kind="display-sm" tone="primary" textAlign="center">
                {app("brandName", { brand })}
              </Text>
              <Heading level={1}>{search("title")}</Heading>
              <SearchField
                label={search("fieldPlaceholder")}
                placeholder={search("fieldPlaceholder")}
                value={query}
                onChangeText={changeQuery}
                clearLabel={search("clear")}
                testID="search-input"
                input={{
                  autoCapitalize: "none",
                  autoCorrect: false,
                  returnKeyType: "search",
                  maxLength: USER_SEARCH_QUERY_MAX,
                }}
              />
              <YStack
                testID="search-content"
                flexGrow={1}
                paddingTop="$2"
                paddingBottom="$section-gap"
                gap="$grid-gap"
              >
                {prepared === "" ? (
                  <Text tone="muted" textAlign="center" paddingVertical="$section-gap">
                    {search("beforeInput")}
                  </Text>
                ) : loading ? (
                  <YStack
                    testID="search-loading"
                    role="status"
                    aria-busy
                    aria-label={search("loading")}
                    gap="$grid-gap"
                  >
                    {[0, 1, 2].map(function skeletonKey(key) {
                      return <PersonRowSkeleton key={key} testID="person-row-skeleton" />;
                    })}
                  </YStack>
                ) : current?.status === "error" ? (
                  <RetryView
                    text={
                      current.kind === "network" ? search("loadError") : search("loadErrorGeneric")
                    }
                    label={search("retry")}
                    onPress={retry}
                  />
                ) : current !== null && current.status === "ready" && current.users.length === 0 ? (
                  <EmptyState title={search("emptyTitle")} body={search("emptyBody")} />
                ) : current !== null && current.status === "ready" && current.users.length > 0 ? (
                  <YStack role="list" gap="$2">
                    {current.users.map(function renderPerson(user) {
                      const route = profileRoute(user.nick);
                      const ownProfile =
                        viewerNick !== null &&
                        user.nick.toLowerCase() === viewerNick.toLowerCase();
                      return (
                        <YStack role="listitem" key={user.nick} gap="$2">
                          {route ? (
                            <Link href={route.next} asChild>
                              <PersonRow
                                displayName={user.displayName}
                                nick={user.nick}
                                pressLabel={search("openProfile", { nick: route.nick })}
                              />
                            </Link>
                          ) : (
                            <PersonRow displayName={user.displayName} nick={user.nick} />
                          )}
                          {/*
                            NOTE FOR UX: `DESIGN.md` → PersonRow keeps the row's
                            actions in the ⋯ menu. CLE-89 asks for the profile's
                            buttons in the search row, so the same block sits next
                            to the link — never inside `<a>`, so a press on a
                            button cannot open the profile.
                          */}
                          <RelationshipActions
                            relationship={user.relationship}
                            inviteCooldown={user.inviteCooldown ?? null}
                            ownProfile={ownProfile}
                            busy={pendingNick === user.nick}
                            onAction={function actOnRelation(kind) {
                              void relationshipAction(user, kind);
                            }}
                            testIDPrefix="search"
                          />
                        </YStack>
                      );
                    })}
                  </YStack>
                ) : null}
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

SearchScreenContent.displayName = "SearchScreenContent";

/** A failed search: one line of text and the retry button. */
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
