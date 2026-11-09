import type { GiftCard } from "@gift-list/contracts";
import {
  Button,
  Column,
  Heading,
  InfoButton,
  LoadingCards,
  PageContainer,
  PageScroll,
  Pressable,
  Screen,
  spacing,
  Text,
  XStack,
  YStack,
} from "@gift-list/ui";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { fetchMyGifts, updateGift } from "@/api/my-gifts";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { paramValue } from "@/session/return-path";
import { cardGrid, pageGutter } from "@/ui/card-grid";
import { EmptyState } from "@/ui/empty-state";
import { restoreFocus, type ChipNode } from "@/ui/focus";
import { WishCard } from "@/ui/gift-card";
import { PrimaryButton } from "@/ui/primary-button";
import { SessionErrorScreen } from "@/ui/session-error-screen";
import { SessionLoadingScreen } from "@/ui/session-loading-screen";
import { SiteFooter } from "@/ui/site-footer";
import { ToastHost } from "@/ui/toast";
import { VisibilityPicker } from "@/ui/visibility-picker";
import { copyWishlistShareLink } from "@/wishlist/copy-link";
import { hasWishVisibleToEveryone } from "@/wishlist/share-availability";

/**
 * A failed read offers the retry view; UX-DR6 adds the toast. A missing list is its
 * own state: «Список не найден» is not an empty wishlist (EXPERIENCE → State Patterns).
 */
type ScreenState =
  | { status: "loading" }
  // Story 2.4: the owner answer also carries the immutable `publicToken` (AD-6);
  // it is `null` when the server omits it, so the screen has no link to copy.
  | { status: "ready"; gifts: GiftCard[]; publicToken: string | null }
  | { status: "missing" }
  // Only a broken connection claims a network problem; other failed reads get the
  // generic body (EXPERIENCE → State Patterns → «Нет сети при загрузке / ошибка загрузки»).
  | { status: "error"; kind: "network" | "generic" };

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

