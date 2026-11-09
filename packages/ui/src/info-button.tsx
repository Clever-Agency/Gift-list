import { Tooltip } from "@tamagui/tooltip";
import { useRef, useState } from "react";
import { Info } from "./icons";
import type { InfoButtonProps } from "./info-button.types";
import { Pressable } from "./pressable";
import { spacing } from "./tokens";
import { Text } from "./text";

/**
 * An icon-only «what does this link show?» control. On the web Tamagui's official
 * `Tooltip` opens on hover, on keyboard focus and on a tap/click, and a second
 * tap closes it; its text is the trigger's `aria-describedby`. Native has no
 * Tooltip output (the package renders only the trigger there), so
 * `info-button.native.tsx` uses a Tamagui `Dialog`.
 */
export function InfoButton({ label, explanation, testID }: InfoButtonProps) {
  const [open, setOpen] = useState(false);
  // Hover and focus open the tooltip themselves; only a tooltip that a press
  // opened is closed by the next press. That keeps a touch tap from fighting the
  // synthesised hover, while a repeated tap on touch-web still closes it.
  const pressedOpen = useRef(false);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) pressedOpen.current = false;
  }

  function toggleInfo() {
    if (open && pressedOpen.current) {
      pressedOpen.current = false;
      setOpen(false);
      return;
    }
    pressedOpen.current = true;
    setOpen(true);
  }

  return (
    <Tooltip open={open} onOpenChange={handleOpenChange} placement="bottom" delay={{ open: 150, close: 100 }}>
      <Tooltip.Trigger asChild="except-style">
        <Pressable
          testID={testID}
          aria-label={label}
          aria-expanded={open}
          onPress={toggleInfo}
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
