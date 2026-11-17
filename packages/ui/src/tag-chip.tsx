import { useTheme } from "@tamagui/core";
import { XStack } from "@tamagui/stacks";
import { forwardRef, type ComponentRef, type ReactNode } from "react";
import { a11yHintProps } from "./a11y-hint";
import { Star } from "./icons";
import { Pressable } from "./pressable";
import { Text } from "./text";
import { spacing } from "./tokens";

export type TagChipVariant = "picker" | "card" | "custom";

/** `button` is the «Свой тег» trigger; `checkbox` is a fixed catalogue tag. */
export type TagChipRole = "checkbox" | "button";

/**
 * A validation error that belongs to this chip alone (Q-09). The caller renders
 * the message once and passes its id, so a screen reader reads the same text on
 * the chip without a duplicate node. `message` is the phone's accessibility hint:
 * `aria-describedby` is browser-only.
 */
export type TagChipError = {
  id: string;
  message: string;
};

export type TagChipProps = {
  /** Visible text and the accessible name of the toggle or the chip. */
  label: string;
  /**
   * `picker` (default) — the form control: a fixed tag is a checkbox, a custom
   * one a chip with a cross. `card` — a static label on a gift card, not a
   * control (`DESIGN.md` → WishCard). `custom` — the owner's own tag: accent
   * outline and the Lucide star before the text (UI4).
   */
  variant?: TagChipVariant;
  /** A fixed tag is a checkbox: selected chips unfill and show a check. */
  selected?: boolean;
  /**
   * Toggles the fixed tag, opens the custom-tag field, or — on a chip with a
   * cross — opens that custom tag for editing.
   */
  onPress?: () => void;
  /** `button` for the «Свой тег» trigger; `checkbox` (default) for a fixed tag. */
  role?: TagChipRole;
  /** For the trigger: whether the custom-tag field is open. */
  expanded?: boolean;
  /** For the trigger: the id of the field it opens. */
  controls?: string;
  /**
   * The accessible name of the cross, e.g. «Убрать тег мечта». A chip with a
   * cross is a removable custom tag: its label is text, not a checkbox.
   */
  removeLabel?: string;
  onRemove?: () => void;
  /** The accessible name of the pressable label on a removable custom tag, e.g. «Редактировать тег мечта». */
  editLabel?: string;
  /**
   * The accessible name when the visible text is not enough: the «+N» card chip
   * names the tags it hides, and a live draft keeps its control's purpose
   * («Свой тег: …»). Defaults to `label`.
   */
  accessibilityLabel?: string;
  /**
   * An item-specific validation error from the screen: the chip control is
   * outlined in `$destructive` (DESIGN.md → Tag picker: a visible frame, ARIA
   * in addition to it), marked invalid and described by the message rendered
   * once by the caller. Ignored by a static card chip.
   */
  error?: TagChipError;
  testID?: string;
};

/**
 * The node of the pressable chip (the add trigger and fixed tags), so the form
 * can bring focus back after its editor closes. Removable and card chips render
 * a different root and do not forward it.
 */
export type TagChipRef = ComponentRef<typeof Pressable>;

/** The star in front of a custom tag, in the theme accent; `null` for catalogue and card chips. */
function star(size: number, color: string | undefined, testID?: string): ReactNode {
  return (
    <Star
      size={size}
      color={color}
      testID={testID ? `${testID}-star` : undefined}
    />
  );
}

/**
 * Tag picker chip (`DESIGN.md` → Tag picker, `components.tag-chip`). A fixed
 * tag is a `checkbox` with its own state; a custom tag is a chip with a cross
 * that removes it and, when `onPress` is set, a pressable label that edits it.
 * Both keep the 44 px touch target and take their copy from the caller: fixed
 * labels come from the server catalogue, never from here.
 *
 * `variant="card"` is the same visual without any control semantics: a gift
 * card shows tags that are not pressable in R1 (`DESIGN.md` → WishCard).
 */
export const TagChip = forwardRef<TagChipRef, TagChipProps>(function TagChip(
  {
    label,
    variant = "picker",
    selected = false,
    onPress,
    role = "checkbox",
    expanded,
    controls,
    removeLabel,
    onRemove,
    editLabel,
    accessibilityLabel,
    error,
    testID,
  },
  ref,
) {
  const theme = useTheme();
  const accent = theme.accent;
  const accentValue =
    accent && typeof accent.get === "function" ? accent.get("web") : undefined;
  const starColor = typeof accentValue === "string" ? accentValue : undefined;
  const custom = variant === "custom";

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
        maxWidth="100%"
        borderWidth={1}
        borderColor={error ? "$destructive" : custom ? "$accent" : "$border"}
        borderRadius="$sm"
        backgroundColor={custom ? "$surface" : "$background"}
        paddingLeft="$2"
      >
        {onPress ? (
          <Pressable
            role="button"
            aria-label={editLabel ?? label}
            aria-invalid={error ? true : undefined}
            {...a11yHintProps({ hint: error?.message, describedBy: error?.id })}
            onPress={onPress}
            flexDirection="row"
            alignItems="center"
            gap="$1"
            minHeight="$touch-target"
            minWidth="$touch-target"
            flexShrink={1}
          >
            {custom ? star(spacing["icon-small"], starColor, testID) : null}
            <Text kind="caption" tone={custom ? "default" : "muted"} flexShrink={1} minWidth={0}>
              {label}
            </Text>
          </Pressable>
        ) : (
          <>
            {custom ? star(spacing["icon-small"], starColor, testID) : null}
            <Text kind="caption" tone={custom ? "default" : "muted"} flexShrink={1} minWidth={0}>
              {label}
            </Text>
          </>
        )}
        <Pressable
          role="button"
          aria-label={removeLabel ?? label}
          aria-invalid={error ? true : undefined}
          {...a11yHintProps({ hint: error?.message, describedBy: error?.id })}
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

  const isButton = role === "button";
  return (
    <Pressable
      ref={ref}
      testID={testID}
      role={role}
      aria-label={accessibilityLabel ?? label}
      aria-checked={isButton ? undefined : selected}
      aria-expanded={isButton ? expanded : undefined}
      aria-controls={isButton ? controls : undefined}
      aria-invalid={error ? true : undefined}
      {...a11yHintProps({ hint: error?.message, describedBy: error?.id })}
      onPress={onPress}
      minHeight="$touch-target"
      minWidth="$touch-target"
      flexDirection="row"
      alignItems="center"
      gap="$1"
      maxWidth="100%"
      borderWidth={1}
      borderColor={
        error ? "$destructive" : custom ? "$accent" : selected ? "$border-strong" : "$border"
      }
      borderRadius="$sm"
      backgroundColor={custom ? "$surface" : selected ? "$muted" : "$background"}
      paddingHorizontal="$2"
    >
      {custom ? star(spacing["icon-small"], starColor, testID) : null}
      <Text
        kind="caption"
        tone={custom || selected ? "default" : "muted"}
        flexShrink={1}
        minWidth={0}
      >
        {label}
      </Text>
      {selected && !custom ? (
        <Text kind="caption" tone="muted" aria-hidden>
          ✓
        </Text>
      ) : null}
    </Pressable>
  );
});

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
