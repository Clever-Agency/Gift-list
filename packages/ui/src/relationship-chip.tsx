import { View, styled } from "@tamagui/core";
import { Text } from "./text";
import { spacing } from "./tokens";

const Chip = styled(View, {
  name: "GLRelationshipChip",
  alignSelf: "flex-start",
  minHeight: "$pill-height",
  justifyContent: "center",
  borderRadius: "$full",
  // `DESIGN.md` → Мелкие элементы: отношение — как StatusPill, фон `muted`.
  paddingHorizontal: spacing["icon-inline"] / 2,
  backgroundColor: "$muted",
});

export type RelationshipChipProps = {
  /** «Друзья», «Ожидает ответа», «Зовёт в друзья», «Это вы». */
  label: string;
  /**
   * `DESIGN.md` → Мелкие элементы: у «Зовёт в друзья» текст `primary` 600,
   * потому что приглашение ждёт ответа; остальные отношения — `muted-foreground`.
   */
  emphasis?: boolean;
  testID?: string;
};

/** A static relation chip of a profile or a person row. Not a button. */
export function RelationshipChip({ label, emphasis = false, testID }: RelationshipChipProps) {
  return (
    <Chip testID={testID}>
      <Text
        kind="caption"
        tone={emphasis ? "primary" : "muted"}
        fontWeight={emphasis ? "600" : undefined}
      >
        {label}
      </Text>
    </Chip>
  );
}

RelationshipChip.displayName = "RelationshipChip";