/** The id that ties the disabled copy button to its visible reason. */
const COPY_LINK_REASON_ID = "wishlist-copy-link-reason";

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
    useCallback(function refreshOnFocus() {
      const first = firstFocus.current;
      firstFocus.current = false;
      focused.current = true;
      if (!first) setAttempt((value) => value + 1);
      return function markBlurred() {
        focused.current = false;
      };
    }, []),
  );

  useEffect(function redirectAnonymous() {
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
  useEffect(function showHandedOverToast() {
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

  useEffect(function loadGifts() {
    if (!ownerId) return;
    let cancelled = false;

    async function requestGifts() {
      const result = await fetchMyGifts();
      // A refocus refresh that lost the screen, or a first load that outlived it, never
      // touches state (review m9).
      if (cancelled || !focused.current) return;
      if (result.ok) {
        setState(
          result.access === "not_found"
            ? { status: "missing" }
            : { status: "ready", gifts: result.gifts, publicToken: result.publicToken },
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
    }

    void requestGifts();
    return function stopLoad() {
      cancelled = true;
    };
    // `auth` is only read on the expired-session branch; re-running the fetch on
    // every auth context update would refetch the list for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, attempt]);

  if (auth.state.status === "error") {
    return <SessionErrorScreen onRetry={auth.retry} />;
  }

  if (auth.state.status !== "ready") {
    return <SessionLoadingScreen />;
  }

  function retry() {
    setToast(null);
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }

  function dismissToast() {
    setToast(null);
  }

  /**
   * Story 2.4 (FR-28): one button, one URL, no share-sheet. UI2: the link is only
   * offered when the public read would show at least one wish (AD-7: an unarchived
   * `PUBLIC`), so an empty or private-only list cannot create or copy a useless URL.
   */
  const canShare = state.status === "ready" && hasWishVisibleToEveryone(state.gifts);

  async function copyLink() {
    if (state.status !== "ready" || !hasWishVisibleToEveryone(state.gifts)) return;
    const token = state.publicToken;
    const result = await copyWishlistShareLink(token);
    setToast({
      message: result === "copied" ? wishlist("copyLinkDone") : wishlist("copyLinkFailed"),
      tone: result === "copied" ? "info" : "error",
    });
  }

  function openComposer() {
    // NOTE FOR UX: маршрут формы желания появляется со Story 2.2.
    router.push("/gifts/new");
  }

  function openEditor(id: string) {
    // Story 2.2: the owner card is the way into the edit form.
    router.push({ pathname: "/gifts/[id]/edit", params: { id } });
  }

  async function endSession() {
    const result = await auth.signOut();
    if (!result.ok) setToast({ message: t("form.network"), tone: "error" });
  }

  function signOut() {
    void endSession();
  }

  function openVisibilityPicker(gift: GiftCard) {
    // A second tap while the save is in flight must not open the dialog again over
    // the optimistic value.
    if (saving.current.has(gift.id)) return;
    setPicker({ gift });
  }

  function closePicker(id: string) {
    // The focus call itself waits for the dialog's own `onClosed`: the layer is still
    // in the tree while it fades out.
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

  function openSettings() {
    // NOTE FOR UX: временный вход в «Настройки» до Story 6.2, где они появятся
    // в «Профиле» (DESIGN.md:443, UX-A13).
    router.push("/settings");
  }

  function handleVisibilitySelect(next: GiftCard["visibility"]) {
    if (picker) void changeVisibility(picker.gift, next);
  }

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <Stack.Screen options={{ title: wishlist("pageTitle", { brand }) }} />
        <PageScroll testID="wishlist-page">
          <PageContainer>
            <Column
              size="wide"
              flexGrow={1}
              paddingHorizontal={gutter}
              paddingTop="$page-gutter"
              gap="$2"
            >
              <Text kind="display-sm" tone="primary" textAlign="center">
                {common("brandName", { brand })}
              </Text>
              <Heading level={1}>{wishlist("title")}</Heading>

              <YStack
                flexGrow={1}
                paddingTop={spacing["grid-gap"] / 2}
                paddingBottom={spacing["section-gap"]}
                gap={spacing["grid-gap"]}
              >
                {/* DESIGN.md → App → «Широкий экран»: the owner's buttons sit in a row
                    above the grid, to the right. Story 2.4 adds «Скопировать ссылку». */}
                {state.status === "ready" ? (
                  <YStack
                    testID="wishlist-actions"
                    gap="$1"
                    {...(width < spacing["bp-medium"]
                      ? { width: "100%" }
                      : { alignSelf: "flex-end" })}
                  >
                    <XStack
                      flexWrap="wrap"
                      alignItems="center"
                      gap="$2"
                      {...(width < spacing["bp-medium"]
                        ? { width: "100%" }
                        : { alignSelf: "flex-end" })}
                    >
                      {state.gifts.length > 0 ? (
                        <PrimaryButton label={wishlist("addWish")} onPress={openComposer} />
                      ) : null}
                      <Button
                        testID="wishlist-copy-link"
                        label={wishlist("copyLink")}
                        ariaDescribedBy={canShare ? undefined : COPY_LINK_REASON_ID}
                        onPress={copyLink}
                        disabled={!canShare}
                        focusableWhenDisabled
                      />
                      <InfoButton
                        testID="wishlist-copy-link-info"
                        label={wishlist("copyLinkHelpLabel")}
                        explanation={wishlist("copyLinkHelp")}
                        closeLabel={wishlist("copyLinkHelpClose")}
                      />
                    </XStack>
                    {!canShare ? (
                      <Text
                        id={COPY_LINK_REASON_ID}
                        testID="wishlist-copy-link-reason"
                        kind="caption"
                        tone="muted"
                        textAlign={width < spacing["bp-medium"] ? "left" : "right"}
                      >
                        {wishlist("copyLinkDisabledReason")}
                      </Text>
                    ) : null}
                  </YStack>
                ) : null}
                {state.status === "loading" ? (
                  <LoadingCards
                    testID="my-wishlist-loading"
                    label={wishlist("loading")}
                    width={grid.cardWidth}
                  />
                ) : state.status === "error" ? (
                  <RetryView
                    text={
                      state.kind === "network" ? wishlist("loadError") : wishlist("loadErrorGeneric")
                    }
                    label={wishlist("retry")}
                    onPress={retry}
                  />
                ) : state.status === "missing" ? (
                  <RetryView
                    text={wishlist("listNotFound")}
                    label={wishlist("retry")}
                    onPress={retry}
                  />
                ) : state.gifts.length === 0 ? (
                  <EmptyState
                    title={wishlist("emptyTitle")}
                    body={wishlist("emptyText")}
                    action={<PrimaryButton label={wishlist("addWish")} onPress={openComposer} />}
                  />
                ) : (
                  // Review m5: the grid is a list for assistive tech.
                  <XStack role="list" flexWrap="wrap" gap="$grid-gap">
                    {state.gifts.map((gift) => {
                      function handlePress() {
                        openEditor(gift.id);
                      }

                      function handleVisibilityPress() {
                        openVisibilityPicker(gift);
                      }

                      function setChipNode(node: ChipNode | null) {
                        chipNodes.current.set(gift.id, node);
                      }

                      return (
                        <WishCard
                          key={gift.id}
                          gift={gift}
                          width={grid.cardWidth}
                          onPress={handlePress}
                          onVisibilityPress={handleVisibilityPress}
                          visibilityChipRef={setChipNode}
                        />
                      );
                    })}
                  </XStack>
                )}
              </YStack>

              <SiteFooter
                actions={
                  <>
                    <Pressable
                      role="button"
                      testID="wishlist-logout"
                      onPress={signOut}
                      minHeight="$touch-target"
                      minWidth="$touch-target"
                      justifyContent="center"
                    >
                      <Text kind="button" tone="destructive">
                        {wishlist("logout")}
                      </Text>
                    </Pressable>
                    {/* Temporary entry point: the settings live in «Профиль» from Story 6.2. */}
                    <Pressable
                      role="button"
                      testID="wishlist-settings"
                      onPress={openSettings}
                      minHeight="$touch-target"
                      minWidth="$touch-target"
                      justifyContent="center"
                    >
                      <Text kind="button" tone="primary">
                        {wishlist("settings")}
                      </Text>
                    </Pressable>
                  </>
                }
              />
            </Column>
          </PageContainer>
        </PageScroll>
        <VisibilityPicker
          visible={picker !== null}
          title={picker?.gift.title ?? ""}
          value={picker?.gift.visibility ?? "PUBLIC"}
          onSelect={handleVisibilitySelect}
          onClose={cancelPicker}
          onClosed={returnFocusToChip}
        />
        {toast ? (
          <ToastHost message={toast.message} tone={toast.tone} onDismiss={dismissToast} />
        ) : null}
      </SafeAreaView>
    </Screen>
  );
}

MyWishlistScreen.displayName = "MyWishlistScreen";

/** A failed or missing list: one line of text and the retry button. */
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
