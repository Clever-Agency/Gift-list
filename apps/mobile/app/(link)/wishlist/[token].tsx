import type { GiftCard } from "@gift-list/contracts";
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
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { fetchPublicWishlist, type PublicWishlistOwner } from "@/api/public-wishlist";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { signOutErrorMessage } from "@/session/form-issue";
import { paramValue } from "@/session/return-path";
import { CardGridList } from "@/ui/card-grid-list";
import { ClosedSection } from "@/ui/closed-section";
import { EmptyState } from "@/ui/empty-state";
import { NavLink } from "@/ui/nav-link";
import { NotFoundScreen } from "@/ui/not-found-screen";
import { PublicGiftCard } from "@/ui/public-gift-card";
import { SiteFooter } from "@/ui/site-footer";
import { ToastHost } from "@/ui/toast";
import { useCardGrid } from "@/ui/use-card-grid";
import { publicWishlistRoute } from "@/wishlist/public-token";

/**
 * A failed link read offers the retry view; `not_found` is its own state, the
 * same closed answer for an unknown token and a block (AD-7). The server has
 * already filtered wishes by `VisibilityPolicy`, so this screen never applies a
 * visibility rule of its own.
 */
type ScreenState =
  | { status: "loading" }
  | { status: "ready"; gifts: GiftCard[]; owner: PublicWishlistOwner }
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
  const auth = useAuth();
  const params = useLocalSearchParams<{ token?: string; reserve?: string; title?: string }>();
  const route = publicWishlistRoute(paramValue(params.token));
  if (!route) return <NotFoundScreen />;

  // Карточки, уведомления и переход к брони принадлежат зрителю одной ссылки.
  const viewer = auth.state.status === "ready" ? `user:${auth.state.user.id}` : auth.state.status;
  return (
    <WishlistContent key={`${viewer}/${route.token}`} token={route.token} auth={auth} params={params} />
  );
}

PublicWishlistScreen.displayName = "PublicWishlistScreen";

