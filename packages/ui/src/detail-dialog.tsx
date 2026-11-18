import type { ReactNode } from "react";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { Text } from "./text";
import { YStack } from "./layout";

export type DetailFactView = {
  id: string;
  label: string;
  value: string;
  href?: string;
};

export type DetailDialogProps = {
  open: boolean;
  /** Accessible name of the dialog. The wish title. */
  title: string;
  facts?: DetailFactView[];
  /** Loading, error or unavailable copy. Facts stay hidden while it is set. */
  notice?: string;
  retry?: { label: string; onPress: () => void };
  closeLabel: string;
  /** Native only: the web uses `href`. A phone has no anchor navigation. */
  onOpenHref?: (href: string) => void;
  onClose: () => void;
  onClosed?: () => void;
  /** Owner-only actions, for example «Изменить желание». */
  actions?: ReactNode;
  testID?: string;
};

/**
 * Wish details (`DESIGN.md` → Dialog, CLE-84): a `dialog` whose name is the wish
 * title. Compact widths take almost the whole screen; medium and wider stay
 * within `detail-width`. The body scrolls. Strings come from the caller.
 */
export function DetailDialog({
  open,
  title,
  facts = [],
  notice,
  retry,
  closeLabel,
  onOpenHref,
  onClose,
  onClosed,
  actions,
  testID,
}: DetailDialogProps) {
  return (
    <Dialog
      open={open}
      title={title}
      layout="detail"
      onClose={onClose}
      onClosed={onClosed}
      closeAction={{
        label: closeLabel,
        icon: (
          <Text kind="heading" aria-hidden>
            ×
          </Text>
        ),
      }}
      actions={actions}
      testID={testID}
    >
      {notice ? (
        <YStack gap="$3">
          <Text kind="body">{notice}</Text>
          {retry ? (
            <Button label={retry.label} variant="secondary" onPress={retry.onPress} />
          ) : null}
        </YStack>
      ) : (
        <YStack gap="$3">
          {facts.map(function renderFact(fact) {
            return (
              <YStack key={fact.id} gap="$1">
                <Text kind="label" tone="muted">
                  {fact.label}
                </Text>
                {fact.href ? (
                  <Button
                    label={fact.value}
                    href={fact.href}
                    variant="ghost"
                    ariaLabel={`${fact.label}: ${fact.value}`}
                    onPress={
                      onOpenHref
                        ? function openLinkedFact() {
                            onOpenHref(fact.href as string);
                          }
                        : undefined
                    }
                  />
                ) : (
                  <Text kind="body">{fact.value}</Text>
                )}
              </YStack>
            );
          })}
        </YStack>
      )}
    </Dialog>
  );
}

DetailDialog.displayName = "DetailDialog";
