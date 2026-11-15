import { XStack } from "@tamagui/stacks";
import { useRef, type FocusEvent, type KeyboardEvent } from "react";
import { focusInLayer, type FocusTarget } from "./focus";
import { Pressable } from "./pressable";
import { Text } from "./text";

/** One tab of a segment: the visible label and an optional count badge. */
export type SegmentTab = {
  key: string;
  /** The visible text. The badge count is not part of it. */
  label: string;
  /** The count in the badge, e.g. incoming invites; `undefined` shows no badge. */
  badge?: number;
};

export type SegmentTabsProps = {
  /** The accessible name of the whole group. */
  label: string;
  tabs: SegmentTab[];
  /** The key of the selected tab. */
  value: string;
  onChange: (key: string) => void;
  testID?: string;
};

/**
 * `DESIGN.md` → Мелкие элементы: the segment «Друзья · Подписки · Запросы» — text
 * `label`, the selected one 600 with a 2 px `primary` underline. The group is a
 * `tablist` of real tabs (`aria-selected`), the arrows move between them and
 * activate the neighbour (WAI-ARIA APG, automatic activation), Home and End jump
 * to the ends. The count badge is drawn next to its tab and read with its name.
 */
export function SegmentTabs({ label, tabs, value, onChange, testID }: SegmentTabsProps) {
  const nodes = useRef(new Map<string, FocusTarget | null>());

  function setNode(key: string) {
    return function storeNode(node: FocusTarget | null) {
      nodes.current.set(key, node);
    };
  }

  function move(step: 1 | -1) {
    const index = tabs.findIndex((tab) => tab.key === value);
    if (index < 0) return;
    const next = tabs[(index + step + tabs.length) % tabs.length];
    if (next === undefined) return;
    onChange(next.key);
    focusInLayer(nodes.current.get(next.key));
  }

  function jump(edge: "first" | "last") {
    const next = edge === "first" ? tabs[0] : tabs[tabs.length - 1];
    if (next === undefined) return;
    onChange(next.key);
    focusInLayer(nodes.current.get(next.key));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      jump("first");
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      jump("last");
    }
  }

  return (
    <XStack
      role="tablist"
      aria-label={label}
      alignItems="center"
      flexWrap="wrap"
      gap="$3"
      testID={testID}
    >
      {tabs.map(function renderTab(tab) {
        const selected = tab.key === value;
        function selectTab() {
          onChange(tab.key);
        }
        function storeNode(node: FocusTarget | null) {
          setNode(tab.key)(node);
        }
        function onFocus(event: FocusEvent<HTMLElement>) {
          // A browser focus moves with the keyboard; the reader does not need a change.
          event.currentTarget.scrollIntoView?.({ block: "nearest", inline: "nearest" });
        }
        return (
          <Pressable
            key={tab.key}
            ref={storeNode}
            role="tab"
            aria-selected={selected}
            aria-label={tab.badge === undefined ? tab.label : `${tab.label}, ${tab.badge}`}
            onPress={selectTab}
            onKeyDown={handleKeyDown}
            onFocus={onFocus}
            alignItems="center"
            justifyContent="center"
            gap="$1"
            minHeight="$touch-target"
            paddingHorizontal="$1"
            borderBottomWidth={selected ? 2 : 0}
            borderBottomColor="$primary"
          >
            <Text kind="label" tone={selected ? "primary" : "default"} fontWeight={selected ? "600" : undefined}>
              {tab.label}
            </Text>
            {tab.badge === undefined ? null : (
              <XStack
                minWidth={20}
                height={20}
                paddingHorizontal="$1"
                alignItems="center"
                justifyContent="center"
                borderRadius="$full"
                backgroundColor="$muted"
              >
                <Text kind="caption" tone="muted" fontWeight="600">
                  {tab.badge}
                </Text>
              </XStack>
            )}
          </Pressable>
        );
      })}
    </XStack>
  );
}

SegmentTabs.displayName = "SegmentTabs";
