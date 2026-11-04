import type { GiftCard } from "@gift-list/contracts";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { fetchMyGifts, updateGift } from "@/api/my-gifts";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { paramValue } from "@/session/return-path";
import { colors, spacing, textStyle } from "@/theme/tokens";
import { AuthorLink } from "@/ui/author-link";
import { cardGrid, pageGutter } from "@/ui/card-grid";
import { EmptyState } from "@/ui/empty-state";
import { restoreFocus, type ChipNode } from "@/ui/focus";
import { WishCard } from "@/ui/gift-card";
import { PrimaryButton } from "@/ui/primary-button";
import { WishCardSkeleton } from "@/ui/skeleton";
import { ToastHost } from "@/ui/toast";
import { VisibilityPicker } from "@/ui/visibility-picker";

/**
 * A failed read offers the retry view; UX-DR6 adds the toast. A missing list is its
 * own state: «Список не найден» is not an empty wishlist (EXPERIENCE → State Patterns).
 */
type ScreenState =
  | { status: "loading" }
  | { status: "ready"; gifts: GiftCard[] }
  | { status: "missing" }
  // Only a broken connection claims a network problem; other failed reads get the
  // generic body (EXPERIENCE → State Patterns → «Нет сети при загрузке / ошибка загрузки»).
  | { status: "error"; kind: "network" | "generic" };

const SKELETON_CARDS = [0, 1, 2];

/**
 * One toast at a time: a failed read is destructive, the composer's «Добавлено в
 * вишлист» confirmation is neutral.
 */
type ToastState = { message: string; tone: "info" | "error" };

/**
 * The one-shot params the form screens hand their success notices over in: the
 * create screen says «Добавлено в вишлист», the edit screen «Изменения сохранены.».
 * Both are neutral confirmations, so they show with the info tone.
 */
const CREATED_TOAST = "gift_created";
const UPDATED_TOAST = "gift_updated";
const DELETED_TOAST = "gift_deleted";

/**
 * The footer row («Выйти» + «Написать автору») is pinned to the bottom of the column.
 * The toast is lifted by exactly that row's height (`spacing.touch-target` plus
 * `spacing.page-gutter`), so it never covers «Выйти» (`DESIGN.md` → Toast: «снизу,
 * над прилипшей кнопкой»). The safe-area inset is already outside this box: both
 * live inside `SafeAreaView`.
 */
const FOOTER_CLEARANCE = spacing["touch-target"] + spacing["page-gutter"];

/**
 * «Мой вишлист» (Story 2.1): AD-7 owner branch through `api/v1`, so every own wish
 * comes back, including `SECRET`. The gift card is the shared AD-12 contract; the
 * screen only adds the owner chip, status pill and the empty/loading/error states.
 */
