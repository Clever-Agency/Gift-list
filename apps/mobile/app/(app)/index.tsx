import type { GiftCard } from "@gift-list/contracts";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { fetchMyGifts } from "@/api/my-gifts";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { colors, spacing, textStyle } from "@/theme/tokens";
import { AuthorLink } from "@/ui/author-link";
import { cardGrid } from "@/ui/card-grid";
import { EmptyState } from "@/ui/empty-state";
import { WishCard } from "@/ui/gift-card";
import { PrimaryButton } from "@/ui/primary-button";
import { WishCardSkeleton } from "@/ui/skeleton";
import { ToastHost } from "@/ui/toast";

/**
 * A failed read offers the retry view; UX-DR6 adds the toast. A missing list is its
 * own state: «Список не найден» is not an empty wishlist (EXPERIENCE → State Patterns).
 */
type ScreenState =
  | { status: "loading" }
  | { status: "ready"; gifts: GiftCard[] }
  | { status: "missing" }
  | { status: "error" };

const SKELETON_CARDS = [0, 1, 2];

// NOTE FOR UX: the 10 s cold-load deadline («Нет сети при загрузке», EXPERIENCE →
// State Patterns) needs a request timeout in `api/client`; until then a hung fetch
// keeps the skeleton. The error view below already matches the same pattern.

/**
 * «Мой вишлист» (Story 2.1): AD-7 owner branch through `api/v1`, so every own wish
 * comes back, including `SECRET`. The gift card is the shared AD-12 contract; the
 * screen only adds the owner chip, status pill and the empty/loading/error states.
 */
export default function MyWishlistScreen() {
  const t = useTranslations("app");
  const wishlist = useTranslations("app.myWishlist");
  const common = useTranslations("common");
  const brand = getBrandName();
  const auth = useAuth();
  const { width } = useWindowDimensions();
  const grid = cardGrid(width);
  const gutter =
    width >= spacing["bp-medium"] ? spacing["page-gutter-lg"] : spacing["page-gutter"];
  const [state, setState] = useState<ScreenState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const ownerId = auth.state.status === "ready" ? auth.state.user.id : null;

  useEffect(() => {
    if (auth.state.status === "anonymous") {
      // The login screen owns the «Сессия закончилась» toast: it outlives this screen.
      router.replace({
        pathname: "/login",
        params: sessionExpired ? { next: "/", reason: "session_expired" } : { next: "/" },
      });
    }
  }, [auth.state.status, sessionExpired]);

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    void (async () => {
      const result = await fetchMyGifts();
      if (cancelled) return;
      if (result.ok) {
        setState(
          result.access === "not_found"
            ? { status: "missing" }
            : { status: "ready", gifts: result.gifts },
        );
        return;
      }
      if (!("network" in result) && result.code === "UNAUTHENTICATED") {
        // The stored session is dead: `signOut` clears the token and marks the app
        // anonymous, and the guard above opens login with `?next=/&reason=session_expired`.
        setSessionExpired(true);
        const signedOut = await auth.signOut();
        // A failed sign-out leaves the screen mounted: show the retry view, not a skeleton.
        if (!signedOut.ok && !cancelled) {
          setSessionExpired(false);
          setState({ status: "error" });
          setToast(t("form.network"));
        }
        return;
      }
      if (!("network" in result) && result.code === "NOT_FOUND") {
        // The list behind the session is gone: «Список не найден», not an empty wishlist.
        setState({ status: "missing" });
        return;
      }
      setState({ status: "error" });
      // UX-DR6: a network failure is never silent — the retry view and a toast.
      setToast("network" in result ? t("form.network") : common(`errors.code.${result.code}`));
    })();
    return () => {
      cancelled = true;
    };
    // `auth` is only read on the expired-session branch; re-running the fetch on
    // every auth context update would refetch the list for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, attempt]);

  if (auth.state.status !== "ready") {
    return null;
  }

  function retry() {
    setToast(null);
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }

  function dismissToast() {
    setToast(null);
  }

  function openComposer() {
    // NOTE FOR UX: маршрут формы желания появляется со Story 2.2.
    router.push("/gifts/new");
  }

  function signOut() {
    void (async () => {
      const result = await auth.signOut();
      if (!result.ok) setToast(t("form.network"));
    })();
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: wishlist("pageTitle", { brand }) }} />
      <View style={[styles.column, { paddingHorizontal: gutter }]}>
        <Text style={styles.logo}>{common("brandName", { brand })}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {wishlist("title")}
        </Text>

        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scroll}>
          {state.status === "loading" ? (
            <View
              style={styles.grid}
              accessible
              accessibilityState={{ busy: true }}
              accessibilityLabel={wishlist("loading")}
            >
              {SKELETON_CARDS.map((key) => (
                <WishCardSkeleton key={key} width={grid.cardWidth} />
              ))}
            </View>
          ) : state.status === "error" ? (
            <View style={styles.retry}>
              <Text style={styles.retryText}>{wishlist("loadError")}</Text>
              <PrimaryButton label={wishlist("retry")} onPress={retry} />
            </View>
          ) : state.status === "missing" ? (
            <View style={styles.retry}>
              <Text style={styles.retryText}>{wishlist("listNotFound")}</Text>
              <PrimaryButton label={wishlist("retry")} onPress={retry} />
            </View>
          ) : state.gifts.length === 0 ? (
            <EmptyState
              title={wishlist("emptyTitle")}
              body={wishlist("emptyText")}
              action={<PrimaryButton label={wishlist("addWish")} onPress={openComposer} />}
            />
          ) : (
            <>
              <View style={width < spacing["bp-medium"] ? styles.addRow : styles.addRowWide}>
                <PrimaryButton label={wishlist("addWish")} onPress={openComposer} />
              </View>
              <View style={styles.grid}>
                {state.gifts.map((gift) => (
                  <WishCard key={gift.id} gift={gift} width={grid.cardWidth} />
                ))}
              </View>
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            onPress={signOut}
            style={({ pressed }) => [styles.logout, pressed ? styles.pressed : null]}
          >
            <Text style={styles.logoutLabel}>{wishlist("logout")}</Text>
          </Pressable>
          <AuthorLink />
        </View>
      </View>
      {toast ? <ToastHost message={toast} onDismiss={dismissToast} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  column: {
    flex: 1,
    width: "100%",
    maxWidth: spacing["max-wide"],
    alignSelf: "center",
    paddingTop: spacing["page-gutter"],
    gap: spacing["grid-gap"] / 2,
  },
  logo: {
    ...textStyle("display-sm"),
    color: colors.primary,
    textAlign: "center",
  },
  title: {
    ...textStyle("heading"),
    color: colors.foreground,
  },
  scrollArea: {
    flex: 1,
  },
  scroll: {
    paddingTop: spacing["grid-gap"] / 2,
    paddingBottom: spacing["section-gap"],
    gap: spacing["grid-gap"],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing["grid-gap"],
  },
  addRow: {
    width: "100%",
  },
  addRowWide: {
    alignSelf: "flex-end",
  },
  retry: {
    width: "100%",
    maxWidth: spacing["max-form"],
    alignSelf: "center",
    paddingVertical: spacing["section-gap"] / 2,
    gap: spacing["grid-gap"],
  },
  retryText: {
    ...textStyle("body"),
    color: colors["muted-foreground"],
    textAlign: "center",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing["page-gutter"],
  },
  logout: {
    minHeight: spacing["touch-target"],
    minWidth: spacing["touch-target"],
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.9,
  },
  logoutLabel: {
    ...textStyle("button"),
    color: colors.destructive,
  },
});
