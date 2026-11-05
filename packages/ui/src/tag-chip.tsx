import { XStack } from "@tamagui/stacks";
import { Pressable } from "./pressable";
import { Text } from "./text";

export type TagChipVariant = "picker" | "card";

export type TagChipProps = {
  /** Visible text and the accessible name of the toggle or the chip. */
  label: string;
  /**
   * `picker` (default) — the form control: a fixed tag is a checkbox, a custom
   * one a chip with a cross. `card` — a static label on a gift card, not a
   * control (`DESIGN.md` → WishCard).
   */
  variant?: TagChipVariant;
  /** A fixed tag is a checkbox: selected chips unfill and show a check. */
  selected?: boolean;
  /** Toggles the fixed tag. Ignored when `onRemove` is set or on a card chip. */
  onPress?: () => void;
  /**
   * The accessible name of the cross, e.g. «Убрать тег мечта». A chip with a
   * cross is a removable custom tag: its label is text, not a checkbox.
   */
  removeLabel?: string;
  onRemove?: () => void;
  /**
   * The accessible name of a static card chip when its visible text is not
   * enough (the «+N» chip names the tags it hides). Unused by picker chips.
   */
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * Tag picker chip (`DESIGN.md` → Tag picker, `components.tag-chip`). A fixed
 * tag is a `checkbox` with its own state; a custom tag is a chip with a cross
 * that removes it. Both keep the 44 px touch target and take their copy from
 * the caller: fixed labels come from the server catalogue, never from here.
 *
 * `variant="card"` is the same visual without any control semantics: a gift
 * card shows tags that are not pressable in R1 (`DESIGN.md` → WishCard).
 */
export function TagChip({
  label,
  variant = "picker",
  selected = false,
  onPress,
  removeLabel,
  onRemove,
  accessibilityLabel,
  testID,
}: TagChipProps) {
  if (variant === "card") {
    return (
      <XStack
        testID={testID}
        role={accessibilityLabel ? "note" : undefined}
        aria-label={accessibilityLabel}
        accessible={accessibilityLabel ? true : undefined}
        alignSelf="flex-start"
        flexShrink={0}
        maxWidth="100%"
        alignItems="center"
        minHeight="$chip-height"
        borderWidth={1}
        borderColor="$border"
        borderRadius="$sm"
        backgroundColor="$background"
        paddingHorizontal="$2"
      >
        <Text kind="caption" tone="muted" flexShrink={1} minWidth={0}>
          {label}
        </Text>
      </XStack>
    );
  }

  if (onRemove) {
    return (
      <XStack
        testID={testID}
        role="group"
        aria-label={label}
        alignItems="center"
        gap="$1"
        borderWidth={1}
        borderColor="$border"
        borderRadius="$sm"
        backgroundColor="$background"
        paddingLeft="$2"
      >
        <Text kind="caption" tone="muted">
          {label}
        </Text>
        <Pressable
          role="button"
          aria-label={removeLabel ?? label}
          onPress={onRemove}
          minHeight="$touch-target"
          minWidth="$touch-target"
          alignItems="center"
          justifyContent="center"
        >
          <Text kind="caption" tone="muted" aria-hidden>
            ×
          </Text>
        </Pressable>
      </XStack>
    );
  }

  return (
    <Pressable
      testID={testID}
      role="checkbox"
      aria-label={label}
      aria-checked={selected}
      onPress={onPress}
      minHeight="$touch-target"
      minWidth="$touch-target"
      flexDirection="row"
      alignItems="center"
      gap="$1"
      borderWidth={1}
      borderColor={selected ? "$border-strong" : "$border"}
      borderRadius="$sm"
      backgroundColor={selected ? "$muted" : "$background"}
      paddingHorizontal="$2"
    >
      <Text kind="caption" tone={selected ? "default" : "muted"}>
        {label}
      </Text>
      {selected ? (
        <Text kind="caption" tone="muted" aria-hidden>
          ✓
        </Text>
      ) : null}
    </Pressable>
  );
}

TagChip.displayName = "TagChip";

export type TagChipListProps = {
  /**
   * Server labels in display order (`GiftCard.tags[].label`). Fixed labels are
   * already translated on the server; the package never translates or re-sorts.
   */
  labels: readonly string[];
  /**
   * Chips shown before the rest collapse into one «+N» (`DESIGN.md` → WishCard:
   * three). The caller keeps the whole list in the accessible card name.
   */
  max?: number;
  /**
   * The visible text of the collapsed chip, e.g. «+2». Comes from the app: the
   * package keeps no interface copy.
   */
  moreLabel: (hiddenCount: number) => string;
  /**
   * The accessible name of the collapsed chip, naming the labels it hides.
   * Without it a screen reader only hears the count.
   */
  moreAccessibilityLabel?: (hiddenCount: number, hiddenLabels: readonly string[]) => string;
  testID?: string;
};

/**
 * The tag row of a gift card: up to `max` static chips and one «+N» chip for the
 * rest (`DESIGN.md` → WishCard). Wraps by the card width; a long custom label
 * wraps inside its chip instead of overflowing. Tags are not controls here.
 */
export function TagChipList({
  labels,
  max = 3,
  moreLabel,
  moreAccessibilityLabel,
  testID,
}: TagChipListProps) {
  if (labels.length === 0) return null;

  const limit = Number.isFinite(max) ? Math.max(0, Math.trunc(max)) : 3;
  const visible = labels.slice(0, limit);
  const hiddenLabels = labels.slice(limit);
  const hidden = hiddenLabels.length;

  function chipTestID(index: number): string | undefined {
    return testID ? `${testID}-${index}` : undefined;
  }

  return (
    <XStack testID={testID} flexWrap="wrap" alignItems="center" gap="$1">
      {visible.map(function renderVisibleTag(label, index) {
        return (
          <TagChip
            key={`${index}:${label}`}
            variant="card"
            label={label}
            testID={chipTestID(index)}
          />
        );
      })}
      {hidden > 0 ? (
        <TagChip
          variant="card"
          label={moreLabel(hidden)}
          accessibilityLabel={moreAccessibilityLabel?.(hidden, hiddenLabels)}
          testID={testID ? `${testID}-more` : undefined}
        />
      ) : null}
    </XStack>
  );
}

TagChipList.displayName = "TagChipList";
