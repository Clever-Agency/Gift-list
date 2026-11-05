import { View, styled } from "@tamagui/core";
import { Text } from "./text";
import { spacing } from "./tokens";

const Pill = styled(View, {
  name: "GLStatusPill",
  alignSelf: "flex-start",
  minHeight: "$pill-height",
  justifyContent: "center",
  borderRadius: "$full",
  // `DESIGN.md` → StatusPill: padding 0 10 (half of `icon-inline`).
  paddingHorizontal: spacing["icon-inline"] / 2,
  variants: {
    status: {
      open: { backgroundColor: "$muted" },
      reserved: { backgroundColor: "$status-reserved-bg" },
      closed: { backgroundColor: "$muted" },
    },
  } as const,
});

export type StatusPillStatus = "open" | "reserved" | "closed";

const TONES = {
  open: "$status-open",
  reserved: "$status-reserved",
  closed: "$status-closed",
} as const;

export type StatusPillProps = {
  status: StatusPillStatus;
  /** The status spelled out: it is never shown by colour alone. */
  label: string;
};

/** `DESIGN.md` → StatusPill: AD-12 status, always spelled out. Not a button. */
export function StatusPill({ status, label }: StatusPillProps) {
  return (
    <Pill status={status}>
      <Text kind="caption" color={TONES[status]}>
        {label}
      </Text>
    </Pill>
  );
}

StatusPill.displayName = "StatusPill";
