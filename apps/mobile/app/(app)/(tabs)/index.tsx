import { formatDate, type GiftCard, type GiftTagInput } from "@gift-list/contracts";
import {
  Button,
  Column,
  DateField,
  Dialog,
  Heading,
  InfoButton,
  LoadingCards,
  PageContainer,
  PageScroll,
  Pressable,
  SafeArea,
  Screen,
  Text,
  XStack,
  YStack,
} from "@gift-list/ui";
import { Link, router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import {
  closeGift,
  createGift,
  deleteGift,
  fetchMyGifts,
  restoreGift,
  undoGiftClose,
} from "@/api/my-gifts";
import { NotificationBell } from "@/ui/notification-bell";
import { getBrandName } from "@/config/env";
import { copyMyInviteLink } from "@/invite/copy-link";
import { useAuth } from "@/session/auth-context";
import { mutationErrorMessage, signOutErrorMessage } from "@/session/form-issue";
import { paramValue } from "@/session/return-path";
import { CardGridList } from "@/ui/card-grid-list";
import { ClosedSection } from "@/ui/closed-section";
import { CloseGiftConfirm } from "@/ui/close-gift-confirm";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { deviceToday } from "@/ui/device-today";
import { EmptyState } from "@/ui/empty-state";
import { focusInLayer, restoreFocus, type ChipNode, type FocusTarget } from "@/ui/focus";
import { GiftCardMenu, type GiftCardMenuAction } from "@/ui/gift-card-menu";
import { WishCard } from "@/ui/gift-card";
import { SessionErrorScreen } from "@/ui/session-error-screen";
import { SessionLoadingScreen } from "@/ui/session-loading-screen";
import { SiteFooter } from "@/ui/site-footer";
import { ToastHost } from "@/ui/toast";
import { useCardGrid } from "@/ui/use-card-grid";
import { useUndoWindow } from "@/ui/use-undo-window";
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
  | {
      status: "ready";
      gifts: GiftCard[];
      archived: GiftCard[];
      /** Full archive size when the server caps the list; `null` means `archived.length`. */
      archivedTotal: number | null;
      publicToken: string | null;
    }
  | { status: "missing" }
  // Only a broken connection claims a network problem; other failed reads get the
  // generic body (EXPERIENCE → State Patterns → «Нет сети при загрузке / ошибка загрузки»).
  | { status: "error"; kind: "network" | "generic" };

/**
 * One toast at a time: a failed read is destructive, the composer's «Добавлено в
 * вишлист» confirmation is neutral. Story 5.3 adds the undo toast of a closed
 * wish: it lives 10 s (`DESIGN.md` → Toast), carries the «Отменить» action and
 * moves focus onto it.
 */
type ToastState = {
  message: string;
  tone: "info" | "error";
  action?: { label: string; onPress: () => void };
  durationMs?: number;
  /** The closing toast: focus goes onto «Отменить» once it is on screen. */
  focusAction?: boolean;
};

/** `DESIGN.md` → Toast: the undo toast of a closed wish lives ten seconds. */
const UNDO_TOAST_MS = 10_000;

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
 * screen only adds the status pill and the empty/loading/error states, and makes
 * every card a link to the wish page `/gifts/{id}` (CLE-129, T4.4).
 */
export default function MyWishlistScreen() {
  const t = useTranslations("app");
  const wishlist = useTranslations("app.myWishlist");
  const locale = useLocale();
  const invite = useTranslations("app.invite");
  const giftForm = useTranslations("app.giftForm");
  const common = useTranslations("common");
  const brand = getBrandName();
  const auth = useAuth();
  // W12.19: the page gutter is the Tamagui media clause
  // `$page-gutter medium:$page-gutter-lg`, so the browser lays it out with a CSS
  // media query and the phone reads the same theme key.
  // W12.23: the column count and the card width (`DESIGN.md` → Layout → columns) are
  // grid math, so on the web they follow the measured content area, not the window:
  // a classic scrollbar makes the window wider than this section by its own width.
  // The container is measured before it is painted; until then the hook keeps
  // `cardGrid(windowWidth, insets)` — the phone's numbers.
  // Destructured: React's `refs` lint rule treats an object that holds a ref callback
  // as a ref, and a member read of it during render is an error.
  const { cardWidth, attachContainer } = useCardGrid();
  const params = useLocalSearchParams<{ toast?: string }>();
  const [state, setState] = useState<ScreenState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const [archiveMenu, setArchiveMenu] = useState<GiftCard | null>(null);
  // Story 5.3: «Получено (N)» is closed until the owner opens it.
  const [closedExpanded, setClosedExpanded] = useState(false);
  // Story 5.3: the ⋯ menu of one card. `pendingMenuAction` is the chosen item:
  // it runs after the menu has left the tree, so a confirm does not open over a
  // fading layer.
  const [cardMenu, setCardMenu] = useState<GiftCard | null>(null);
  const pendingMenuAction = useRef<(() => void) | null>(null);
  const menuReturn = useRef<string | null>(null);
  const menuNodes = useRef(new Map<string, ChipNode | null>());
  // Story 5.3: closing a wish from the card asks first.
  const [closeConfirm, setCloseConfirm] = useState<GiftCard | null>(null);
  const [closeBusy, setCloseBusy] = useState(false);
  // Story 5.3: deleting a closed wish is the existing DELETE behind a confirm.
  const [deleteConfirm, setDeleteConfirm] = useState<GiftCard | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const deleteInFlight = useRef(false);
  // The «Отменить» button of the undo toast: the screen moves focus onto it.
  const toastAction = useRef<FocusTarget | null>(null);
  const [restoreStep, setRestoreStep] = useState(false);
  const [restoreDate, setRestoreDate] = useState("");
  const [restoreError, setRestoreError] = useState<string | undefined>();
  const [archiveBusy, setArchiveBusy] = useState(false);
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
  // Story 5.3: the undo window of the card whose ⋯ menu is open. The server owns
  // the moment (`undoUntil`), the hook only counts the rest of it.
  const closedMenuWindow = useUndoWindow(
    cardMenu?.status === "CLOSED" ? cardMenu.undoUntil : null,
  );

  // The closing toast lands focus on «Отменить» (`DESIGN.md` → «Куда уходит
  // фокус», пункт «а»). The toast is on screen by the time the effect runs.
  useEffect(
    function focusUndoAction() {
      if (!toast?.focusAction) return;
      focusInLayer(toastAction.current);
    },
    [toast],
  );

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

  // AD-30: `(tabs)` is the anchor under a deep link. While a public screen, such
  // as the wishlist of a link, sits above it, this screen is mounted but not
  // focused, and a guest must not be sent from that screen to login.
  useFocusEffect(
    useCallback(
      function redirectAnonymous() {
        if (auth.state.status === "anonymous") {
          // The login screen owns the «Сессия закончилась» toast: it outlives this screen.
          router.replace({
            pathname: "/login",
            params: sessionExpired ? { next: "/", reason: "session_expired" } : { next: "/" },
          });
        }
      },
      [auth.state.status, sessionExpired],
    ),
  );

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
   * sign-out leaves the screen mounted and returns the error, so the caller decides what
   * to show.
   */
  async function expireSession() {
    setSessionExpired(true);
    const signedOut = await auth.signOut();
    if (!signedOut.ok) setSessionExpired(false);
    return signedOut;
  }

  useEffect(function loadGifts() {
    // The tabs are the anchor under a deep link (AD-30): mounted, but not
    // focused, and they must not read the owner's wishlist behind another screen.
    if (!ownerId || !focused.current) return;
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
            : {
                status: "ready",
                gifts: result.gifts,
                archived: result.archived ?? [],
                archivedTotal: result.archivedTotal ?? null,
                publicToken: result.publicToken,
              },
        );
        return;
      }
      if ("code" in result && result.code === "UNAUTHENTICATED") {
        const signedOut = await expireSession();
        // A failed sign-out leaves the screen mounted: show the retry view, not a skeleton.
        if (!signedOut.ok && !cancelled && focused.current) {
          setState({ status: "error", kind: "network" in signedOut ? "network" : "generic" });
          setToast({ message: signOutErrorMessage(signedOut, t("form.network"), common), tone: "error" });
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

  /**
   * Story 4.7 (AD-21): the invite link is `{origin}/i/{token}` and does not
   * depend on what the public list shows, so it stays available in an empty or a
   * private-only wishlist. The token is read on the press, never on load.
   */
  async function copyInvite() {
    const result = await copyMyInviteLink();
    setToast({
      message: result === "copied" ? invite("copyDone") : wishlist("copyLinkFailed"),
      tone: result === "copied" ? "info" : "error",
    });
  }

  function handleCopyInvite() {
    void copyInvite();
  }

  function openComposer() {
    // NOTE FOR UX: маршрут формы желания появляется со Story 2.2.
    router.push("/gifts/new");
  }

  /**
   * Story 5.3: one transition `OPEN | RESERVED → CLOSED` of the card's ⋯ menu.
   * The answer is the owner's card with `undoUntil`; the list is reread and the
   * undo toast opens with focus on «Отменить». A broken connection keeps the
   * confirm open, so the person can try again or cancel.
   */
  async function runClose(gift: GiftCard) {
    setCloseBusy(true);
    const result = await closeGift(gift.id);
    setCloseBusy(false);
    if (result.ok) {
      setCloseConfirm(null);
      setAttempt((value) => value + 1);
      showClosedToast(gift.id);
      return;
    }
    if ("network" in result) {
      setToast({ message: t("form.network"), tone: "error" });
      return;
    }
    setCloseConfirm(null);
    if ("invalid" in result) {
      setToast({ message: common("errors.generic"), tone: "error" });
      return;
    }
    if (result.code === "UNAUTHENTICATED") {
      await expireSession();
      return;
    }
    setToast({ message: mutationErrorMessage(result, common), tone: "error" });
    if (result.code === "CONFLICT" || result.code === "NOT_FOUND" || result.code === "VALIDATION") {
      setAttempt((value) => value + 1);
    }
  }

  /** «Отмечено полученным · Отменить»: ten seconds, focus on the action. */
  function showClosedToast(id: string) {
    setToast({
      message: t("gift.toast.closed"),
      tone: "info",
      action: {
        label: t("gift.toast.undo"),
        onPress: function undoFromToast() {
          void undoClosed(id);
        },
      },
      durationMs: UNDO_TOAST_MS,
      focusAction: true,
    });
  }

  /**
   * «Вернуть в открытые» из тоста или ⋯ карточки. The server owns the window: a
   * late undo answers `CONFLICT` with `UNDO_WINDOW_EXPIRED`, so the person reads
   * «Время на отмену вышло» and the list is reread. A success shows no second
   * toast: the card simply returns to the active grid.
   */
  async function undoClosed(id: string) {
    const result = await undoGiftClose(id);
    if (result.ok) {
      setToast(null);
      setAttempt((value) => value + 1);
      return;
    }
    if ("network" in result) {
      setToast({ message: t("form.network"), tone: "error" });
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
    setToast({
      message:
        result.reason === "UNDO_WINDOW_EXPIRED"
          ? common("errors.reason.UNDO_WINDOW_EXPIRED")
          : mutationErrorMessage(result, common),
      tone: "error",
    });
    setAttempt((value) => value + 1);
  }

  /** The ⋯ of one card: the menu layer is owned by the screen, like the archive one. */
  function openCardMenu(gift: GiftCard) {
    menuReturn.current = gift.id;
    setCardMenu(gift);
  }

  function closeCardMenu() {
    setCardMenu(null);
  }

  function menuNodeFor(gift: GiftCard) {
    return function rememberMenuNode(node: ChipNode | null) {
      menuNodes.current.set(gift.id, node);
    };
  }

  /**
   * The menu has left the tree: focus goes back to its ⋯ and only then the chosen
   * item runs. A confirm therefore opens over no fading layer.
   */
  function cardMenuClosed() {
    const id = menuReturn.current;
    menuReturn.current = null;
    const action = pendingMenuAction.current;
    pendingMenuAction.current = null;
    if (id !== null) restoreFocus(menuNodes.current.get(id));
    if (action) action();
  }

  /** A pressed item closes the menu first; its work waits for `cardMenuClosed`. */
  function chooseMenuAction(action: GiftCardMenuAction) {
    pendingMenuAction.current = action.onPress;
    setCardMenu(null);
  }

  function openCloseConfirm(gift: GiftCard) {
    setCloseConfirm(gift);
  }

  function cancelCloseConfirm() {
    if (closeBusy) return;
    setCloseConfirm(null);
  }

  function confirmCloseFromCard() {
    if (!closeConfirm || closeBusy) return;
    void runClose(closeConfirm);
  }

  /**
   * Story 5.3 / FR-32: «Хочу ещё такой» — an ordinary `OPEN` copy through the
   * existing create route, without `expiresOn` (the copy does not inherit the old
   * date). One list (AD-6), so there is no chooser; the list is reread.
   */
  async function copyClosed(gift: GiftCard) {
    const tags = tagsFromCard(gift);
    const result = await createGift({
      title: gift.title,
      description: gift.description,
      linkUrl: gift.linkUrl,
      priceAmount: gift.priceAmount,
      priceCurrency: gift.priceCurrency,
      visibility: gift.visibility,
      quantity: gift.quantity,
      ...(tags.length > 0 ? { tags } : {}),
    });
    if (result.ok) {
      setToast({ message: giftForm("toast.created"), tone: "info" });
      setAttempt((value) => value + 1);
      return;
    }
    if (await handleArchiveSessionLoss(result)) return;
    if ("network" in result) {
      setToast({ message: t("form.network"), tone: "error" });
      return;
    }
    if ("invalid" in result) {
      setToast({ message: common("errors.generic"), tone: "error" });
      return;
    }
    setToast({ message: mutationErrorMessage(result, common), tone: "error" });
  }

  /** The existing `DELETE` deletes a closed wish; the confirm names it. */
  async function confirmDeleteClosed() {
    const gift = deleteConfirm;
    if (!gift || deleteInFlight.current) return;
    deleteInFlight.current = true;
    setDeleteBusy(true);
    const result = await deleteGift(gift.id);
    deleteInFlight.current = false;
    setDeleteBusy(false);
    if (result.ok) {
      setDeleteConfirm(null);
      setToast({ message: giftForm("toast.deleted"), tone: "info" });
      setAttempt((value) => value + 1);
      return;
    }
    setDeleteConfirm(null);
    if ("network" in result) {
      setToast({ message: t("form.network"), tone: "error" });
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
    setAttempt((value) => value + 1);
  }

  function cancelDeleteClosed() {
    if (deleteBusy) return;
    setDeleteConfirm(null);
  }

  /**
   * Story 5.3: the items of the ⋯ menu. An active wish can be marked received; a
   * closed one can be returned (only while the server window is open), copied or
   * deleted. A viewer never gets this menu.
   *
   * D-49 (CLE-124): the owner does not know about reservations, so the menu has no
   * release item and the same actions serve an open and a reserved wish.
   */
  function cardMenuActionsFor(gift: GiftCard): GiftCardMenuAction[] {
    if (gift.status !== "CLOSED") {
      return [
        {
          key: "received",
          label: t("gift.close.menuAction"),
          onPress: function askClose() {
            openCloseConfirm(gift);
          },
        },
      ];
    }
    const actions: GiftCardMenuAction[] = [];
    if (closedMenuWindow.open) {
      actions.push({
        key: "undo",
        label: t("gift.closed.undoWithTime", { minutes: closedMenuWindow.minutes }),
        onPress: function askUndo() {
          void undoClosed(gift.id);
        },
      });
    }
    actions.push({
      key: "copy",
      label: t("gift.closed.copy"),
      onPress: function askCopy() {
        void copyClosed(gift);
      },
    });
    actions.push({
      key: "delete",
      label: t("gift.closed.delete"),
      destructive: true,
      onPress: function askDelete() {
        setDeleteConfirm(gift);
      },
    });
    return actions;
  }

  function closeArchiveMenu() {
    setArchiveMenu(null);
    setRestoreStep(false);
    setRestoreDate("");
    setRestoreError(undefined);
  }

  function openArchiveMenu(gift: GiftCard) {
    setArchiveMenu(gift);
    setRestoreStep(false);
    setRestoreDate("");
    setRestoreError(undefined);
  }

  function toggleArchive() {
    setArchiveExpanded((open) => !open);
  }

  async function copyArchived() {
    if (!archiveMenu || archiveBusy) return;
    setArchiveBusy(true);
    const tags = tagsFromCard(archiveMenu);
    const result = await createGift({
      title: archiveMenu.title,
      description: archiveMenu.description,
      linkUrl: archiveMenu.linkUrl,
      priceAmount: archiveMenu.priceAmount,
      priceCurrency: archiveMenu.priceCurrency,
      visibility: archiveMenu.visibility,
      quantity: archiveMenu.quantity,
      ...(tags.length > 0 ? { tags } : {}),
    });
    setArchiveBusy(false);
    if (result.ok) {
      const gift = result.gift;
      setState(function addCopy(current) {
        if (current.status !== "ready") return current;
        return { ...current, gifts: [gift, ...current.gifts] };
      });
      setToast({ message: giftForm("toast.created"), tone: "info" });
      closeArchiveMenu();
      return;
    }
    if (await handleArchiveSessionLoss(result)) return;
    if ("network" in result) {
      setToast({ message: t("form.network"), tone: "error" });
      return;
    }
    setToast({ message: giftForm("error.form"), tone: "error" });
  }

  /** `UNAUTHENTICATED` from an archive action ends the session, like the edit screen. */
  async function handleArchiveSessionLoss(result: object): Promise<boolean> {
    if (!("code" in result) || result.code !== "UNAUTHENTICATED") return false;
    const signedOut = await expireSession();
    if (!signedOut.ok) setToast({ message: signOutErrorMessage(signedOut, t("form.network"), common), tone: "error" });
    return true;
  }

  async function submitRestore() {
    if (!archiveMenu || archiveBusy) return;
    setArchiveBusy(true);
    const result = await restoreGift(archiveMenu.id, restoreDate === "" ? null : restoreDate);
    setArchiveBusy(false);
    if (result.ok) {
      const gift = result.gift;
      setState(function moveRestored(current) {
        if (current.status !== "ready") return current;
        return {
          ...current,
          archived: current.archived.filter(function stillArchived(item) {
            return item.id !== gift.id;
          }),
          archivedTotal: current.archivedTotal === null ? null : current.archivedTotal - 1,
          gifts: [gift, ...current.gifts.filter(function notRestored(item) {
            return item.id !== gift.id;
          })],
        };
      });
      closeArchiveMenu();
      return;
    }
    if (await handleArchiveSessionLoss(result)) return;
    if ("network" in result) {
      setToast({ message: t("form.network"), tone: "error" });
      return;
    }
    if ("code" in result && result.code === "NOT_FOUND") {
      const missingId = archiveMenu.id;
      setState(function dropMissing(current) {
        if (current.status !== "ready") return current;
        return {
          ...current,
          archived: current.archived.filter(function notMissing(item) {
            return item.id !== missingId;
          }),
          archivedTotal: current.archivedTotal === null ? null : current.archivedTotal - 1,
        };
      });
      closeArchiveMenu();
      setToast({ message: common("errors.code.NOT_FOUND"), tone: "error" });
      // The wish was restored elsewhere: reread the list, as the edit screen does.
      setAttempt((value) => value + 1);
      return;
    }
    if (!("network" in result) && !("invalid" in result) && result.field === "expiresOn") {
      setRestoreError(giftForm("error.expiresOnPast"));
      return;
    }
    setToast({ message: giftForm("error.form"), tone: "error" });
  }

  /** The owner's ⋯: a sibling of the card button, so a press never opens the details. */
  function cardMenuTrigger(gift: GiftCard) {
    function handlePress() {
      openCardMenu(gift);
    }

    return (
      <Pressable
        ref={menuNodeFor(gift)}
        role="button"
        aria-label={t("gift.closed.menuLabel")}
        aria-haspopup="dialog"
        onPress={handlePress}
        width="$touch-target"
        height="$touch-target"
        alignItems="center"
        justifyContent="center"
        testID={`wishlist-card-menu-${gift.id}`}
      >
        <Text aria-hidden>⋯</Text>
      </Pressable>
    );
  }

  /**
   * One card of the active grid or of «Получено (N)»: both open the wish page
   * `/gifts/{id}` (CLE-129, T4.4). The router's `Link` hands `href` and `onPress`
   * to the card, so the web gets a real `<a href>` — a new tab works — while a
   * plain click stays in the app.
   */
  function renderGiftCard(gift: GiftCard) {
    return (
      <Link
        key={gift.id}
        href={{ pathname: "/gifts/[id]", params: { id: gift.id } }}
        asChild
      >
        <WishCard
          gift={gift}
          width={cardWidth}
          menu={cardMenuTrigger(gift)}
        />
      </Link>
    );
  }

  // Story 5.3: the client splits the one list (AD-6) into active and closed cards;
  // an archived wish is read from its own key and never reaches «Получено» (the
  // archive is more important, `DESIGN.md` → Archive section).
  const activeGifts =
    state.status === "ready"
      ? state.gifts.filter(function notClosed(item) {
          return item.status !== "CLOSED";
        })
      : [];
  const closedGifts =
    state.status === "ready"
      ? state.gifts.filter(function onlyClosed(item) {
          return item.status === "CLOSED" && item.archivedAt === null;
        })
      : [];

  return (
    <Screen>
      {/* The shell decides the bottom edge (AD-30): inside the bar it holds the
          home indicator, on an expanded screen without the bar the frame does. */}
      <SafeArea>
        <Stack.Screen options={{ title: wishlist("pageTitle", { brand }) }} />
        <PageScroll testID="wishlist-page">
          <PageContainer>
            <Column
              size="wide"
              flexGrow={1}
              paddingHorizontal="$page-gutter medium:$page-gutter-lg"
              paddingTop="$page-gutter"
              gap="$2"
            >
              <Text kind="display-sm" tone="primary" textAlign="center">
                {common("brandName", { brand })}
              </Text>
              {/*
                The page title and the owner's actions share one row (`DESIGN.md` →
                «Широкий экран»: the owner's buttons in the row above the grid, on the
                right). No breakpoint forces a layout here: `flexWrap` breaks the row only
                when the title and the action group actually do not fit. Measured with the
                shipped Manrope 600 metrics (see the W2 addendum): the title is ~116 px,
                «Добавить желание» ~173 px, «Скопировать ссылку» ~187 px, the icon button
                44 px, gaps 8 px — the row is one line from ~577 px of window (552 px of
                content) with both buttons, and from ~395 px when the list is empty and
                only «Скопировать ссылку» + its icon are shown. Story 4.7 adds
                «Скопировать ссылку-приглашение» to the same row: it is a whole button,
                so it wraps under the others when the row no longer fits. On phones the
                buttons wrap under the title; they are never clipped, hidden or shrunk.
              */}
              <XStack
                testID="wishlist-header"
                alignItems="center"
                justifyContent="space-between"
                flexWrap="wrap"
                gap="$2"
              >
                <Heading level={1} flexShrink={1}>{wishlist("title")}</Heading>
                <NotificationBell />
                {state.status === "ready" ? (
                  <YStack testID="wishlist-actions" gap="$1" alignItems="flex-start">
                    <XStack flexWrap="wrap" alignItems="center" gap="$2">
                      {state.gifts.length > 0 ? (
                        <Button label={wishlist("addWish")} onPress={openComposer} />
                      ) : null}
                      {/* The icon explains the copy button: the two wrap as one pair, so
                          the icon is never left alone on a line of its own. */}
                      <XStack alignItems="center" gap="$2">
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
                      <Button
                        testID="wishlist-copy-invite-link"
                        label={wishlist("copyInviteLink")}
                        variant="secondary"
                        onPress={handleCopyInvite}
                      />
                    </XStack>
                    {!canShare ? (
                      <Text
                        id={COPY_LINK_REASON_ID}
                        testID="wishlist-copy-link-reason"
                        kind="caption"
                        tone="muted"
                      >
                        {wishlist("copyLinkDisabledReason")}
                      </Text>
                    ) : null}
                  </YStack>
                ) : null}
              </XStack>

              <YStack
                testID="wishlist-content"
                ref={attachContainer}
                flexGrow={1}
                paddingTop="$2"
                paddingBottom="$section-gap"
                gap="$grid-gap"
              >
                {state.status === "loading" ? (
                  <LoadingCards
                    testID="my-wishlist-loading"
                    label={wishlist("loading")}
                    width={cardWidth}
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
                ) : (
                  <>
                    {state.gifts.length === 0 ? (
                      <EmptyState
                        title={wishlist("emptyTitle")}
                        body={wishlist("emptyText")}
                        action={<Button label={wishlist("addWish")} onPress={openComposer} />}
                      />
                    ) : null}
                    {activeGifts.length > 0 ? (
                      // Review m5: the grid is a list for assistive tech.
                      <CardGridList>
                        {activeGifts.map(renderGiftCard)}
                      </CardGridList>
                    ) : null}
                    {closedGifts.length > 0 ? (
                      <ClosedSection
                        label={t("gift.closed.sectionOwner", { count: closedGifts.length })}
                        expanded={closedExpanded}
                        onToggle={function toggleClosed() {
                          setClosedExpanded((open) => !open);
                        }}
                        testID="wishlist-closed"
                        toggleTestID="wishlist-closed-toggle"
                      >
                        {closedGifts.map(renderGiftCard)}
                      </ClosedSection>
                    ) : null}
                    {(state.archivedTotal ?? state.archived.length) > 0 ? (
                      <ArchiveSection
                        label={wishlist("archiveSection", {
                          count: state.archivedTotal ?? state.archived.length,
                        })}
                        expanded={archiveExpanded}
                        onToggle={toggleArchive}
                        gifts={state.archived}
                        cardWidth={cardWidth}
                        menuLabel={wishlist("archiveMenu")}
                        onOpenMenu={openArchiveMenu}
                      />
                    ) : null}
                  </>
                )}
              </YStack>

              {/* Story 6.2: «Выйти» and the temporary section links moved to the
                  «Профиль» tab and the navigation; the footer keeps «Написать
                  автору» only. */}
              <SiteFooter />
            </Column>
          </PageContainer>
        </PageScroll>
        <Dialog
          open={archiveMenu !== null}
          title={restoreStep ? wishlist("archiveRestore") : (archiveMenu?.title ?? wishlist("archiveMenu"))}
          onClose={closeArchiveMenu}
          testID="wishlist-archive-menu"
          actions={
            restoreStep ? (
              <>
                <Button
                  variant="ghost"
                  label={wishlist("archiveBack")}
                  onPress={function backFromRestore() {
                    setRestoreStep(false);
                    setRestoreError(undefined);
                  }}
                  disabled={archiveBusy}
                />
                <Button
                  label={giftForm("action.save")}
                  onPress={submitRestore}
                  disabled={archiveBusy}
                />
              </>
            ) : (
              <Button variant="ghost" label={wishlist("archiveClose")} onPress={closeArchiveMenu} />
            )
          }
        >
          {restoreStep ? (
            <DateField
              label={giftForm("field.expiresOn")}
              hint={giftForm("field.expiresOnHint")}
              error={restoreError}
              value={restoreDate}
              min={deviceToday()}
              clearLabel={giftForm("field.expiresOnClear")}
              placeholder={giftForm("field.expiresOnChoose")}
              displayValue={restoreDate === "" ? undefined : formatDate(restoreDate, locale)}
              doneLabel={giftForm("field.expiresOnDone")}
              onChange={function handleRestoreDate(next) {
                setRestoreDate(next);
                setRestoreError(undefined);
              }}
            />
          ) : (
            <YStack gap="$2">
              <Button
                label={wishlist("archiveRestore")}
                onPress={function showRestore() {
                  setRestoreStep(true);
                }}
                disabled={archiveBusy}
              />
              <Button
                label={wishlist("archiveCopy")}
                onPress={copyArchived}
                disabled={archiveBusy}
              />
            </YStack>
          )}
        </Dialog>
        {/* Story 5.3: the ⋯ of one card — received, undo, copy or delete. */}
        <GiftCardMenu
          open={cardMenu !== null}
          title={cardMenu?.title ?? ""}
          actions={cardMenu ? cardMenuActionsFor(cardMenu) : []}
          closeLabel={t("gift.detail.close")}
          onClose={closeCardMenu}
          onClosed={cardMenuClosed}
          onSelect={chooseMenuAction}
          testID="wishlist-card-menu"
        />
        {/* Closing a wish from the card: ordinary (primary) confirmation. */}
        <CloseGiftConfirm
          gift={closeConfirm}
          busy={closeBusy}
          onConfirm={confirmCloseFromCard}
          onCancel={cancelCloseConfirm}
          onClosed={function closeConfirmClosed() {
            setCloseBusy(false);
          }}
        />
        {/* Deleting a closed wish: the existing DELETE, coral and irreversible. */}
        <ConfirmDialog
          variant="confirm"
          visible={deleteConfirm !== null}
          title={
            deleteConfirm
              ? giftForm("delete.confirmTitle", { title: deleteConfirm.title })
              : ""
          }
          body={giftForm("delete.confirmBody")}
          confirmLabel={giftForm("delete.confirm")}
          cancelLabel={giftForm("delete.cancel")}
          busy={deleteBusy}
          onConfirm={confirmDeleteClosed}
          onCancel={cancelDeleteClosed}
          onClosed={function deleteConfirmClosed() {
            setDeleteBusy(false);
          }}
        />
        {toast ? (
          <ToastHost
            message={toast.message}
            tone={toast.tone}
            onDismiss={dismissToast}
            action={toast.action}
            actionRef={toastAction}
            durationMs={toast.durationMs}
          />
        ) : null}
      </SafeArea>
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

/** Owner archive at the end of the list. Hidden by the caller when it is empty. */
function ArchiveSection({
  label,
  expanded,
  onToggle,
  gifts,
  cardWidth,
  menuLabel,
  onOpenMenu,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  gifts: readonly GiftCard[];
  cardWidth: number;
  menuLabel: string;
  onOpenMenu: (gift: GiftCard) => void;
}) {
  return (
    <ClosedSection
      label={label}
      expanded={expanded}
      onToggle={onToggle}
      testID="wishlist-archive"
      toggleTestID="wishlist-archive-toggle"
    >
      {gifts.map(function renderArchived(gift) {
        function openMenu() {
          onOpenMenu(gift);
        }

        return (
          <WishCard
            key={gift.id}
            gift={gift}
            width={cardWidth}
            closed
            menu={
              <Pressable
                aria-label={menuLabel}
                onPress={openMenu}
                width="$touch-target"
                height="$touch-target"
                alignItems="center"
                justifyContent="center"
                testID={`wishlist-archive-menu-${gift.id}`}
              >
                <Text aria-hidden>⋯</Text>
              </Pressable>
            }
          />
        );
      })}
    </ClosedSection>
  );
}

ArchiveSection.displayName = "ArchiveSection";

function tagsFromCard(gift: GiftCard): GiftTagInput[] {
  return gift.tags.flatMap(function toInput(tag): GiftTagInput[] {
    if (tag.catalogId) return [{ catalogId: tag.catalogId }];
    const text = tag.label.trim();
    if (text === "") return [];
    return [{ text }];
  });
}
