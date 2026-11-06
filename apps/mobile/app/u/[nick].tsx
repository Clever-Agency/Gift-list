import type { GiftCard } from "@gift-list/contracts";
import {
  Column,
  Heading,
  Screen,
  ScrollView,
  spacing,
  Text,
  XStack,
  YStack,
} from "@gift-list/ui";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { fetchProfile, type ProfileOwner } from "@/api/profile";
import { getBrandName } from "@/config/env";
import { profileRoute } from "@/profile/profile-route";
import { useAuth } from "@/session/auth-context";
import { paramValue } from "@/session/return-path";
import { cardGrid, pageGutter } from "@/ui/card-grid";
import { EmptyState } from "@/ui/empty-state";
import { PrimaryButton } from "@/ui/primary-button";
import { PublicGiftCard } from "@/ui/public-gift-card";
import { WishCardSkeleton } from "@/ui/skeleton";
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
  | { status: "ready"; nick: string; gifts: GiftCard[]; owner: ProfileOwner }
  | { status: "missing" }
  | { status: "error"; kind: "network" | "generic" };

const SKELETON_CARDS = [0, 1, 2];

type ToastState = { message: string; tone: "info" | "error" };

/**
 * Story 3.4 / AD-13: the app screen behind `/u/:nick`. An anonymous visitor
 * goes to login with that validated path as `next`, so signing in comes back
 * here. A signed-in visitor reads through `GET /api/v1/u/:nick`, and only the
 * server decides which wishes this viewer may see. Epic 4 will add the
 * friend/subscribe actions next to the card; until those actions exist the
 * screen shows no buttons, not even stubs.
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
              },
        );
        return;
      }
      if ("code" in result && result.code === "UNAUTHENTICATED") {
        const signedOut = await expireSession();
        // A failed sign-out leaves the screen mounted: show the retry view, not a skeleton.
        if (!signedOut && !cancelled) {
          setState({ status: "error", kind: "network" });
          setToast({ message: t("form.network"), tone: "error" });
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
    return <NotFoundScreen title={profile("notFound")} pageTitle={profile("pageTitle", { brand })} />;
  }

  if (auth.state.status !== "ready") return null;

  // A reused route with a new nick reads as loading until its own answer lands.
  const view: ScreenState =
    state.status === "ready" && state.nick !== nick ? { status: "loading" } : state;

  function retry() {
    setToast(null);
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }

  function dismissToast() {
    setToast(null);
  }

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <Stack.Screen options={{ title: profile("pageTitle", { brand }) }} />
        <Column
          size="wide"
          flex={1}
          paddingHorizontal={gutter}
          paddingTop="$page-gutter"
          gap="$2"
        >
          <ScrollView
            flex={1}
            contentContainerStyle={{
              paddingTop: spacing["grid-gap"] / 2,
              paddingBottom: spacing["section-gap"],
              gap: spacing["grid-gap"],
            }}
          >
            {view.status === "loading" ? (
              <XStack
                flexWrap="wrap"
                gap="$grid-gap"
                accessible
                aria-busy
                aria-label={profile("loading")}
              >
                {SKELETON_CARDS.map((key) => (
                  <WishCardSkeleton key={key} width={grid.cardWidth} />
                ))}
              </XStack>
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
          </ScrollView>
        </Column>
        {toast ? (
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

/** The malformed-segment answer: one heading, no request and no redirect. */
function NotFoundScreen({ title, pageTitle }: { title: string; pageTitle: string }) {
  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <Stack.Screen options={{ title: pageTitle }} />
        <Column size="wide" flex={1} paddingVertical="$section-gap">
          <Heading level={1} kind="display-sm" textAlign="center">
            {title}
          </Heading>
        </Column>
      </SafeAreaView>
    </Screen>
  );
}

NotFoundScreen.displayName = "NotFoundScreen";

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
