import type { GiftCard } from "@gift-list/contracts";
import {
  Button,
  Column,
  Heading,
  PageContainer,
  PageScroll,
  SafeArea,
  Screen,
  TagChipList,
  Text,
  YStack,
} from "@gift-list/ui";
import { formatPrice } from "@gift-list/contracts";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { fetchViewerGift, reserveGift } from "@/api/viewer-gift";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { paramValue } from "@/session/return-path";
import { mutationErrorMessage } from "@/session/form-issue";
import { EmptyState } from "@/ui/empty-state";
import { NavLink } from "@/ui/nav-link";
import { NotFoundScreen } from "@/ui/not-found-screen";
import { PrimaryButton } from "@/ui/primary-button";
import { ReserveConfirm } from "@/ui/reserve-confirm";
import { StatusPill } from "@/ui/status-pill";
import { ToastHost } from "@/ui/toast";

type ScreenState =
  | { status: "loading" }
  | { status: "ready"; gift: GiftCard }
  | { status: "missing" }
  | { status: "error"; kind: "network" | "generic" };

export default function GiftDetailScreen() {
  const t = useTranslations("app");
  const tGift = useTranslations("app.gift");
  const common = useTranslations("common");
  const locale = useLocale();
  const brand = getBrandName();
  const auth = useAuth();
  const params = useLocalSearchParams<{ id?: string; openReserve?: string }>();
  const id = paramValue(params.id);
  const openReserve = paramValue(params.openReserve) === "1";
  const [state, setState] = useState<ScreenState>(
    id ? { status: "loading" } : { status: "missing" },
  );
  const [gift, setGift] = useState<GiftCard | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reserveBusy, setReserveBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const timeZone =
    auth.state.status === "ready" ? auth.state.user.timeZone ?? "UTC" : "UTC";

  useEffect(function loadGift() {
    if (!id || auth.state.status === "loading") return;
    if (auth.state.status === "anonymous") {
      router.replace({ pathname: "/login", params: { next: `/gifts/${id}` } });
      return;
    }
    let cancelled = false;

    async function requestGift() {
      if (!id) return;
      const result = await fetchViewerGift(id);
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
      setState({ status: "error", kind: "network" in result ? "network" : "generic" });
    }

    void requestGift();
    return function stopLoad() {
      cancelled = true;
    };
  }, [auth.state.status, id, openReserve]);

  if (!id) return <NotFoundScreen />;

  const current = gift ?? (state.status === "ready" ? state.gift : null);
  const showReserveCta =
    current?.quantity === "SINGLE" && current?.status === "OPEN";
  const reserveHint =
    current && !showReserveCta
      ? current.quantity === "UNLIMITED"
        ? tGift("reserveNoButton.UNLIMITED")
        : tGift(`reserveNoButton.${current.status}` as "reserveNoButton.RESERVED")
      : null;

  async function submitReserve(body: Parameters<typeof reserveGift>[1]) {
    if (!id || !current) return;
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
    const result = await reserveGift(id, body);
    setReserveBusy(false);
    if (result.ok) {
      setGift(result.gift);
      setConfirmOpen(false);
      setToast(tGift("toast.reserved"));
      return;
    }
    setGift(current);
    if ("network" in result && result.network) {
      setToast(t("form.network"));
      return;
    }
    if ("code" in result) {
      if (result.reason === "DUE_OUT_OF_RANGE" && result.params?.max) {
        setToast(
          common("errors.reason.DUE_OUT_OF_RANGE", {
            max: String(result.params.max),
          }),
        );
      } else {
        setToast(mutationErrorMessage(result, common));
      }
    }
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
                <EmptyState title={t("giftNotFound")} />
              ) : state.status === "error" ? (
                <YStack gap="$3">
                  <Text kind="body">
                    {state.kind === "network" ? t("loadError") : t("loadErrorGeneric")}
                  </Text>
                  <PrimaryButton label={t("retry")} onPress={function retry() {
                    setState({ status: "loading" });
                  }} />
                </YStack>
              ) : current ? (
                <YStack gap="$4" flexGrow={1}>
                  <Heading level={1} kind="display-sm">
                    {current.title}
                  </Heading>
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
                  <YStack flexGrow={1} />
                  {showReserveCta ? (
                    <Button
                      label={tGift("reserveCta")}
                      variant="reserve"
                      onPress={function openConfirm() {
                        setConfirmOpen(true);
                      }}
                    />
                  ) : reserveHint ? (
                    <Text kind="label" tone="muted" accessibilityRole="text">
                      {reserveHint}
                    </Text>
                  ) : null}
                  <NavLink href="/">{t("backToList")}</NavLink>
                </YStack>
              ) : null}
            </Column>
          </PageContainer>
        </PageScroll>
        {current ? (
          <ReserveConfirm
            open={confirmOpen}
            title={current.title}
            timeZone={timeZone}
            busy={reserveBusy}
            onClose={function closeConfirm() {
              setConfirmOpen(false);
            }}
            onConfirm={submitReserve}
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