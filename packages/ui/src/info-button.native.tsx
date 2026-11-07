import { useRef, useState, type ComponentRef } from "react";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { restoreFocus } from "./focus";
import { Info } from "./icons";
import type { InfoButtonProps } from "./info-button.types";
import { Pressable } from "./pressable";
import { spacing } from "./tokens";

/**
 * Native has no visible Tamagui Tooltip: `@tamagui/tooltip` renders the trigger and
 * drops `Tooltip.Content`. The same explanation therefore opens in a Tamagui
 * `Dialog`, which is touch-, keyboard- and screen-reader accessible and is never
 * hover-only.
 */
export function InfoButton({ label, explanation, closeLabel, testID }: InfoButtonProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<ComponentRef<typeof Pressable>>(null);

  function openInfo() {
    setOpen(true);
  }

  function closeInfo() {
    setOpen(false);
  }

  function returnFocus() {
    restoreFocus(trigger.current);
  }

  return (
    <>
      <Pressable
        ref={trigger}
        testID={testID}
        aria-label={label}
        aria-haspopup="dialog"
        onPress={openInfo}
        width="$touch-target"
        height="$touch-target"
        alignItems="center"
        justifyContent="center"
        borderRadius="$full"
        color="$foreground"
        backgroundColor="transparent press:$surface"
      >
        <Info testID={testID ? `${testID}-icon` : undefined} size={spacing["icon-inline"]} />
      </Pressable>
      <Dialog
        open={open}
        title={label}
        description={explanation}
        onClose={closeInfo}
        onClosed={returnFocus}
        testID={testID ? `${testID}-dialog` : undefined}
        actions={<Button label={closeLabel} variant="secondary" onPress={closeInfo} />}
      />
    </>
  );
}

InfoButton.displayName = "InfoButton";
