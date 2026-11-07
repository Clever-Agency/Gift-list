import { Tooltip } from "@tamagui/tooltip";
import { useState } from "react";
import { Info } from "./icons";
import type { InfoButtonProps } from "./info-button.types";
import { Pressable } from "./pressable";
import { spacing } from "./tokens";
import { Text } from "./text";

/**
 * An icon-only «what does this link show?» control. On the web Tamagui's official
 * `Tooltip` opens on hover, on keyboard focus and on a tap/click; its text is the
 * trigger's `aria-describedby`. Native has no Tooltip output (the package renders
 * only the trigger there), so `info-button.native.tsx` uses a Tamagui `Dialog`.
 */
export function InfoButton({ label, explanation, testID }: InfoButtonProps) {
  const [open, setOpen] = useState(false);

  function handleOpenChange(next: boolean) {
    setOpen(next);
  }

  /** Touch and click open the tooltip; hover and focus already do it themselves. */
  function openInfo() {
    setOpen(true);
  }

  return (
    <Tooltip open={open} onOpenChange={handleOpenChange} placement="bottom" delay={{ open: 150, close: 100 }}>
      <Tooltip.Trigger asChild="except-style">
        <Pressable
          testID={testID}
          aria-label={label}
          onPress={openInfo}
          width="$touch-target"
          height="$touch-target"
          alignItems="center"
          justifyContent="center"
          borderRadius="$full"
          color="$foreground"
          backgroundColor="transparent hover:$surface press:$surface"
        >
          <Info testID={testID ? `${testID}-icon` : undefined} size={spacing["icon-inline"]} />
        </Pressable>
      </Tooltip.Trigger>
      <Tooltip.Content
        maxWidth={320}
        paddingHorizontal="$2.5"
        paddingVertical="$1.5"
        backgroundColor="$surface"
        borderColor="$border-strong"
        borderWidth={1}
        borderRadius="$md"
      >
        <Text>{explanation}</Text>
      </Tooltip.Content>
    </Tooltip>
  );
}

InfoButton.displayName = "InfoButton";
