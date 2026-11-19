import type {
  GiftCard,
  ReservationActionBody,
  ReservationCard as ReservationCardData,
} from "@gift-list/contracts";
import {
  Button,
  Column,
  Heading,
  PageContainer,
  PageScroll,
  SafeArea,
  Screen,
  Switch,
  TagChip,
  TagChipList,
  Text,
  YStack,
} from "@gift-list/ui";
import { formatDate, formatPrice } from "@gift-list/contracts";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { updateReservation, type ReservationUpdateResult } from "@/api/reservations";
import { fetchViewerGift, releaseMyReservation, reserveGift } from "@/api/viewer-gift";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { paramValue } from "@/session/return-path";
import { mutationErrorMessage } from "@/session/form-issue";
import { EmptyState } from "@/ui/empty-state";
import { NavLink } from "@/ui/nav-link";
import { NotFoundScreen } from "@/ui/not-found-screen";
import { PrimaryButton } from "@/ui/primary-button";
import { ReservationExtendDialog } from "@/ui/reservation-extend-dialog";
import { ReservationReleaseConfirm } from "@/ui/reservation-release-confirm";
import {
  ReservationVisibility,
  type ReservationVisibilityValues,
} from "@/ui/reservation-visibility";
import { ReserveConfirm } from "@/ui/reserve-confirm";
import { StatusPill } from "@/ui/status-pill";
import { ToastHost } from "@/ui/toast";

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
  const [attempt, setAttempt] = useState(0);
  const [gift, setGift] = useState<GiftCard | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reserveBusy, setReserveBusy] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const reserveInFlight = useRef(false);
  // Story 5.2: the holder's own release — the confirm, its request in flight, and
  // the same one-at-a-time guard the reserve uses.
  const [releaseConfirmOpen, setReleaseConfirmOpen] = useState(false);
  const [releaseBusy, setReleaseBusy] = useState(false);
  const releaseInFlight = useRef(false);
  // Story 5.5: the holder's three actions of «Мои брони» are also here — «Купил»,
  // «Продлить до…» and «Кто видит, что это я». One action at a time, the same
  // guard as the reserve and the release.
  const [actionBusy, setActionBusy] = useState(false);
  const actionInFlight = useRef(false);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
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
      const result = await fetchViewerGift(id, listToken);
      if (cancelled) return;
      if (result.ok) {
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
      if ("code" in result && result.code === "FORBIDDEN") {
        router.replace({ pathname: "/gifts/[id]/edit", params: { id } });
        return;
      }
      setState({ status: "error", kind: "network" in result ? "network" : "generic" });
    }

    void requestGift();
    return function stopLoad() {
      cancelled = true;
    };
  }, [attempt, auth.state.status, id, listToken, openReserve, wishTitle]);

  if (!id) return <NotFoundScreen />;

  const current = gift ?? (state.status === "ready" ? state.gift : null);
  const showReserveCta =
    current?.quantity === "SINGLE" && current?.status === "OPEN";
  // Story 5.2 (A-14): only the live holder gets `reservation` from the server, so
  // its presence is the holder branch, not a name or a relationship lookup. The
  // release itself is only possible while the wish is `RESERVED`.
  const showRelease = current?.status === "RESERVED" && current.reservation !== undefined;
  const reserveHint =
    current && !showReserveCta && !showRelease
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
    if (!id || !current || releaseInFlight.current) return;
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
  async function requestAction(body: ReservationActionBody): Promise<ReservationUpdateResult | null> {
    if (!id || actionInFlight.current) return null;
    actionInFlight.current = true;
    setActionBusy(true);
    setToast(null);
    const result = await updateReservation(id, body);
    actionInFlight.current = false;
    setActionBusy(false);
    return result;
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
    const result = await requestAction(body);
    if (!result) return;
    if (result.ok) {
      applyReservation(result.reservation);
      return;
    }
    reportActionFailure(result);
  }

  /** «Купил»: only the flag changes — phase, deadline and switches stay (AD-9). */
  async function submitBought(value: boolean) {
    await runAction({ action: "bought", value });
  }

  /** Both switches travel in one `visibility` action; the answer replaces the card. */
  async function submitVisibility(next: ReservationVisibilityValues) {
    await runAction({
      action: "visibility",
      holderVisibleToOwner: next.holderVisibleToOwner,
      holderVisibleToOthers: next.holderVisibleToOthers,
    });
  }

  function toggleVisibility() {
    setVisibilityOpen(function flip(current) {
      return !current;
    });
  }

  function openExtend() {
    setExtendError(null);
    setExtendOpen(true);
  }

  function cancelExtend() {
    if (actionBusy) return;
    setExtendOpen(false);
    setExtendError(null);
  }

  /**
   * «Подтвердить» of the extension: one `extend` action. A day outside the window
   * keeps the sheet open with «Выберите дату не позже {max}.»; the other failures
   * close it and follow the shared tail. `GIVEN` never opens the sheet: an
   * extension there would silently restart the timers of Story 5.7.
   */
  async function submitExtend(dueOn: string) {
    const result = await requestAction({ action: "extend", dueOn });
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
                  <PrimaryButton label={tGift("retry")} onPress={function retry() {
                    setState({ status: "loading" });
                    setAttempt((value) => value + 1);
                  }} />
                </YStack>
              ) : current ? (
                <YStack gap="$4" flexGrow={1}>
                  <Heading level={1} kind="display-sm">
                    {current.title}
                  </Heading>
                  {current.description ? <Text kind="body">{current.description}</Text> : null}
                  {current.priceAmount !== null && current.priceCurrency !== null ? (
                    <Text kind="label" tone="muted">
                      {formatPrice(current.priceAmount, current.priceCurrency, locale)}
                    </Text>
                  ) : null}
                  <StatusPill status={current.status} />
                  {current.tags.length > 0 ? (
                    <TagChipList
                      labels={current.tags.map(function tagLabel(tag) {
                        return tag.label;
                      })}
                      moreLabel={function moreTags(count: number) {
                        return tGift("tagsMore", { count });
                      }}
                    />
                  ) : null}
                  {current.reservation ? (
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
                        disabled={actionBusy}
                        onChange={function changeBought(value) {
                          void submitBought(value);
                        }}
                        testID="gift-bought"
                      />
                      {/* `GIVEN` ждёт подтверждения (Story 5.7): продление
                          вернуло бы `ACTIVE` и таймеры, поэтому кнопки нет. */}
                      {current.reservation.phase === "GIVEN" ? null : (
                        <Button
                          label={tReservations("extend")}
                          variant="outline"
                          onPress={openExtend}
                          disabled={actionBusy}
                          testID="gift-extend"
                        />
                      )}
                      <ReservationVisibility
                        expanded={visibilityOpen}
                        onToggle={toggleVisibility}
                        values={{
                          holderVisibleToOwner: current.reservation.holderVisibleToOwner,
                          holderVisibleToOthers: current.reservation.holderVisibleToOthers,
                        }}
                        busy={actionBusy}
                        onChange={function changeVisibility(next) {
                          void submitVisibility(next);
                        }}
                        testID="gift-visibility"
                      />
                    </YStack>
                  ) : null}
                  <YStack flexGrow={1} />
                  {showReserveCta ? (
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
                      onPress={function openReleaseConfirm() {
                        setReleaseConfirmOpen(true);
                      }}
                    />
                  ) : reserveHint ? (
                    <Text kind="label" tone="muted" accessibilityRole="text">
                      {reserveHint}
                    </Text>
                  ) : null}
                  <NavLink href="/">{tGift("backToList")}</NavLink>
                </YStack>
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
            busy={actionBusy}
            dateError={extendError ?? undefined}
            onClose={cancelExtend}
            onConfirm={function confirmExtend(dueOn) {
              void submitExtend(dueOn);
            }}
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