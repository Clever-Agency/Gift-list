import { View, styled } from "@tamagui/core";
import { XStack } from "@tamagui/stacks";
import { Text } from "./text";
import { spacing } from "./tokens";

const Pill = styled(XStack, {
  name: "GLStatusPill",
  alignSelf: "flex-start",
  minHeight: "$pill-height",
  alignItems: "center",
  gap: "$1",
  // v8: a neutral plate with a 1 px frame; the dot is the only coloured element
  // (`DESIGN.md` → StatusPill), and the word next to it carries the meaning.
  borderWidth: 1,
  borderColor: "$border",
  backgroundColor: "$surface",
  borderRadius: "$sm",
  // `DESIGN.md` → StatusPill: padding 0 10 (half of `icon-inline`).
  paddingHorizontal: spacing["icon-inline"] / 2,
});

export type StatusPillStatus = "open" | "reserved" | "closed";

const DOTS = {
  open: "$status-open",
  reserved: "$status-reserved",
  closed: "$status-closed",
} as const;

export type StatusPillProps = {
  status: StatusPillStatus;
  /** The status spelled out: it is never shown by colour alone. */
  label: string;
};

/**
 * `DESIGN.md` → StatusPill: AD-12 status, always spelled out. Not a button.
 * The plate is neutral in both themes; the dot takes the status colour and is
 * decorative, because the label already says «Открыт» / «Забронирован» / «Получен».
 */
export function StatusPill({ status, label }: StatusPillProps) {
  return (
    <Pill>
      <View
        width={6}
        height={6}
        borderRadius="$full"
        backgroundColor={DOTS[status]}
        aria-hidden
      />
      <Text kind="caption" color="$muted-foreground">
        {label}
      </Text>
    </Pill>
  );
}

StatusPill.displayName = "StatusPill";