function WishlistContent({ token, auth, params }: {
  token: string;
  auth: ReturnType<typeof useAuth>;
  params: { reserve?: string; title?: string };
}) {
  const t = useTranslations("app");
  const wishlist = useTranslations("app.wishlist");
  const myWishlist = useTranslations("app.myWishlist");
  const closedCopy = useTranslations("app.gift.closed");
  const common = useTranslations("common");
  const brand = getBrandName();
  // W12.21: the page gutter is the Tamagui media clause
  // `$page-gutter medium:$page-gutter-lg`, so the browser lays it out with a CSS
  // media query and the phone reads the same theme key.
  // W12.23: the column count and the card width (`DESIGN.md` → Layout → columns) are
  // grid math, so on the web they follow the measured content area, not the window:
  // a classic scrollbar makes the window wider than this section by its own width.
  // The link skeleton and the wish cards share the one measurement, and until it
  // lands the hook keeps the phone's `cardGrid(windowWidth, insets)` numbers.
  // Destructured: React's `refs` lint rule treats an object that holds a ref callback
  // as a ref, and a member read of it during render is an error.
  const { cardWidth, attachContainer } = useCardGrid();
  const [state, setState] = useState<ScreenState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  // Story 5.3: «Уже подарено» is closed until the visitor opens it.
  const [closedExpanded, setClosedExpanded] = useState(false);

  // A guest is a first-class visitor here: the server's link read already opens
  // only PUBLIC wishes, so the screen never sends an anonymous visitor to login.
  // Если /me недоступен, публичная ссылка всё равно запрашивает список.
  // Сервер определяет выдачу по учётным данным фактического запроса.
  const authPending = auth.state.status === "loading";

  useEffect(function loadWishlist() {
    if (authPending) return;
    let cancelled = false;

    async function requestWishlist() {
      const answer = await fetchPublicWishlist(token);
      if (cancelled) return;

      if (answer.ok) {
        setState(
          answer.access === "not_found"
            ? { status: "missing" }
            : {
                status: "ready",
                gifts: answer.gifts,
                owner: answer.owner,
              },
        );
        return;
      }
      if ("code" in answer && answer.code === "UNAUTHENTICATED") {
        if (auth.state.status === "anonymous") {
          setState({ status: "error", kind: "generic" });
          setToast({ message: common("errors.generic"), tone: "error" });
          return;
        }
        // При успешном выходе гостевой экземпляр экрана сам запросит список.
        const signedOut = await auth.signOut();
        if (!cancelled && !signedOut.ok) {
          setState({ status: "error", kind: "network" in signedOut ? "network" : "generic" });
          setToast({ message: signOutErrorMessage(signedOut, t("form.network"), common), tone: "error" });
        }
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

  const handledReserve = useRef<string | null>(null);

  useEffect(function followReserveDeepLink() {
    const reserveId = paramValue(params.reserve);
    if (!reserveId || authPending || !token) return;
    const handleKey = `${token}:${reserveId}:${auth.state.status}`;
    if (handledReserve.current === handleKey) return;
    if (auth.state.status === "anonymous") {
      handledReserve.current = handleKey;
      const title = paramValue(params.title);
      const nextQuery = new URLSearchParams({ reserve: reserveId });
      if (title) nextQuery.set("title", title);
      router.replace({
        pathname: "/login",
        params: { next: `/wishlist/${token}?${nextQuery.toString()}` },
      });
      return;
    }
    if (auth.state.status !== "ready") return;
    if (state.status !== "ready") return;
    handledReserve.current = handleKey;
    const gift = state.gifts.find(function matchGift(row) {
      return row.id === reserveId;
    });
    if (gift?.quantity === "SINGLE" && gift.status === "OPEN") {
      router.replace({
        pathname: "/gifts/[id]",
        params: { id: reserveId, openReserve: "1", listToken: token, title: gift.title },
      });
      return;
    }
    if (!gift || gift.status !== "RESERVED") {
      router.replace({
        pathname: "/gifts/[id]",
        params: {
          id: reserveId,
          listToken: token,
          title: gift?.title ?? paramValue(params.title) ?? "",
        },
      });
    }
  }, [authPending, auth.state.status, params.reserve, params.title, state, token]);

  // Story 5.3: the one list is split on the client; the closed wishes of the
  // visitor go into «Уже подарено» without any action.
  const allGifts = state.status === "ready" ? state.gifts : [];
  const activeGifts = allGifts.filter(function notClosed(gift) {
    return gift.status !== "CLOSED";
  });
  const closedGifts = allGifts.filter(function onlyClosed(gift) {
    return gift.status === "CLOSED" && gift.archivedAt === null;
  });

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
    if (paramValue(params.reserve) && token) {
      router.replace({ pathname: "/wishlist/[token]", params: { token } });
    }
  }

  const reserveIdNow = paramValue(params.reserve);
  const reservedWhileEntering =
    auth.state.status === "ready" &&
    state.status === "ready" &&
    reserveIdNow !== undefined &&
    state.gifts.some(function taken(row) {
      return row.id === reserveIdNow && row.status === "RESERVED";
    });
  const visibleToast =
    toast ??
    (reservedWhileEntering
      ? { message: common("errors.reason.RESERVATION_TAKEN"), tone: "error" as const }
      : null);

  return (
    <Screen>
      <SafeArea>
        <Stack.Screen options={{ title: wishlist("pageTitle", { brand }) }} />
        <PageScroll testID="public-wishlist-page">
          <PageContainer>
            <Column
              size="wide"
              flexGrow={1}
              paddingHorizontal="$page-gutter medium:$page-gutter-lg"
              paddingTop="$page-gutter"
              gap="$2"
            >
              <YStack
                testID="public-wishlist-content"
                ref={attachContainer}
                flexGrow={1}
                paddingTop="$2"
                paddingBottom="$section-gap"
                gap="$grid-gap"
              >
                {state.status === "loading" ? (
                  <LoadingCards
                    testID="wishlist-loading"
                    label={myWishlist("loading")}
                    width={cardWidth}
                  />
                ) : state.status === "error" ? (
                  <RetryView
                    text={
                      state.kind === "network"
                        ? myWishlist("loadError")
                        : myWishlist("loadErrorGeneric")
                    }
                    label={myWishlist("retry")}
                    onPress={retry}
                  />
                ) : state.status === "missing" ? (
                  <WishlistUnavailable />
                ) : (
                  <>
                    <YStack testID="wishlist-owner" gap="$1">
                      <Heading level={1} kind="display-sm">
                        {state.owner.displayName}
                      </Heading>
                      <Text kind="caption" tone="muted">
                        {t("form.nickPreview", { nick: state.owner.nick })}
                      </Text>
                    </YStack>
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
                                  listToken={token}
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
                            testID="wishlist-closed"
                            toggleTestID="wishlist-closed-toggle"
                          >
                            {closedGifts.map(function renderClosed(gift) {
                              return (
                                <PublicGiftCard
                                  key={gift.id}
                                  gift={gift}
                                  width={cardWidth}
                                  listToken={token}
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
        {visibleToast ? (
          <ToastHost
            message={visibleToast.message}
            tone={visibleToast.tone}
            onDismiss={dismissToast}
            offsetBottom={spacing["page-gutter"]}
          />
        ) : null}
      </SafeArea>
    </Screen>
  );
}

WishlistContent.displayName = "WishlistContent";

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
      paddingVertical="$section-gap"
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
