import {
  formatDate,
  type DetailViewer,
  type GiftCard,
  type ReservationActionBody,
  type ReservationCard as ReservationCardData,
} from "@gift-list/contracts";
import {
  Button,
  Column,
  PageContainer,
  PageScroll,
  SafeArea,
  Screen,
  Switch,
  TagChip,
  Text,
  XStack,
  YStack,
} from "@gift-list/ui";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import {
  markReservationGiven,
  updateReservation,
  type ReservationUpdateResult,
} from "@/api/reservations";
import { fetchViewerGift, releaseMyReservation, reserveGift } from "@/api/viewer-gift";
import { getBrandName } from "@/config/env";
import { needsSurpriseWarning } from "@/domain/surprise-warning";
import { useAuth } from "@/session/auth-context";
import { paramValue } from "@/session/return-path";
import { mutationErrorMessage } from "@/session/form-issue";
import { EmptyState } from "@/ui/empty-state";
import { restoreFocus, type FocusTarget } from "@/ui/focus";
import { GiftDetail } from "@/ui/gift-detail";
import { NavLink } from "@/ui/nav-link";
import { NotFoundScreen } from "@/ui/not-found-screen";
import { ReservationExtendDialog, canExtendReservation } from "@/ui/reservation-extend-dialog";
import { ReservationReleaseConfirm } from "@/ui/reservation-release-confirm";
import {
  ReservationVisibility,
  type ReservationVisibilityValues,
} from "@/ui/reservation-visibility";
import { ReserveConfirm } from "@/ui/reserve-confirm";
import { SurpriseWarningDialog } from "@/ui/surprise-warning";
import { ToastHost } from "@/ui/toast";
import { loadOwnerDetail } from "@/ui/wish-detail-load";

type ScreenState =
  | { status: "loading" }
  | { status: "ready"; gift: GiftCard }
  | { status: "missing" }
  | { status: "error"; kind: "network" | "generic" };

