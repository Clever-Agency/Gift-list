import { Heading, Pressable, Text, XStack, YStack } from "@gift-list/ui";
import type { ReactNode } from "react";

/**
 * Story 5.3 (`DESIGN.md` → Мелкие элементы, `EXPERIENCE.md` → State Patterns):
 * «Получено (N)» у владельца, «Уже подарено» у зрителей и «Архив (N)» — свёрнутая
 * секция. Заголовок — кнопка с `aria-expanded` и шевроном, карточки лежат в
 * сетке той же ширины, что и активная.
 *
 * Свёрнута по умолчанию: в DOM карточек нет, пока секцию не открыли, поэтому
 * скрытые желания не попадают ни в Tab-порядок, ни в озвучку. Тексты приходят
 * пропсами: у секции нет своего каталога.
 */
export function ClosedSection({
  label,
  expanded,
  onToggle,
  children,
  testID,
  toggleTestID,
}: {
  /** «Получено (3)», «Уже подарено», «Архив (2)». */
  label: string;
  expanded: boolean;
  onToggle: () => void;
  children?: ReactNode;
  testID?: string;
  toggleTestID?: string;
}) {
  return (
    <YStack gap="$2" width="100%" testID={testID}>
      <Pressable
        aria-expanded={expanded}
        onPress={onToggle}
        minHeight="$touch-target"
        justifyContent="center"
        testID={toggleTestID}
      >
        <XStack alignItems="center" gap="$1">
          {/* The chevron is the visible state of `aria-expanded`, not a second name. */}
          <Text kind="heading" aria-hidden>
            {expanded ? "▾" : "▸"}
          </Text>
          <Heading flexShrink={1}>{label}</Heading>
        </XStack>
      </Pressable>
      {expanded ? (
        <XStack role="list" flexWrap="wrap" gap="$grid-gap" alignItems="flex-start">
          {children}
        </XStack>
      ) : null}
    </YStack>
  );
}

ClosedSection.displayName = "ClosedSection";
