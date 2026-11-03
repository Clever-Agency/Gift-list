import type { GiftInput } from "@gift-list/contracts";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { createGift } from "@/api/my-gifts";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { colors, spacing, textStyle } from "@/theme/tokens";
import { pageGutter } from "@/ui/card-grid";
import { GiftForm, type GiftFormServerError, type GiftFormValues } from "@/ui/gift-form";
import { ToastHost } from "@/ui/toast";

/**
 * «Новое желание» (Story 2.2): the create screen behind `/gifts/new`. The form owns
 * the fields and the client rules; this screen only maps its values onto `GiftInput`
 * (AD-12), keeps the request state and reports the outcome.
 *
 * `EXPERIENCE.md` → State Patterns: an expired session leaves for login with the
 * return path and the «Сессия закончилась» reason (the login screen owns that toast);
 * a network failure never loses the draft, so the form stays exactly as it was and
 * only a toast reports it.
 *
 * A successful save leaves for the list with `?toast=gift_created`: this screen
 * unmounts on the way back, so a toast set here would never be seen (the same
 * hand-over as the login screen's `?reason=`).
 */
export default function NewGiftScreen() {
  const t = useTranslations("app");
  const giftForm = useTranslations("app.giftForm");
  const common = useTranslations("common");
  const brand = getBrandName();
  const auth = useAuth();
  const { width } = useWindowDimensions();
  const gutter = pageGutter(width);

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<GiftFormServerError | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  // The disabled button follows a state update, which flushes after the handler:
  // a second tap in the same frame must not send a second POST.
  const inFlight = useRef(false);

  useEffect(() => {
    if (auth.state.status === "anonymous") {
      router.replace({
        pathname: "/login",
        params: sessionExpired
          ? { next: "/gifts/new", reason: "session_expired" }
          : { next: "/gifts/new" },
      });
    }
  }, [auth.state.status, sessionExpired]);

  if (auth.state.status !== "ready") return null;

  async function save(values: GiftFormValues) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    // The screen owns the prop: the next submit drops the previous server error.
    setServerError(null);

    const result = await createGift(toGiftInput(values));
    inFlight.current = false;
    setSubmitting(false);

    if (result.ok) {
      // `dismissTo` pops back to the list without leaving a duplicate behind, and
      // replaces this screen when a direct link left nothing to pop. The list shows
      // the confirmation from the param and refetches on focus.
      router.dismissTo({ pathname: "/", params: { toast: "gift_created" } });
      return;
    }
    if ("network" in result) {
      setToast(t("form.network"));
      return;
    }
    if ("invalid" in result) {
      setToast(common("errors.generic"));
      return;
    }
    if (result.code === "UNAUTHENTICATED") {
      // Same as «Мой вишлист»: clear the dead session and let the guard above open
      // login with the reason and a return to this screen.
      setSessionExpired(true);
      const signedOut = await auth.signOut();
      // A failed sign-out leaves the screen mounted: report it like any other
      // network failure instead of silently pretending the session is gone.
      if (!signedOut.ok) {
        setSessionExpired(false);
        setToast(t("form.network"));
      }
      return;
    }
    if (result.code === "VALIDATION") {
      // `GiftForm` shows the error under the field; phrase stays in the catalog.
      setServerError({ field: result.field, message: result.message });
      return;
    }
    setToast(common("errors.generic"));
  }

  function submit(values: GiftFormValues) {
    void save(values);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: giftForm("pageTitle.create", { brand }) }} />
      <View style={[styles.column, { paddingHorizontal: gutter }]}>
        <Text style={styles.logo}>{common("brandName", { brand })}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {giftForm("title.create")}
        </Text>
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <GiftForm
            submitting={submitting}
            onSubmit={submit}
            submitLabel={giftForm("action.create")}
            serverError={serverError}
          />
        </ScrollView>
      </View>
      {toast ? (
        <ToastHost message={toast} onDismiss={() => setToast(null)} />
      ) : null}
    </SafeAreaView>
  );
}

/** `GiftFormValues` names the link `link`; the API body names it `linkUrl` (AD-12). */
function toGiftInput(values: GiftFormValues): GiftInput {
  return {
    title: values.title,
    description: values.description,
    priceAmount: values.priceAmount,
    priceCurrency: values.priceCurrency,
    linkUrl: values.link,
    visibility: values.visibility,
  };
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  column: {
    flex: 1,
    width: "100%",
    // A form reads best narrow: `DESIGN.md` → Layout → max-form.
    maxWidth: spacing["max-form"],
    alignSelf: "center",
    paddingTop: spacing["page-gutter"],
    gap: spacing["grid-gap"] / 2,
  },
  logo: {
    ...textStyle("display-sm"),
    color: colors.primary,
    textAlign: "center",
  },
  title: {
    ...textStyle("heading"),
    color: colors.foreground,
  },
  scrollArea: {
    flex: 1,
  },
  scroll: {
    paddingTop: spacing["grid-gap"] / 2,
    paddingBottom: spacing["section-gap"],
  },
});
