import type { NotificationAction, NotificationItem } from "@gift-list/contracts";
import { notificationChangedFields, notificationText } from "@gift-list/contracts";
import { Bell, Button, CalendarCheck, EmptyState, NotificationRow, restoreFocus, Text, Users, YStack } from "@gift-list/ui";
import { useRef, type ComponentRef } from "react";
import { useLocale, useTranslations } from "use-intl";

export type NotificationsListProps = {
  items: readonly NotificationItem[];
  selectedId?: string;
  busyId?: string;
  onOpen: (item: NotificationItem) => void;
  onAction: (item: NotificationItem, action: NotificationAction["action"], returnFocus: () => void) => void;
};

export function NotificationsList({ items, selectedId, busyId, onOpen, onAction }: NotificationsListProps) {
  const t = useTranslations("notifications");
  const locale = useLocale();

  if (!items.length) return <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />;

  return (
    <YStack role="list" testID="notifications-list">
      {items.map(function render(item) {
        const event = item.event;
        const request = "actionable" in event;
        const actions: NotificationAction["action"][] = [];
        if (request && event.actionable) {
          if (event.kind === "RESERVATION_DUE") actions.push(event.bought ? "clearBought" : "bought", "extend", "release");
        }
        const time = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" })
          .format(new Date(item.createdAt));
        const icon = event.kind.startsWith("FRIEND_")
          ? <Users size={20} />
          : "titleSnapshot" in event ? <CalendarCheck size={20} /> : <Bell size={20} />;
        const holder = "holderName" in event && event.holderName ? t("holder", { name: event.holderName }) : null;
        const stale = request && !event.actionable ? t("stale") : null;
        const fields = notificationChangedFields(event, locale);
        const subtitle = [holder, stale, fields].filter(Boolean).join(". ");

        function open() {
          onOpen(item);
        }

        return (
          <NotificationRow key={item.id} message={notificationText(event, locale)} time={time}
            icon={icon} unread={!item.readAt} newLabel={t("new")} selected={item.id === selectedId}
            subtitle={subtitle || undefined} onPress={!item.readAt || item.href ? open : undefined}
            actions={actions.length ? actions.map(function renderAction(action) {
              return <NotificationActionButton key={action === "clearBought" ? "bought" : action} label={t(action)} disabled={busyId !== undefined}
                onPress={function act(returnFocus) { onAction(item, action, returnFocus); }}
              />;
            }) : null}
          />
        );
      })}
      {busyId ? <Text role="status" tone="muted">{t("saving")}</Text> : null}
    </YStack>
  );
}

NotificationsList.displayName = "NotificationsList";

function NotificationActionButton({ label, disabled, onPress }: {
  label: string;
  disabled: boolean;
  onPress: (returnFocus: () => void) => void;
}) {
  const node = useRef<ComponentRef<typeof Button>>(null);

  function returnFocus() {
    restoreFocus(node.current);
  }

  function press() {
    onPress(returnFocus);
  }

  return <Button variant="secondary" ref={node} disabled={disabled} label={label} onPress={press} />;
}

NotificationActionButton.displayName = "NotificationActionButton";
