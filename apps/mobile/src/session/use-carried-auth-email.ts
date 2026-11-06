import { useFocusEffect } from "expo-router";
import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { consumeAuthEmail, type AuthScreen } from "@/session/auth-navigation";

/**
 * The email handed over by the previous anonymous screen. Read once when the screen
 * gains focus; a reload, a deep link or a return without state keeps the field empty.
 */
export function useCarriedAuthEmail(
  target: AuthScreen,
): [string, Dispatch<SetStateAction<string>>] {
  const [email, setEmail] = useState("");
  useFocusEffect(
    useCallback(function takeCarriedEmail() {
      const carried = consumeAuthEmail(target);
      if (carried) setEmail(carried);
    }, [target]),
  );
  return [email, setEmail];
}