export default function MyWishlistScreen() {
  const t = useTranslations("app");
  const wishlist = useTranslations("app.myWishlist");
  const giftForm = useTranslations("app.giftForm");
  const common = useTranslations("common");
  const tLower = useTranslations("app.gift.visibilityLower");
  const brand = getBrandName();
  const auth = useAuth();
  const { width } = useWindowDimensions();
  // Review m7: the safe-area insets (a notch in landscape) are outside the column,
  // so the grid is measured against the width that is actually left for cards.
  const insets = useSafeAreaInsets();
  const grid = cardGrid(width, insets);
  const gutter = pageGutter(width);
  const params = useLocalSearchParams<{ toast?: string }>();
  const [state, setState] = useState<ScreenState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  // Story 2.3: the chip of an open wish opens the visibility dialog over the list.
  const [picker, setPicker] = useState<{ gift: GiftCard } | null>(null);
  // A second tap on the same chip while its PATCH is in flight is ignored.
  const saving = useRef(new Set<string>());
  // The chip node of every wish, so focus can return there after the dialog closes.
  const chipNodes = useRef(new Map<string, ChipNode | null>());
  // The chip that should get focus once the closed dialog has left the tree.
  const pendingFocus = useRef<string | null>(null);
  // Review m9: coming back to the screen (e.g. from the composer) refetches the list.
  // The mount effect owns the very first load, so the first focus right after mount is
  // not a reason to fetch again; a refocus refresh is silent (only `retry` shows the
  // skeleton) and its answer is dropped if the screen blurred before it arrived.
  const focused = useRef(true);
  const firstFocus = useRef(true);
  // The handed-over notice is one-shot: the param is cleared right after it is shown,
  // and this ref keeps the same value from showing it twice before that lands.
  const handledToast = useRef<string | null>(null);

  const ownerId = auth.state.status === "ready" ? auth.state.user.id : null;

  useFocusEffect(
    useCallback(() => {
      const first = firstFocus.current;
      firstFocus.current = false;
      focused.current = true;
      if (!first) setAttempt((value) => value + 1);
      return () => {
        focused.current = false;
      };
    }, []),
  );

  useEffect(() => {
    if (auth.state.status === "anonymous") {
      // The login screen owns the «Сессия закончилась» toast: it outlives this screen.
      router.replace({
        pathname: "/login",
        params: sessionExpired ? { next: "/", reason: "session_expired" } : { next: "/" },
      });
    }
  }, [auth.state.status, sessionExpired]);

  // The create and edit screens set their confirmation here instead of on themselves:
  // they unmount on the way back, so a toast of their own would never be seen (the same
  // hand-over the login screen gets in `?reason=`). The param is read once and cleared
  // right away, so a refocus — where the list refetches — does not show it again.
  useEffect(() => {
    const flash = paramValue(params.toast);
    if (flash === undefined) {
      // The param is gone (either cleared right after the notice, or never set): the
      // last shown notice is forgotten, so the next hand-over of the same value is a
      // new one. Without this the second create or edit in one list session is silent.
      handledToast.current = null;
      return;
    }
    if (
      handledToast.current === flash ||
      (flash !== CREATED_TOAST && flash !== UPDATED_TOAST && flash !== DELETED_TOAST)
    ) {
      return;
    }
    handledToast.current = flash;
    setToast({
      message:
        flash === CREATED_TOAST
          ? giftForm("toast.created")
          : flash === UPDATED_TOAST
            ? giftForm("toast.saved")
            : giftForm("toast.deleted"),
      tone: "info",
    });
    router.setParams({ toast: undefined });
  }, [params.toast, giftForm]);

  /**
   * The stored session is dead: `signOut` clears the token and marks the app anonymous,
   * and the guard above opens login with `?next=/&reason=session_expired`. A failed
   * sign-out leaves the screen mounted and returns `false`, so the caller decides what
   * to show.
   */
  async function expireSession(): Promise<boolean> {
    setSessionExpired(true);
    const signedOut = await auth.signOut();
    if (!signedOut.ok) setSessionExpired(false);
    return signedOut.ok;
  }

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    void (async () => {
      const result = await fetchMyGifts();
      // A refocus refresh that lost the screen, or a first load that outlived it, never
      // touches state (review m9).
      if (cancelled || !focused.current) return;
      if (result.ok) {
        setState(
          result.access === "not_found"
            ? { status: "missing" }
            : { status: "ready", gifts: result.gifts },
        );
        return;
      }
      if ("code" in result && result.code === "UNAUTHENTICATED") {
        const signedOut = await expireSession();
        // A failed sign-out leaves the screen mounted: show the retry view, not a skeleton.
        if (!signedOut && !cancelled && focused.current) {
          setState({ status: "error", kind: "network" });
          setToast({ message: t("form.network"), tone: "error" });
        }
        return;
      }
      if ("code" in result && result.code === "NOT_FOUND") {
        // The list behind the session is gone: «Список не найден», not an empty wishlist.
        setState({ status: "missing" });
        return;
      }
      // UX-DR6: a failure is never silent — the retry view and a toast. A body that
      // breaks the contract is not a network problem, so it gets the generic text.
      const network = "network" in result;
      // A silent refocus refresh that fails keeps the list already on screen: the toast
      // reports it, the cards stay (review m9 follow-up). A first load or «Повторить»
      // reach this point with the skeleton up, so they still get the retry view.
      setState((current) =>
        current.status === "ready"
          ? current
          : { status: "error", kind: network ? "network" : "generic" },
      );
      setToast({
        message: network
          ? t("form.network")
          : "invalid" in result
            ? common("errors.generic")
            : common(`errors.code.${result.code}`),
        tone: "error",
      });
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

  function openEditor(id: string) {
    // Story 2.2: the owner card is the way into the edit form.
    router.push({ pathname: "/gifts/[id]/edit", params: { id } });
  }

  function signOut() {
    void (async () => {
      const result = await auth.signOut();
      if (!result.ok) setToast({ message: t("form.network"), tone: "error" });
    })();
  }

  function openVisibilityPicker(gift: GiftCard) {
    // A second tap while the save is in flight must not open the dialog again over
    // the optimistic value.
    if (saving.current.has(gift.id)) return;
    setPicker({ gift });
  }

  function closePicker(id: string) {
    // The focus call itself waits for the dialog's own `onClosed`: the layer is still
    // in the tree while it fades out (see `useLayerClosed`).
    pendingFocus.current = id;
    setPicker(null);
  }

  /**
   * `DESIGN.md` → VisibilityChip: the dialog reports its closing, and the chip that
   * opened it gets focus back. Every close goes through `closePicker`, so the target is
   * always known; a repeated report finds nothing pending and changes nothing.
   */
  function returnFocusToChip() {
    const id = pendingFocus.current;
    if (id === null) return;
    pendingFocus.current = null;
    restoreFocus(chipNodes.current.get(id));
  }

  function cancelPicker() {
    if (picker) closePicker(picker.gift.id);
  }

  /** Touches only this card, so a focus refetch that landed meanwhile keeps the list. */
  function setGiftVisibility(id: string, visibility: GiftCard["visibility"]) {
    setState((current) =>
      current.status === "ready"
        ? {
            ...current,
            gifts: current.gifts.map((item) =>
              item.id === id ? { ...item, visibility } : item,
            ),
          }
        : current,
    );
  }

  function replaceGift(gift: GiftCard) {
    setState((current) =>
      current.status === "ready"
        ? {
            ...current,
            gifts: current.gifts.map((item) => (item.id === gift.id ? gift : item)),
          }
        : current,
    );
  }

  /**
   * `EXPERIENCE.md` → Visibility chip: the choice is saved at once (optimistic), the
   * success toast names the new value, and a failure rolls the chip back. The wish is
   * frozen once reserved (VALIDATION) or gone (NOT_FOUND): then the list reloads
   * silently so the card shows its real status.
   */
  async function changeVisibility(gift: GiftCard, next: GiftCard["visibility"]) {
    if (saving.current.has(gift.id)) return;
    saving.current.add(gift.id);
    const previous = gift.visibility;
    closePicker(gift.id);
    setGiftVisibility(gift.id, next);
    try {
      const result = await updateGift(gift.id, { visibility: next });
      if (result.ok) {
        replaceGift(result.gift);
        setToast({
          message: t("gift.toast.visibility", { value: tLower(next) }),
          tone: "info",
        });
        return;
      }
      setGiftVisibility(gift.id, previous);
      if ("code" in result && result.code === "UNAUTHENTICATED") {
        const signedOut = await expireSession();
        if (!signedOut) setToast({ message: t("form.network"), tone: "error" });
        return;
      }
      if ("code" in result && result.code === "VALIDATION") {
        setToast({ message: t("gift.toast.visibilityLocked"), tone: "error" });
        setAttempt((value) => value + 1);
        return;
      }
      if ("code" in result && result.code === "NOT_FOUND") {
        setToast({ message: common("errors.code.NOT_FOUND"), tone: "error" });
        setAttempt((value) => value + 1);
        return;
      }
      setToast({
        message:
          "network" in result
            ? t("form.network")
            : "invalid" in result
              ? common("errors.generic")
              : common(`errors.code.${result.code}`),
        tone: "error",
      });
    } finally {
      saving.current.delete(gift.id);
    }
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
              <Text style={styles.retryText}>
                {state.kind === "network"
                  ? wishlist("loadError")
                  : wishlist("loadErrorGeneric")}
              </Text>
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
              {/* Review m5: the grid is a list for assistive tech; `role` is the DOM
                  role alias React Native forwards on web and maps on native. */}
              <View role="list" style={styles.grid}>
                {state.gifts.map((gift) => (
                  <WishCard
                    key={gift.id}
                    gift={gift}
                    width={grid.cardWidth}
                    onPress={() => openEditor(gift.id)}
                    onVisibilityPress={() => openVisibilityPicker(gift)}
                    visibilityChipRef={(node) => {
                      chipNodes.current.set(gift.id, node);
                    }}
                  />
                ))}
              </View>
            </>
          )}
        </ScrollView>

        <View testID="wishlist-footer" style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            testID="wishlist-logout"
            onPress={signOut}
            style={({ pressed }) => [styles.logout, pressed ? styles.pressed : null]}
          >
            <Text style={styles.logoutLabel}>{wishlist("logout")}</Text>
          </Pressable>
          <AuthorLink />
        </View>
      </View>
      <VisibilityPicker
        visible={picker !== null}
        title={picker?.gift.title ?? ""}
        value={picker?.gift.visibility ?? "PUBLIC"}
        onSelect={(next) => {
          if (picker) void changeVisibility(picker.gift, next);
        }}
        onClose={cancelPicker}
        onClosed={returnFocusToChip}
      />
      {toast ? (
        <ToastHost
          message={toast.message}
          tone={toast.tone}
          onDismiss={dismissToast}
          offsetBottom={FOOTER_CLEARANCE}
        />
      ) : null}
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
