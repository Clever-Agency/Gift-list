import type { Me, ReservationActionBody, ReservationCard } from "@gift-list/contracts";
import { restoreFocus, type FocusTarget } from "@gift-list/ui";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import type { ClientResult } from "@/api/client";
import {
  fetchReservations,
  markReservationGiven,
  updateReservation,
  type ReservationUpdateResult,
} from "@/api/reservations";
import { releaseMyReservation } from "@/api/viewer-gift";
import { useAuth } from "@/session/auth-context";
import { mutationErrorMessage, signOutErrorMessage } from "@/session/form-issue";
import { GiftCardMenu, type GiftCardMenuAction } from "@/ui/gift-card-menu";
import { ReservationExtendDialog } from "@/ui/reservation-extend-dialog";
import { ReservationReleaseConfirm } from "@/ui/reservation-release-confirm";
import type { ReservationVisibilityValues } from "@/ui/reservation-visibility";
import { ReservationsScreen as ReservationsView, type ReservationsState } from "@/ui/reservations-screen";
import { SessionErrorScreen } from "@/ui/session-error-screen";
import { SessionLoadingScreen } from "@/ui/session-loading-screen";
import { ToastHost } from "@/ui/toast";

type ToastState = { message: string; tone: "info" | "error" };

/** A failed request: the transport, the envelope or a body that broke the contract. */
type FailedRequest =
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

/**
 * The order of `GET /api/v1/me/reservations`: by `dueAt`, then by id. An extension
 * changes the deadline, so the card is replaced and the list is put back into the
 * server's order instead of keeping the old place of a moved deadline.
 */
function sortReservations(cards: readonly ReservationCard[]): ReservationCard[] {
  return [...cards].sort(function byDueThenId(left, right) {
    if (left.dueAt !== right.dueAt) return left.dueAt < right.dueAt ? -1 : 1;
    return left.giftId < right.giftId ? -1 : left.giftId > right.giftId ? 1 : 0;
  });
}

/**
 * «Мои брони» (Story 5.5, FR-25, A-14): the session gate of «Настройки» — an
 * anonymous visitor leaves for login with a return here, and the list starts only
 * after `/me` answered.
 */
