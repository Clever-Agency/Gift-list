import { View } from "@tamagui/core";
import { YStack } from "@tamagui/stacks";
import { forwardRef, useState, type ComponentRef } from "react";
import { BottomSheet } from "./bottom-sheet";
import { Pressable } from "./pressable";
import { Text } from "./text";

/** One row of the ⋮ menu. `destructive` is drawn red and goes after the divider. */
export type OverflowMenuItem = {
  key: string;
  /** The visible text and the accessible name of the action. */
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

export type OverflowMenuProps = {
  /**
   * The accessible name of the trigger, e.g. «Действия: Алёна» (`EXPERIENCE.md`
   * → подпись ⋮ для диктора). The visible glyph is only the ellipsis.
   */
  label: string;
  /** The heading of the opened layer, e.g. the person's name. */
  title: string;
  items: OverflowMenuItem[];
  /** The visible glyph of the trigger; vertical `⋮` by default (`DESIGN.md` → v8). */
  glyph?: string;
  testID?: string;
};

/**
 * `DESIGN.md` → PersonRow / Мелкие элементы: the `⋮` trigger is a 44 × 44 control
 * (v8: the dots stand in a column) and the menu itself is `{components.user-menu}`.
 * A phone shows the actions in a bottom sheet with the person's name in the heading;
 * a divider separates the destructive actions and they stay last, whatever order the
 * caller passes.
 *
 * The trigger is a sibling of the profile link, never its child: a press on `⋮`
 * must not open the profile. `forwardRef` reaches the trigger, so a screen can
 * put focus back on it after an action.
 */
export const OverflowMenu = forwardRef<ComponentRef<typeof Pressable>, OverflowMenuProps>(
  function OverflowMenu({ label, title, items, glyph = "⋮", testID }, ref) {
    const [open, setOpen] = useState(false);
    const ordered = [
      ...items.filter((item) => !item.destructive),
      ...items.filter((item) => item.destructive),
    ];
    const hasDestructive = ordered.some((item) => item.destructive);

    function openMenu() {
      setOpen(true);
    }

    function closeMenu() {
      setOpen(false);
    }

    function select(item: OverflowMenuItem) {
      setOpen(false);
      item.onPress();
    }

    return (
      <>
        <Pressable
          ref={ref}
          role="button"
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          onPress={openMenu}
          width="$touch-target"
          height="$touch-target"
          alignItems="center"
          justifyContent="center"
          borderRadius="$md"
          testID={testID}
        >
          <Text kind="body" tone="muted" aria-hidden>
            {glyph}
          </Text>
        </Pressable>
        <BottomSheet open={open} title={title} onClose={closeMenu}>
          <YStack gap="$1">
            {ordered.map(function renderItem(item, index) {
              // One divider, right before the first destructive action.
              const divider =
                hasDestructive && item.destructive === true && ordered[index - 1]?.destructive !== true;
              return (
                <YStack key={item.key} gap="$1">
                  {divider ? (
                    <View height={1} backgroundColor="$border" marginVertical="$1" />
                  ) : null}
                  <Pressable
                    role="button"
                    onPress={function chooseItem() {
                      select(item);
                    }}
                    minHeight="$touch-target"
                    paddingHorizontal="$3"
                    justifyContent="center"
                    borderRadius="$md"
                    backgroundColor="hover:$muted press:$muted"
                  >
                    <Text kind="body" tone={item.destructive ? "destructive" : "default"}>
                      {item.label}
                    </Text>
                  </Pressable>
                </YStack>
              );
            })}
          </YStack>
        </BottomSheet>
      </>
    );
  },
);

OverflowMenu.displayName = "OverflowMenu";
