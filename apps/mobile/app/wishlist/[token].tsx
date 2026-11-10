import type { GiftCard } from "@gift-list/contracts";
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
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { fetchPublicWishlist, type PublicWishlistOwner } from "@/api/public-wishlist";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { paramValue } from "@/session/return-path";
import { cardGrid, pageGutter } from "@/ui/card-grid";
import { EmptyState } from "@/ui/empty-state";
import { NavLink } from "@/ui/nav-link";
import { NotFoundScreen } from "@/ui/not-found-screen";
import { PrimaryButton } from "@/ui/primary-button";
import { PublicGiftCard } from "@/ui/public-gift-card";
import { SiteFooter } from "@/ui/site-footer";
import { ToastHost } from "@/ui/toast";
import { publicWishlistRoute } from "@/wishlist/public-token";

/**
 * A failed link read offers the retry view; `not_found` is its own state, the
 * same closed answer for an unknown token and a block (AD-7). The server has
 * already filtered wishes by `VisibilityPolicy`, so this screen never applies a
 * visibility rule of its own.
 */
type ScreenState =
  | { status: "loading" }
  // The token is kept with the answer: a reused route with another link must not
  // show the previous owner's list while the new read is in flight.
  | { status: "ready"; token: string; gifts: GiftCard[]; owner: PublicWishlistOwner }
  | { status: "missing" }
  | { status: "error"; kind: "network" | "generic" };

type ToastState = { message: string; tone: "info" | "error" };

/**
 * Story 3.3 / AD-26: the app screen behind `/l/:token`. A guest opens the link
 * directly: the server's link read opens only PUBLIC wishes, so there is no
 * reason to demand a session first. A signed-in visitor reads through
 * `GET /api/v1/l/:token`; the answer is the same `{ access, gifts, owner }` the
 * Next page renders, and only the server decides which wishes a friend may see.
 */
export default function PublicWishlistScreen() {
  const t = useTranslations("app");
  const wishlist = useTranslations("app.wishlist");
  const myWishlist = useTranslations("app.myWishlist");
  const common = useTranslations("common");
  const brand = getBrandName();
  const auth = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const grid = cardGrid(width, insets);
  const gutter = pageGutter(width);
  const params = useLocalSearchParams<{ token?: string }>();
  const route = publicWishlistRoute(paramValue(params.token));
  const token = route?.token ?? null;
  const [state, setState] = useState<ScreenState>(
    token === null ? { status: "missing" } : { status: "loading" },
  );
  const [attempt, setAttempt] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);

  // A guest is a first-class visitor here: the server's link read already opens
  // only PUBLIC wishes, so the screen never sends an anonymous visitor to login.
  // A failed session read is treated the same way as a guest and the list is read
  // anonymously; the list read reports its own network failure with «Повторить».
  const authPending = auth.state.status === "loading";

  useEffect(function loadWishlist() {
    if (authPending || token === null) return;
    const currentToken = token;
    let cancelled = false;

    async function requestWishlist() {
      let result = await fetchPublicWishlist(currentToken);
      if (cancelled) return;

      // A stale token must not be reported as a network failure: the link route
      // needs no session at all. Drop the session and repeat the read once as a
      // guest; only the retry's own answer decides what the visitor sees.
      if (!result.ok && "code" in result && result.code === "UNAUTHENTICATED") {
        const signedOut = await auth.signOut();
        if (cancelled) return;
        if (!signedOut.ok) {
          // Signing out failed on the network, so the network text is exact here.
          setState({ status: "error", kind: "network" });
          setToast({ message: t("form.network"), tone: "error" });
          return;
        }
        result = await fetchPublicWishlist(currentToken);
        if (cancelled) return;
      }

      const answer = result;
      if (answer.ok) {
        setState(
          answer.access === "not_found"
            ? { status: "missing" }
            : {
                status: "ready",
                token: currentToken,
                gifts: answer.gifts,
                owner: answer.owner,
              },
        );
        return;
      }
      if ("code" in answer && answer.code === "UNAUTHENTICATED") {
        // Even the guest retry was rejected: this is a broken answer, not a
        // network problem and not a stale session any more.
        setState({ status: "error", kind: "generic" });
        setToast({ message: common("errors.generic"), tone: "error" });
        return;
      }
      if ("code" in answer && answer.code === "NOT_FOUND") {
        setState({ status: "missing" });
        return;
      }
      const network = "network" in answer;
      setState({ status: "error", kind: network ? "network" : "generic" });
      setToast({
        message: network
          ? t("form.network")
          : "invalid" in answer
            ? common("errors.generic")
            : common(`errors.code.${answer.code}`),
        tone: "error",
      });
    }

    void requestWishlist();
    return function stopLoad() {
      cancelled = true;
    };
    // `auth` is only read on the expired-session branch; re-running the fetch on
    // every auth context update would refetch the list for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authPending, token, attempt]);

  if (token === null) {
    return <NotFoundScreen />;
  }

  // A reused route with a new token reads as loading until its own answer lands.
  const view: ScreenState =
    authPending || (state.status === "ready" && state.token !== token)
      ? { status: "loading" }
      : state;

  function retry() {
    setToast(null);
    setState({ status: "loading" });
    // A failed session read is retried together with the list so a signed-in
    // visitor gets the wider answer as soon as the network returns.
    if (auth.state.status === "error") auth.retry();
    setAttempt((value) => value + 1);
  }

  function dismissToast() {
    setToast(null);
  }

  return (
    <Screen>
      <SafeArea>
        <Stack.Screen options={{ title: wishlist("pageTitle", { brand }) }} />
        <PageScroll testID="public-wishlist-page">
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
                    testID="wishlist-loading"
                    label={myWishlist("loading")}
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
                  <WishlistUnavailable />
                ) : (
                  <>
                    <YStack testID="wishlist-owner" gap="$1">
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
              </YStack>
              <SiteFooter />
            </Column>
          </PageContainer>
        </PageScroll>
        {toast ? (
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

PublicWishlistScreen.displayName = "PublicWishlistScreen";

/**
 * UI6: a well-formed link whose list cannot be read. An unknown token, a token
 * whose list was deleted and a token blocked by visibility all arrive here as
 * the same closed answer — the screen must not reveal whether anything exists.
 */
function WishlistUnavailable() {
  const wishlist = useTranslations("app.wishlist");

  return (
    <YStack
      testID="wishlist-unavailable"
      width="100%"
      alignItems="center"
      paddingVertical={spacing["section-gap"]}
      gap="$grid-gap"
    >
      <Heading level={1} kind="display-sm" textAlign="center">
        {wishlist("unavailable")}
      </Heading>
      <Text tone="muted" textAlign="center">
        {wishlist("unavailableText")}
      </Text>
      <NavLink href="/">{wishlist("toHome")}</NavLink>
    </YStack>
  );
}

WishlistUnavailable.displayName = "WishlistUnavailable";

/** A failed read: one line of text and the retry button. */
function RetryView({ text, label, onPress }: { text: string; label: string; onPress: () => void }) {
  return (
    <YStack
      testID="wishlist-error"
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