export default function ReservationsScreen() {
  const auth = useAuth();
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(
    function redirectAnonymous() {
      if (auth.state.status === "anonymous") {
        // The login screen owns the «Сессия закончилась» toast: it outlives this screen.
        router.replace({
          pathname: "/login",
          params: sessionExpired
            ? { next: "/reservations", reason: "session_expired" }
            : { next: "/reservations" },
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

  return <ReservationsContent user={auth.state.user} onSessionExpired={handleSessionExpired} />;
}

ReservationsScreen.displayName = "ReservationsScreen";

function ReservationsContent({
  user,
  onSessionExpired,
}: {
  user: Me;
  onSessionExpired: (expired: boolean) => void;
}) {
  const app = useTranslations("app");
  const t = useTranslations("app.reservations");
  const tGift = useTranslations("app.gift");
  const common = useTranslations("common");
  const auth = useAuth();

  const [state, setState] = useState<ReservationsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);

  // The cards with a request in flight: the other cards stay usable, and a second
  // tap on the same card sends nothing.
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(function noneBusy() {
    return new Set<string>();
  });
  const inFlight = useRef(new Set<string>());

  // The ⋯ menu of one card and the item chosen in it: the item runs after the layer
  // has left the tree, so the release confirm does not open over a fading menu.
  const [menuFor, setMenuFor] = useState<ReservationCard | null>(null);
  const pendingMenuAction = useRef<(() => void) | null>(null);
  const menuReturn = useRef<string | null>(null);
  const menuNodes = useRef(new Map<string, FocusTarget | null>());

  // The release of one's own reservation keeps the confirm of Story 5.2.
  const [releaseFor, setReleaseFor] = useState<ReservationCard | null>(null);
  const [releaseBusy, setReleaseBusy] = useState(false);

  // The extension: the card it belongs to, its request in flight and the sentence of
  // a rejected day («Выберите дату не позже {max}.»).
  const [extendFor, setExtendFor] = useState<ReservationCard | null>(null);
  const [extendBusy, setExtendBusy] = useState(false);
  const [extendError, setExtendError] = useState<string | undefined>(undefined);

  // A refocus refresh is silent (only «Повторить» shows the skeleton) and its answer
  // is dropped if the screen blurred before it arrived.
  const focused = useRef(true);
  const firstFocus = useRef(true);

  const timeZone = user.timeZone ?? "UTC";

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

  /**
   * The stored session is dead: `signOut` clears the token and marks the app
   * anonymous, and the guard opens login with the reason. A failed sign-out leaves
   * the screen mounted and returns `false`.
   */
  async function expireSession(): Promise<boolean> {
    onSessionExpired(true);
    const signedOut = await auth.signOut();
    if (!signedOut.ok) {
      onSessionExpired(false);
      setToast({ message: signOutErrorMessage(signedOut, app("form.network"), common), tone: "error" });
    }
    return signedOut.ok;
  }

  useEffect(
    function loadReservations() {
      let cancelled = false;

      async function requestReservations() {
        const result = await fetchReservations();
        if (cancelled || !focused.current) return;

        if (result.ok) {
          setState({ status: "ready", reservations: result.reservations });
          return;
        }
        if ("code" in result && result.code === "UNAUTHENTICATED") {
          const signedOut = await expireSession();
          // A failed sign-out leaves the screen mounted: show the retry view.
          if (!signedOut && !cancelled && focused.current) {
            setState({ status: "error", kind: "network" });
            setToast({ message: app("form.network"), tone: "error" });
          }
          return;
        }
        // UX-DR6: a failing read is never silent. A silent refresh keeps the cards
        // already on screen and only reports itself; a first load or «Повторить»
        // reach this point with the skeleton up, so they get the retry view.
        const network = "network" in result;
        setState((current) =>
          current.status === "ready" ? current : { status: "error", kind: network ? "network" : "generic" },
        );
        setToast({
          message: network
            ? app("form.network")
            : "invalid" in result
              ? common("errors.generic")
              : common(`errors.code.${result.code}`),
          tone: "error",
        });
      }

      void requestReservations();
      return function stopLoad() {
        cancelled = true;
      };
      // `auth` is only read on the expired-session branch; re-running the read on
      // every auth context update would refetch the list for no reason. The
      // catalogue functions are new on every render, so they are not dependencies.
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attempt],
  );

  function retry() {
    setToast(null);
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }

  /** A ready list without one card; every other state is left as it is. */
  function removeCard(giftId: string) {
    setState((current) =>
      current.status === "ready"
        ? {
            ...current,
            reservations: current.reservations.filter(function stillThere(card) {
              return card.giftId !== giftId;
            }),
          }
        : current,
    );
  }

  /** Touches only this card, so a silent refresh that landed meanwhile keeps the list. */
  function replaceCard(reservation: ReservationCard) {
    setState((current) =>
      current.status === "ready"
        ? {
            ...current,
            reservations: sortReservations(
              current.reservations.map(function apply(card) {
                return card.giftId === reservation.giftId ? reservation : card;
              }),
            ),
          }
        : current,
    );
  }

  /**
   * The shared tail of a failed action. A broken connection keeps the card as it
   * was and reports the one form sentence (DECISION 2026-11-18); a lost race or a
   * vanished reservation is reread instead of guessed, because the server already
   * decided what actually happened.
   */
  async function reportFailure(result: FailedRequest) {
    if ("network" in result) {
      setToast({ message: app("form.network"), tone: "error" });
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
    if (result.code === "CONFLICT" || result.code === "NOT_FOUND") {
      setAttempt((value) => value + 1);
    }
  }

  function startCard(card: ReservationCard): boolean {
    // One action at a time per card: a second tap while the answer is missing
    // sends nothing. Another card has its own request.
    if (inFlight.current.has(card.giftId)) return false;
    inFlight.current.add(card.giftId);
    setBusyIds(function markBusy(current) {
      const next = new Set(current);
      next.add(card.giftId);
      return next;
    });
    setToast(null);
    return true;
  }

  function finishCard(card: ReservationCard) {
    inFlight.current.delete(card.giftId);
    setBusyIds(function clearBusy(current) {
      if (!current.has(card.giftId)) return current;
      const next = new Set(current);
      next.delete(card.giftId);
      return next;
    });
  }

  async function sendAction(card: ReservationCard, body: ReservationActionBody): Promise<boolean> {
    return send(card, function request() {
      return updateReservation(card.giftId, body);
    });
  }

  /**
   * One request of one card inside the shared busy/in-flight frame: whichever action
   * runs, a second tap of the same card waits for this answer.
   */
  async function send(
    card: ReservationCard,
    request: () => Promise<ReservationUpdateResult>,
  ): Promise<boolean> {
    if (!startCard(card)) return false;
    const result = await request().finally(function release() {
      finishCard(card);
    });
    if (result.ok) {
      replaceCard(result.reservation);
      return true;
    }
    await reportFailure(result);
    return false;
  }

  /** «Купил»: only the flag changes — phase, deadline and switches stay (AD-9). */
  async function changeBought(card: ReservationCard, value: boolean) {
    await sendAction(card, { action: "bought", value });
  }

  /**
   * «Подарил» (Story 5.7): the server moves the reservation into `GIVEN` and answers
   * the updated card, so the phase under the deadline reads «Подарено» at once.
   * A repeated press is a no-op success on the server; the card sends one request
   * at a time, so a double tap never leaves twice.
   */
  async function markGiven(card: ReservationCard) {
    await send(card, function request() {
      return markReservationGiven(card.giftId);
    });
  }

  /** The visibility switch travels in one `visibility` action; the answer replaces the card. */
  async function changeVisibility(card: ReservationCard, next: ReservationVisibilityValues) {
    await sendAction(card, {
      action: "visibility",
      holderVisibleToOthers: next.holderVisibleToOthers,
    });
  }

  function openExtend(card: ReservationCard) {
    // R1 (CLE-119): one request at a time per card — a dialog is not opened over
    // an action that is already in flight.
    if (inFlight.current.has(card.giftId)) return;
    setExtendError(undefined);
    setExtendFor(card);
  }

  /**
   * «Подтвердить» of the extension: one `extend` action. A day outside the window
   * keeps the sheet open with «Выберите дату не позже {max}.»; a broken connection
   * leaves the card untouched and says so; a lost race closes the sheet and rereads.
   */
  async function submitExtend(dueOn: string) {
    const card = extendFor;
    if (!card || extendBusy) return;
    if (inFlight.current.has(card.giftId)) return;
    setExtendBusy(true);
    inFlight.current.add(card.giftId);
    const result = await updateReservation(card.giftId, { action: "extend", dueOn }).finally(
      function release() {
        inFlight.current.delete(card.giftId);
        setExtendBusy(false);
      },
    );
    if (result.ok) {
      replaceCard(result.reservation);
      setExtendFor(null);
      setExtendError(undefined);
      return;
    }
    if ("network" in result) {
      setToast({ message: app("form.network"), tone: "error" });
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
    if (result.reason === "DUE_OUT_OF_RANGE") {
      const max = result.params?.max ? String(result.params.max) : "";
      setExtendError(common("errors.reason.DUE_OUT_OF_RANGE", { max }));
      return;
    }
    setExtendFor(null);
    await reportFailure(result);
  }

  function cancelExtend() {
    if (extendBusy) return;
    setExtendFor(null);
    setExtendError(undefined);
  }

  /**
   * «Снять бронь» of the ⋮: the existing release of Story 5.2. The card is removed
   * on success; a lost race or a vanished reservation rereads the list; a broken
   * connection keeps the card and reports itself.
   */
  async function submitRelease() {
    const card = releaseFor;
    if (!card || releaseBusy || inFlight.current.has(card.giftId)) return;
    setReleaseBusy(true);
    inFlight.current.add(card.giftId);
    const result = await releaseMyReservation(card.giftId).finally(function release() {
      inFlight.current.delete(card.giftId);
      setReleaseBusy(false);
    });
    setReleaseFor(null);
    if (result.ok) {
      removeCard(card.giftId);
      return;
    }
    await reportFailure(result);
  }

  function cancelRelease() {
    if (releaseBusy) return;
    setReleaseFor(null);
  }

  function openMenu(card: ReservationCard) {
    // R1 (CLE-119): the release behind the menu waits for an action in flight.
    if (inFlight.current.has(card.giftId)) return;
    menuReturn.current = card.giftId;
    setMenuFor(card);
  }

  function menuNodeFor(giftId: string) {
    return function rememberMenuNode(node: FocusTarget | null) {
      menuNodes.current.set(giftId, node);
    };
  }

  /**
   * The menu has left the tree: focus goes back to its ⋮ and only then the chosen
   * item runs, so the release confirm opens over no fading layer.
   */
  function menuClosed() {
    const giftId = menuReturn.current;
    menuReturn.current = null;
    const action = pendingMenuAction.current;
    pendingMenuAction.current = null;
    if (giftId !== null) restoreFocus(menuNodes.current.get(giftId));
    if (action) action();
  }

  /** A pressed item closes the menu first; its work waits for `menuClosed`. */
  function chooseMenuAction(action: GiftCardMenuAction) {
    pendingMenuAction.current = action.onPress;
    setMenuFor(null);
  }

  function menuActions(card: ReservationCard): GiftCardMenuAction[] {
    return [
      {
        key: "release",
        // Story 5.2: releasing one's own reservation is an ordinary action, so the
        // menu item is not coral — `destructive` stays for the owner's release of
        // someone else's reservation (`DESIGN.md` → Colors → Destructive).
        label: t("release"),
        onPress: function askRelease() {
          setReleaseFor(card);
        },
      },
    ];
  }

  function openGift(card: ReservationCard) {
    // The server decides `canOpenGift`; a card without it never becomes a link.
    if (!card.canOpenGift) return;
    router.push({ pathname: "/gifts/[id]", params: { id: card.giftId } });
  }

  function dismissToast() {
    setToast(null);
  }

  return (
    <>
      <ReservationsView
        state={state}
        timeZone={timeZone}
        busyIds={busyIds}
        onRetry={retry}
        onOpenGift={openGift}
        onMenu={openMenu}
        onExtend={openExtend}
        onGiven={function givenOf(card) {
          void markGiven(card);
        }}
        onBoughtChange={function changeBoughtOf(card, value) {
          void changeBought(card, value);
        }}
        onVisibilityChange={function changeVisibilityOf(card, next) {
          void changeVisibility(card, next);
        }}
        menuRefFor={menuNodeFor}
      />
      <GiftCardMenu
        open={menuFor !== null}
        title={menuFor?.titleSnapshot ?? ""}
        actions={menuFor ? menuActions(menuFor) : []}
        closeLabel={tGift("detail.close")}
        onClose={function closeMenu() {
          setMenuFor(null);
        }}
        onClosed={menuClosed}
        onSelect={chooseMenuAction}
        testID="reservation-menu"
      />
      <ReservationReleaseConfirm
        open={releaseFor !== null}
        busy={releaseBusy}
        onClose={cancelRelease}
        onConfirm={function confirmRelease() {
          void submitRelease();
        }}
      />
      <ReservationExtendDialog
        key={extendFor === null ? "closed" : `open-${extendFor.giftId}`}
        open={extendFor !== null}
        timeZone={timeZone}
        currentDueOn={extendFor?.dueAt}
        busy={extendBusy}
        dateError={extendError}
        onClose={cancelExtend}
        onConfirm={function confirmExtend(dueOn) {
          void submitExtend(dueOn);
        }}
      />
      {toast ? (
        <ToastHost message={toast.message} tone={toast.tone} onDismiss={dismissToast} />
      ) : null}
    </>
  );
}

ReservationsContent.displayName = "ReservationsContent";
