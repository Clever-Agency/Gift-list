import type { NotificationAction, NotificationItem } from "@gift-list/contracts";
import { AppShell, Button, Column, Heading, PageContainer, PageScroll, SafeArea, Screen, Text, XStack, YStack } from "@gift-list/ui";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { fetchReservationWarning } from "@/api/my-gifts";
import { fetchNotification, fetchNotifications, markNotificationRead, submitNotificationAction } from "@/api/notifications";
import { useNotificationBadge } from "@/navigation/notification-badge";
import { SidebarNav } from "@/navigation/sidebar-nav";
import { useAuth } from "@/session/auth-context";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { NotificationsList } from "@/ui/notifications-list";
import { ReservationExtendDialog } from "@/ui/reservation-extend-dialog";
import { SessionErrorScreen } from "@/ui/session-error-screen";
import { SessionLoadingScreen } from "@/ui/session-loading-screen";

export default function NotificationsScreen() {
  const auth = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const selectedId = typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : undefined;

  useEffect(function returnAfterLogin() {
    if (auth.state.status !== "anonymous") return;
    const next = selectedId ? `/notifications?id=${encodeURIComponent(selectedId)}` : "/notifications";
    router.replace({ pathname: "/login", params: { next } });
  }, [auth.state.status, selectedId]);

  if (auth.state.status === "error") return <SessionErrorScreen onRetry={auth.retry} />;
  if (auth.state.status !== "ready") return <SessionLoadingScreen />;

  return <NotificationsContent key={auth.state.user.id} selectedId={selectedId} timeZone={auth.state.user.timeZone ?? "UTC"} />;
}

NotificationsScreen.displayName = "NotificationsScreen";

