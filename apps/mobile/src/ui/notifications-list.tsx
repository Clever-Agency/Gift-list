import type { NotificationAction, NotificationItem } from "@gift-list/contracts";
import { notificationChangedFields, notificationDetails, notificationText } from "@gift-list/contracts";
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
        // Story 6.6: only the deadline notice and the kept wish-expiry variant
        // ask the holder for an answer. The released variant has no controls.
        const request = event.kind === "RESERVATION_DUE" ||
          (event.kind === "WISH_EXPIRY" && event.released === false);
        const actionable = request && "actionable" in event && event.actionable === true;
        const actions: NotificationAction["action"][] = [];
        if (actionable) {
          if (event.kind === "RESERVATION_DUE") {
            // Story 5.7 and D-12: «Подарил» first, and «Продлить до…» only while the
            // deadline has not passed. A row written before `dueAt` existed keeps the
            // old set: the server still refuses a late extension itself.
            actions.push("given", event.bought ? "clearBought" : "bought");
            if (extendStillOpen(event.dueAt)) actions.push("extend");
            actions.push("release");
          } else if (event.kind === "WISH_EXPIRY") {
            // Story 6.6 (D-49): the same «Подарил» action and API as the deadline
            // notice; the server refuses it once the reservation is not live.
            actions.push("given");
          }
        }
        const time = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" })
          .format(new Date(item.createdAt));
        const icon = event.kind.startsWith("FRIEND_")
          ? <Users size={20} />
          : "titleSnapshot" in event ? <CalendarCheck size={20} /> : <Bell size={20} />;
        const stale = request && !actionable ? t("stale") : null;
        const fields = notificationChangedFields(event, locale);
        // Story 7.3 (FR-34): a birthday reminder adds the number of open wishes
        // and up to three titles under its first line.
        const details = notificationDetails(event, locale);
        const subtitle = [stale, fields, ...details].filter(Boolean).join(". ");

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

/**
 * CLE-124/S9b-3 (D-12, §10.4): the expiry notice names the release date and offers
 * no extension — the stored deadline is the exclusive end of the chosen day, so
 * the action lives only while that instant is ahead. A reminder is always ahead of
 * it, and a row without `dueAt` keeps the pre-change set.
 */
function extendStillOpen(dueAt: string | undefined, now = Date.now()): boolean {
  if (dueAt === undefined) return true;
  return Date.parse(dueAt) > now;
}

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