export default function GiftDetailScreen() {
  const tGift = useTranslations("app.gift");
  const tPhase = useTranslations("app.gift.detail.phase");
  const tReservations = useTranslations("app.reservations");
  const tForm = useTranslations("app.form");
  const tWishlist = useTranslations("app.myWishlist");
  const common = useTranslations("common");
  const locale = useLocale();
  const brand = getBrandName();
  const auth = useAuth();
  const params = useLocalSearchParams<{
    id?: string;
    openReserve?: string;
    listToken?: string;
    title?: string;
  }>();
  const id = paramValue(params.id);
  const listToken = paramValue(params.listToken);
  const wishTitle = paramValue(params.title);
  const openReserve = paramValue(params.openReserve) === "1";
  const [state, setState] = useState<ScreenState>(
    id ? { status: "loading" } : { status: "missing" },
  );
  // D-63 / AD-15 (14): the owner's page is built from the owner card alone
  // (`GET /api/v1/me/gifts/:id`), which carries no `reservation`, no `reservedBy`
  // and no `RESERVED` status, so the page cannot tell a booked wish from an open one.
  const [viewer, setViewer] = useState<DetailViewer>("guest");
  const [attempt, setAttempt] = useState(0);
  const [gift, setGift] = useState<GiftCard | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reserveBusy, setReserveBusy] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const reserveInFlight = useRef(false);
  // D-49 (CLE-124): «Изменить» of an open non-secret wish asks the neutral question
  // first (`EXPERIENCE.md` → Interaction Primitives, «Правка желания»). The question
  // reads only the owner's own card — no reservation field ever reaches the page
  // (AD-15 (14)), so it is shown the same with a booking and without one.
  const [editWarningOpen, setEditWarningOpen] = useState(false);
  const editButtonRef = useRef<FocusTarget>(null);
  // A confirmed question leaves for the form, so there is no button to return to.
  const editAccepted = useRef(false);
  // Story 5.2: the holder's own release — the confirm, its request in flight, and
  // the same one-at-a-time guard the reserve uses.
  const [releaseConfirmOpen, setReleaseConfirmOpen] = useState(false);
  const [releaseBusy, setReleaseBusy] = useState(false);
  const releaseInFlight = useRef(false);
  // Story 5.5: the holder's three actions of «Мои брони» are also here — «Купил»,
  // «Продлить до…» и переключатель видимости. One action at a time, the same
  // guard as the reserve and the release.
  const [actionBusy, setActionBusy] = useState(false);
  const actionInFlight = useRef(false);
  // R1 (CLE-119): the release of Story 5.2 and the holder's actions of Story 5.5
  // are one queue — while any of them is in flight, the rest are blocked and a
  // second request does not leave the screen.
  const holderBusy = actionBusy || releaseBusy;
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);
  const timeZone =
    auth.state.status === "ready" ? auth.state.user.timeZone ?? "UTC" : "UTC";

  useEffect(function loadGift() {
    if (!id || auth.state.status === "loading") return;
    if (auth.state.status === "anonymous") {
      const nextQuery = new URLSearchParams();
      if (listToken) nextQuery.set("listToken", listToken);
      if (openReserve) {
        nextQuery.set("openReserve", "1");
        if (wishTitle) nextQuery.set("title", wishTitle);
      }
      const suffix = nextQuery.size > 0 ? `?${nextQuery.toString()}` : "";
      router.replace({ pathname: "/login", params: { next: `/gifts/${id}${suffix}` } });
      return;
    }
    let cancelled = false;

    async function requestGift() {
      if (!id) return;
      // D-63 / AD-15 (14): the owner's page reads only the owner route, so a
      // booking never reaches it. A foreign wish answers NOT_FOUND there, and the
      // screen then asks the viewer route — the same single request a guest had.
      const owner = await loadOwnerDetail(id);
      if (cancelled) return;
      if (owner.ok) {
        setViewer("owner");
        setGift(owner.gift);
        setState({ status: "ready", gift: owner.gift });
        return;
      }
      if (owner.reason === "network") {
        setState({ status: "error", kind: "network" });
        return;
      }

      const result = await fetchViewerGift(id, listToken);
      if (cancelled) return;
      if (result.ok) {
        setViewer("guest");
        setGift(result.gift);
        setState({ status: "ready", gift: result.gift });
        if (
          openReserve &&
          result.gift.quantity === "SINGLE" &&
          result.gift.status === "OPEN"
        ) {
          setConfirmOpen(true);
        }
        return;
      }
      if ("code" in result && result.code === "NOT_FOUND") {
        setState({ status: "missing" });
        return;
      }
      // FORBIDDEN here means the owner route answered the owner, so the earlier
      // read failed for another reason (and the owner still deserves its own
      // answer, never a redirect to the edit form). UNAUTHENTICATED is the same
      // rare tail: the screen already checked the session before the reads.
      setState({ status: "error", kind: "network" in result ? "network" : "generic" });
    }

    void requestGift();
    return function stopLoad() {
      cancelled = true;
    };
  }, [attempt, auth.state.status, id, listToken, openReserve, wishTitle]);

  if (!id) return <NotFoundScreen />;

  const current = gift ?? (state.status === "ready" ? state.gift : null);
  // The owner never gets a reserve button, a hint or a release: the page is the
  // wish as an open card, plus «Изменить» (D-49, AD-15 (14)).
  const isGuest = viewer === "guest";
  const showReserveCta =
    isGuest && current?.quantity === "SINGLE" && current?.status === "OPEN";
  // Story 5.2 (A-14): only the live holder gets `reservation` from the server, so
  // its presence is the holder branch, not a name or a relationship lookup. The
  // release itself is only possible while the wish is `RESERVED`.
  const showRelease =
    isGuest && current?.status === "RESERVED" && current.reservation !== undefined;
  const reserveHint =
    isGuest && current && !showReserveCta && !showRelease
      ? current.quantity === "UNLIMITED"
        ? tGift("reserveNoButton.UNLIMITED")
        : tGift(`reserveNoButton.${current.status}` as "reserveNoButton.RESERVED")
      : null;

  async function submitReserve(body: Parameters<typeof reserveGift>[1]) {
    if (!id || !current || reserveInFlight.current) return;
    reserveInFlight.current = true;
    setReserveBusy(true);
    const optimistic: GiftCard = {
      ...current,
      status: "RESERVED",
      reservedBy:
        auth.state.status === "ready"
          ? {
              id: auth.state.user.id,
              nick: auth.state.user.nick,
              displayName: auth.state.user.name,
            }
          : current.reservedBy,
    };
    setGift(optimistic);
    setDateError(null);
    const result = await reserveGift(id, body, listToken);
    reserveInFlight.current = false;
    setReserveBusy(false);
    if (result.ok) {
      setGift(result.gift);
      setConfirmOpen(false);
      return;
    }
    setGift(current);
    if ("network" in result && result.network) {
      setToast(tForm("network"));
      return;
    }
    if (!("code" in result)) {
      setToast(common("errors.generic"));
      return;
    }
    if ("code" in result) {
      if (result.reason === "DUE_OUT_OF_RANGE") {
        const max = result.params?.max ? String(result.params.max) : "";
        setDateError(common("errors.reason.DUE_OUT_OF_RANGE", { max }));
        return;
      }
      setToast(mutationErrorMessage(result, common));
      if (result.reason === "RESERVATION_TAKEN") setConfirmOpen(false);
    }
  }

  /**
   * Story 5.2: release of the holder's own reservation. The server answers `{ id }`,
   * so the screen applies the transition it already knows: `OPEN` and no reservation
   * block. A lost race or a wish that has gone (`CONFLICT` / `NOT_FOUND`) is reread
   * instead of guessed; the network keeps the card as it was (DECISION 2026-11-18).
   */
  async function submitRelease() {
    if (!id || !current || releaseInFlight.current || actionInFlight.current) return;
    releaseInFlight.current = true;
    setReleaseBusy(true);
    const result = await releaseMyReservation(id);
    releaseInFlight.current = false;
    setReleaseBusy(false);
    setReleaseConfirmOpen(false);
    if (result.ok) {
      setGift({
        ...current,
        status: "OPEN",
        reservedBy: null,
        reservationLabel: null,
        ownerAction: null,
        reservation: undefined,
      });
      return;
    }
    if ("network" in result) {
      setToast(tForm("network"));
      return;
    }
    if ("invalid" in result) {
      setToast(common("errors.generic"));
      return;
    }
    setToast(mutationErrorMessage(result, common));
    if (result.code === "CONFLICT" || result.code === "NOT_FOUND") {
      setAttempt((value) => value + 1);
    }
  }

  /**
   * Story 5.5: the answer of `PATCH /api/v1/me/reservations/:giftId` is the updated
   * reservation card, so only the reservation facts of the wish are replaced. The
   * wish itself (status, holder, tags) does not change here: extending, «Купил» and
   * the switches are attributes of `RESERVED` (AD-9).
   */
  function applyReservation(card: ReservationCardData) {
    setGift(function replaceReservation(currentGift) {
      if (!currentGift) return currentGift;
      return {
        ...currentGift,
        reservation: {
          dueAt: card.dueAt,
          phase: card.phase,
          bought: card.bought,
          holderVisibleToOwner: card.holderVisibleToOwner,
          holderVisibleToOthers: card.holderVisibleToOthers,
        },
      };
    });
  }

  /** One holder action at a time; a second tap while the answer is missing sends nothing. */
  async function requestReservation(
    request: (giftId: string) => Promise<ReservationUpdateResult>,
  ): Promise<ReservationUpdateResult | null> {
    if (!id || actionInFlight.current || releaseInFlight.current) return null;
    actionInFlight.current = true;
    setActionBusy(true);
    setToast(null);
    const result = await request(id);
    actionInFlight.current = false;
    setActionBusy(false);
    return result;
  }

  /** The answer of a holder action: a card replaces the facts, an error takes the tail. */
  function applyAnswer(result: ReservationUpdateResult) {
    if (result.ok) {
      applyReservation(result.reservation);
      return;
    }
    reportActionFailure(result);
  }

  /**
   * The shared tail of a failed action (DECISION 2026-11-18): a broken connection
   * is the form sentence and keeps the card as it was; a lost race or a vanished
   * reservation is reread, because the server already decided what happened.
   */
  function reportActionFailure(result: Exclude<ReservationUpdateResult, { ok: true }>) {
    if ("network" in result) {
      setToast(tForm("network"));
      return;
    }
    if ("invalid" in result) {
      setToast(common("errors.generic"));
      return;
    }
    setToast(mutationErrorMessage(result, common));
    if (result.code === "CONFLICT" || result.code === "NOT_FOUND") {
      setAttempt(function rereadGift(value) {
        return value + 1;
      });
    }
  }

  async function runAction(body: ReservationActionBody) {
    const result = await requestReservation(function request(giftId) {
      return updateReservation(giftId, body);
    });
    if (!result) return;
    applyAnswer(result);
  }

  /** «Купил»: only the flag changes — phase, deadline and switches stay (AD-9). */
  async function submitBought(value: boolean) {
    await runAction({ action: "bought", value });
  }

  /**
   * «Подарил» (Story 5.7): the reservation moves into `GIVEN`, so the stage under
   * the deadline reads «Подарено» from the answer. The wish status stays as it was,
   * and a repeated press is a no-op success on the server.
   */
  async function submitGiven() {
    const result = await requestReservation(markReservationGiven);
    if (!result) return;
    applyAnswer(result);
  }

  /** The visibility switch travels in one `visibility` action; the answer replaces the card. */
  async function submitVisibility(next: ReservationVisibilityValues) {
    await runAction({
      action: "visibility",
      holderVisibleToOthers: next.holderVisibleToOthers,
    });
  }

  function openExtend() {
    setExtendError(null);
    setExtendOpen(true);
  }

  function cancelExtend() {
    if (holderBusy) return;
    setExtendOpen(false);
    setExtendError(null);
  }

  /**
   * «Подтвердить» of the extension: one `extend` action. A day outside the window
   * keeps the sheet open with «Выберите дату не позже {max}.»; the other failures
   * close it and follow the shared tail. A passed deadline (`RESERVATION_DUE_PASSED`)
   * is named by that tail and the wish is reread, so the button disappears with the
   * refreshed phase.
   */
  async function submitExtend(dueOn: string) {
    const result = await requestReservation(function request(giftId) {
      return updateReservation(giftId, { action: "extend", dueOn });
    });
    if (!result) return;
    if (result.ok) {
      applyReservation(result.reservation);
      setExtendOpen(false);
      setExtendError(null);
      return;
    }
    if (
      !("network" in result) &&
      !("invalid" in result) &&
      result.reason === "DUE_OUT_OF_RANGE"
    ) {
      const max = result.params?.max ? String(result.params.max) : "";
      setExtendError(common("errors.reason.DUE_OUT_OF_RANGE", { max }));
      return;
    }
    setExtendOpen(false);
    reportActionFailure(result);
  }

  /**
   * «Изменить» (T4.4a): an open non-secret wish gets the neutral question first, any
   * other wish goes straight to the form (`needsSurpriseWarning` reads only the status,
   * the visibility and the archive — never a reservation).
   */
  function startEdit() {
    if (!current) return;
    if (needsSurpriseWarning(current)) {
      editAccepted.current = false;
      setEditWarningOpen(true);
      return;
    }
    openEditForm();
  }

  /** The accepted «Изменить»: the question closes and the existing form route opens. */
  function openEditForm() {
    if (!id) return;
    editAccepted.current = true;
    setEditWarningOpen(false);
    router.push({ pathname: "/gifts/[id]/edit", params: { id } });
  }

  /** «Отмена» of the neutral question: stay on the page, the form never opened. */
  function cancelEditWarning() {
    setEditWarningOpen(false);
  }

  /** The question has left the tree: «Изменить» gets focus back unless the form opened. */
  function restoreEditFocus() {
    if (editAccepted.current) {
      editAccepted.current = false;
      return;
    }
    restoreFocus(editButtonRef.current);
  }

  return (
    <Screen>
      <SafeArea>
        <Stack.Screen options={{ title: tGift("detail.pageTitle", { brand }) }} />
        <PageScroll testID="gift-detail-page">
          <PageContainer>
            <Column
              size="wide"
              flexGrow={1}
              paddingHorizontal="$page-gutter medium:$page-gutter-lg"
              paddingVertical="$section-gap"
              gap="$section-gap"
            >
              {state.status === "loading" ? (
                <Text kind="body">{tGift("detail.loading")}</Text>
              ) : state.status === "missing" ? (
                <EmptyState title={tGift("giftNotFound")} />
              ) : state.status === "error" ? (
                <YStack gap="$3">
                  <Text kind="body">
                    {state.kind === "network" ? tGift("loadError") : tGift("loadErrorGeneric")}
                  </Text>
                  <Button label={tGift("retry")} onPress={function retry() {
                    setState({ status: "loading" });
                    setAttempt((value) => value + 1);
                  }} />
                </YStack>
              ) : current ? (
                <GiftDetail
                  gift={current}
                  viewer={viewer}
                  actions={
                    viewer === "owner" && current.status !== "CLOSED" ? (
                      <Button
                        ref={editButtonRef as never}
                        label={tGift("detail.editShort")}
                        variant="secondary"
                        onPress={startEdit}
                        testID="gift-edit"
                      />
                    ) : showReserveCta ? (
                      <Button
                        label={tGift("reserveCta")}
                        variant="reserve"
                        onPress={function openConfirm() {
                          setConfirmOpen(true);
                        }}
                      />
                    ) : showRelease ? (
                      <Button
                        label={tGift("release.confirm")}
                        variant="secondary"
                        disabled={holderBusy}
                        onPress={function openReleaseConfirm() {
                          setReleaseConfirmOpen(true);
                        }}
                      />
                    ) : reserveHint ? (
                      <Text kind="label" tone="muted" accessibilityRole="text">
                        {reserveHint}
                      </Text>
                    ) : undefined
                  }
                >
                  {/* CLE-129, T4.2 / D-55: a guest sees «Берёт {имя}», and the name
                      opens the holder's profile. The holder already has their own
                      reservation block below, and the owner never gets a holder:
                      the viewer gate is the page's second AD-15 check. */}
                  {isGuest && current.reservedBy && !current.reservation ? (
                    <XStack
                      gap="$1"
                      alignItems="center"
                      flexWrap="wrap"
                      testID="gift-reserved-by"
                    >
                      <Text kind="label" tone="reserved">
                        {tWishlist("reservedByPrefix")}
                      </Text>
                      <NavLink href={`/u/${encodeURIComponent(current.reservedBy.nick)}`}>
                        {current.reservedBy.displayName}
                      </NavLink>
                    </XStack>
                  ) : null}
                  {isGuest && current.reservation ? (
                    <YStack gap="$3" testID="gift-reservation">
                      {/* «Подписи брони» (EXPERIENCE.md) — та же таблица, что у
                          карточки «Моих броней». В детали дата полная. */}
                      {current.reservation.phase === "ACTIVE" ? (
                        <Text kind="label" tone="reserved">
                          {tPhase("ACTIVE", {
                            date: formatDate(current.reservation.dueAt, locale),
                          })}
                        </Text>
                      ) : (
                        <YStack gap="$1">
                          <Text kind="label" tone="reserved">
                            {tReservations("due", {
                              date: formatDate(current.reservation.dueAt, locale),
                            })}
                          </Text>
                          <Text kind="caption" tone="muted">
                            {tPhase(current.reservation.phase)}
                          </Text>
                        </YStack>
                      )}
                      {current.reservation.bought ? (
                        <TagChip variant="card" label={tGift("detail.bought")} />
                      ) : null}
                      <Switch
                        label={tReservations("bought")}
                        checked={current.reservation.bought}
                        disabled={holderBusy}
                        onChange={function changeBought(value) {
                          void submitBought(value);
                        }}
                        testID="gift-bought"
                      />
                      {/* CLE-124/S9b-3 (D-12, §10.2): продления нет в `GIVEN` и
                          после Срока — сервер отвечает `RESERVATION_DUE_PASSED`. */}
                      {canExtendReservation(current.reservation, timeZone) ? (
                        <Button
                          label={tReservations("extend")}
                          variant="outline"
                          onPress={openExtend}
                          disabled={holderBusy}
                          testID="gift-extend"
                        />
                      ) : null}
                      {/* Story 5.7: «Подарил» — этап «Подарено»; в `GIVEN` кнопки нет. */}
                      {current.reservation.phase === "GIVEN" ? null : (
                        <Button
                          label={tReservations("given")}
                          variant="secondary"
                          onPress={function markGiven() {
                            void submitGiven();
                          }}
                          disabled={holderBusy}
                          testID="gift-given"
                        />
                      )}
                      <ReservationVisibility
                        values={{
                          holderVisibleToOthers: current.reservation.holderVisibleToOthers,
                        }}
                        busy={holderBusy}
                        onChange={function changeVisibility(next) {
                          void submitVisibility(next);
                        }}
                        testID="gift-visibility"
                      />
                    </YStack>
                  ) : null}
                </GiftDetail>
              ) : null}
            </Column>
          </PageContainer>
        </PageScroll>
        {current ? (
          <ReserveConfirm
            key={confirmOpen ? "open" : "closed"}
            open={confirmOpen}
            title={current.title}
            timeZone={timeZone}
            busy={reserveBusy}
            dateError={dateError ?? undefined}
            onClose={function closeConfirm() {
              setDateError(null);
              setConfirmOpen(false);
            }}
            onConfirm={submitReserve}
          />
        ) : null}
        {current ? (
          <ReservationReleaseConfirm
            open={releaseConfirmOpen}
            busy={releaseBusy}
            onClose={function closeReleaseConfirm() {
              if (releaseBusy) return;
              setReleaseConfirmOpen(false);
            }}
            onConfirm={submitRelease}
          />
        ) : null}
        {current?.reservation ? (
          <ReservationExtendDialog
            key={extendOpen ? "extend-open" : "extend-closed"}
            open={extendOpen}
            timeZone={timeZone}
            currentDueOn={current.reservation.dueAt}
            busy={actionBusy}
            dateError={extendError ?? undefined}
            onClose={cancelExtend}
            onConfirm={function confirmExtend(dueOn) {
              void submitExtend(dueOn);
            }}
          />
        ) : null}
        {/* D-49: the neutral question of «Изменить» — the same `ConfirmDialog` as on
            the form's delete and visibility narrowing, the viewer gate is AD-15's
            second check (the page itself is built from the owner's card only). */}
        {current && viewer === "owner" ? (
          <SurpriseWarningDialog
            visible={editWarningOpen}
            kind="edit"
            title={current.title}
            onConfirm={openEditForm}
            onCancel={cancelEditWarning}
            onClosed={restoreEditFocus}
          />
        ) : null}
        {toast ? (
          <ToastHost
            message={toast}
            onDismiss={function dismissToast() {
              setToast(null);
            }}
          />
        ) : null}
      </SafeArea>
    </Screen>
  );
}

GiftDetailScreen.displayName = "GiftDetailScreen";