function NotificationsContent({ selectedId, timeZone }: { selectedId?: string; timeZone: string }) {
  const t = useTranslations("notifications");
  const common = useTranslations("common");
  const gift = useTranslations("app.gift");
  const web = useTranslations("web");
  const auth = useAuth();
  const refreshBadge = useNotificationBadge()?.refresh;
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [selected, setSelected] = useState<{ id: string; item: NotificationItem | null }>();
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string>();
  const [confirm, setConfirm] = useState<{
    item: NotificationItem;
    action: "release" | "received";
    warning?: "BOUGHT" | "GIVEN" | null;
  } | null>(null);
  const [extendFor, setExtendFor] = useState<NotificationItem | null>(null);
  const [extendOpening, setExtendOpening] = useState(0);
  const generation = useRef(0);
  const selectedGeneration = useRef(0);
  const actionPending = useRef(false);
  const returnFocus = useRef<(() => void) | null>(null);

  const reload = useCallback(function load(next?: string) {
    const request = ++generation.current;
    return fetchNotifications(next).then(function loaded(page) {
      if (request !== generation.current) return;
      setLoading(false);
      setLoadError(!page);
      if (!page) return;
      setCursor(page.nextCursor);
      setItems(function apply(current) {
        const rows = new Map<string, NotificationItem>();
        if (next && current) for (const item of current) rows.set(item.id, item);
        for (const item of page.items) rows.set(item.id, item);
        return Array.from(rows.values());
      });
    });
  }, []);

  const reloadSelected = useCallback(function loadSelected() {
    if (!selectedId) return;
    const request = ++selectedGeneration.current;
    return fetchNotification(selectedId).then(function loaded(item) {
      if (request === selectedGeneration.current) setSelected({ id: selectedId, item });
    });
  }, [selectedId]);

  useFocusEffect(useCallback(function refreshOnFocus() {
    void reload();
    void reloadSelected();
    return function ignoreOldResults() {
      generation.current++;
      selectedGeneration.current++;
    };
  }, [reload, reloadSelected]));

  function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    void reload(cursor);
  }

  function retry() {
    setLoadError(false);
    void reload();
  }

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  async function open(item: NotificationItem) {
    if (!item.readAt) {
      const result = await markNotificationRead(item.id);
      if (result.ok) {
        const now = new Date().toISOString();
        setItems(function read(current) {
          return current?.map(row => row.id === item.id ? { ...row, readAt: now } : row) ?? null;
        });
        setSelected(function read(current) {
          return current?.item?.id === item.id ? { ...current, item: { ...current.item, readAt: now } } : current;
        });
        refreshBadge?.();
      } else if ("code" in result && result.code === "UNAUTHENTICATED") {
        await auth.signOut();
        return;
      } else {
        setActionError(common("errors.generic"));
        return;
      }
    }
    if (item.href) router.navigate(item.href);
  }

  async function act(item: NotificationItem, command: NotificationAction) {
    if (actionPending.current) return;
    actionPending.current = true;
    setBusyId(item.id);
    setActionError(null);
    const result = await submitNotificationAction(item.id, command);
    setBusyId(undefined);
    actionPending.current = false;
    if (result.ok) {
      if (command.action === "bought") showExtend(item);
      else setExtendFor(null);
      setConfirm(null);
      refreshBadge?.();
      await Promise.all([reload(), reloadSelected()]);
      return;
    }
    if ("code" in result && result.code === "UNAUTHENTICATED") {
      await auth.signOut();
      return;
    }
    if ("code" in result && result.code === "CONFLICT") {
      setExtendFor(null);
      setConfirm(null);
      setActionError(t("stale"));
      await Promise.all([reload(), reloadSelected()]);
    } else {
      setActionError(common("errors.generic"));
    }
  }

  async function choose(item: NotificationItem, action: NotificationAction["action"], restoreTrigger: () => void) {
    if (actionPending.current) return;
    returnFocus.current = restoreTrigger;
    setActionError(null);
    if (action === "extend") {
      showExtend(item);
      return;
    }
    if (action === "received") {
      setConfirm({ item, action });
      return;
    }
    if (action === "release") {
      if (item.event.kind !== "RESERVATION_OWNER_ASK") {
        setConfirm({ item, action });
        return;
      }
      actionPending.current = true;
      setBusyId(item.id);
      const result = await fetchReservationWarning(item.event.giftId);
      actionPending.current = false;
      setBusyId(undefined);
      if (result.ok) setConfirm({ item, action, warning: result.warning });
      else setActionError(common("errors.generic"));
      return;
    }
    await act(item, { action });
  }

  function showExtend(item: NotificationItem) {
    setExtendOpening(value => value + 1);
    setExtendFor(item);
  }

  function retrySelected() {
    void reloadSelected();
  }

  function confirmAction() {
    if (confirm) void act(confirm.item, { action: confirm.action });
  }

  function cancelConfirm() {
    if (!actionPending.current) setConfirm(null);
  }

  function confirmExtend(dueOn: string) {
    if (extendFor) void act(extendFor, { action: "extend", dueOn });
  }

  function focusTrigger() {
    returnFocus.current?.();
    returnFocus.current = null;
  }

  function closeExtend() {
    setExtendFor(null);
  }

  const selectedResult = selected?.id === selectedId ? selected : undefined;
  const selectedItem = selectedResult?.item;
  const displayedItems = selectedItem
    ? [selectedItem, ...(items ?? []).filter(item => item.id !== selectedItem.id)]
    : items;

  const received = confirm?.action === "received";
  const titleSnapshot = confirm && "titleSnapshot" in confirm.item.event ? confirm.item.event.titleSnapshot : "";
  const confirmBody = received ? gift("close.reservedBody") :
    confirm?.warning === "BOUGHT" ? gift("release.warningBought") :
      confirm?.warning === "GIVEN" ? gift("release.warningGiven") : undefined;

  return (
    <AppShell sidebar={<SidebarNav />} skipLabel={web("skipToContent")}>
      <Stack.Screen options={{ title: t("title") }} />
      <Screen>
        <SafeArea>
          <PageScroll>
            <PageContainer>
              <Column size="content" flexGrow={1} gap="$3" paddingHorizontal="$page-gutter medium:$page-gutter-lg"
                paddingVertical="$page-gutter"
              >
                <XStack alignItems="center" flexWrap="wrap" gap="$3">
                  <Button label={t("back")} variant="ghost" onPress={goBack} />
                  <Heading level={1} flexShrink={1}>{t("title")}</Heading>
                </XStack>
                {loadError ? (
                  <YStack gap="$2">
                    <Text role="alert">{t("error")}</Text>
                    <Button label={t("retry")} variant="secondary" onPress={retry} />
                  </YStack>
                ) : null}
                {selectedResult?.item === null ? (
                  <YStack gap="$2">
                    <Text role="alert">{t("selectedError")}</Text>
                    <Button label={t("retry")} variant="secondary" onPress={retrySelected} />
                  </YStack>
                ) : null}
                {actionError ? <Text role="alert">{actionError}</Text> : null}
                {!loadError && items === null ? <Text role="status">{t("loading")}</Text> : null}
                {displayedItems ? <NotificationsList items={displayedItems} selectedId={selectedId} busyId={busyId} onOpen={open} onAction={choose} /> : null}
                {cursor ? (
                  <Button label={t("more")} variant="secondary" busy={loading}
                    onPress={loadMore}
                  />
                ) : null}
              </Column>
            </PageContainer>
          </PageScroll>
          <ConfirmDialog variant="confirm" visible={confirm !== null} busy={busyId !== undefined}
            title={received ? gift("close.title", { title: titleSnapshot }) : gift("release.title")}
            body={confirmBody}
            confirmTone={confirm?.action === "release" && confirm.item.event.kind === "RESERVATION_OWNER_ASK" ? "destructive" : "primary"}
            confirmLabel={received ? gift("close.confirm") : gift("release.confirm")}
            cancelLabel={gift("release.cancel")} onConfirm={confirmAction} onCancel={cancelConfirm} onClosed={focusTrigger}
          />
          <ReservationExtendDialog key={extendOpening} open={extendFor !== null} timeZone={timeZone} busy={busyId !== undefined}
            onConfirm={confirmExtend} onClose={closeExtend} onClosed={focusTrigger} dateError={extendFor ? actionError ?? undefined : undefined}
          />
        </SafeArea>
      </Screen>
    </AppShell>
  );
}

NotificationsContent.displayName = "NotificationsContent";
