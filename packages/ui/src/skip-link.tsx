import { View } from "@tamagui/core";
import { useState } from "react";
import { focusRing } from "./focus-ring";
import { useHoverTransition } from "./hover";
import { Text } from "./text";

export type SkipLinkProps = {
  /** The catalog text: `web.skipToContent` — «Перейти к содержимому». */
  label: string;
  testID?: string;
};

/**
 * `DESIGN.md` → Порядок Tab, `EXPERIENCE.md` → Доступность: the first stop of
 * the keyboard order. The link is invisible and ignores the pointer until it
 * takes focus, then it shows a `surface` pill over the page and jumps to
 * `#main-content` — the `main` landmark `AppShell` draws with `tabIndex={-1}`.
 * A phone has no skip link: the short path to the content does not exist there,
 * so `skip-link.native.tsx` draws nothing.
 */
export function SkipLink({ label, testID }: SkipLinkProps) {
  const [focused, setFocused] = useState(false);
  const transition = useHoverTransition();

  function handleFocus() {
    setFocused(true);
  }

  function handleBlur() {
    setFocused(false);
  }

  return (
    <View
      render="a"
      {...{ href: "#main-content" }}
      testID={testID}
      position="absolute"
      top="$2"
      left="$2"
      zIndex="$toast"
      opacity={focused ? 1 : 0}
      pointerEvents={focused ? "auto" : "none"}
      onFocus={handleFocus}
      onBlur={handleBlur}
      backgroundColor="$surface hover:$muted"
      borderWidth={1}
      borderColor="$border hover:$border-strong"
      borderRadius="$md"
      paddingHorizontal="$3"
      paddingVertical="$2"
      cursor="pointer"
      textDecorationLine="none"
      transition={transition}
      {...focusRing}
    >
      <Text kind="button" tone="primary">
        {label}
      </Text>
    </View>
  );
}

SkipLink.displayName = "SkipLink";
