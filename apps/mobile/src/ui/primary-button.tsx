import { Button } from "@gift-list/ui";

/**
 * The primary action of a screen. A thin wrapper over `Button` from `@gift-list/ui`
 * that keeps the old `disabled` contract: a disabled primary button is announced
 * busy, because it is disabled while its request runs. Screens move to `Button`
 * directly with the screens task of Story 1.9.
 */
export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return <Button label={label} onPress={onPress} busy={Boolean(disabled)} />;
}

PrimaryButton.displayName = "PrimaryButton";
