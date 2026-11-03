import type { GiftCard, GiftUpdate } from "@gift-list/contracts";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { fetchGift, updateGift } from "@/api/my-gifts";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { paramValue } from "@/session/return-path";
import { colors, spacing, textStyle } from "@/theme/tokens";
import { pageGutter } from "@/ui/card-grid";
import { GiftForm, type GiftFormServerError, type GiftFormValues } from "@/ui/gift-form";
import { PrimaryButton } from "@/ui/primary-button";
import { WishCardSkeleton } from "@/ui/skeleton";
import { ToastHost } from "@/ui/toast";

/**
 * The edit screen's reads follow the list's states: a failed read offers the retry
 * view, a missing wish is its own state, and only a broken connection claims a
 * network problem (EXPERIENCE → State Patterns).
 */
type ScreenState =
  | { status: "loading" }
  | { status: "ready"; gift: GiftCard }
  | { status: "missing" }
  | { status: "error"; kind: "network" | "generic" };

/** One toast at a time; every notice this screen raises on its own is destructive. */
type ToastState = { message: string; tone: "info" | "error" };

/**
 * «Изменить желание» (Story 2.2): the edit screen behind `/gifts/{id}/edit`. It
 * reads one own card (`fetchGift`), prefills the shared `GiftForm` and maps its
 * values back onto `GiftUpdate` (AD-12); the form owns the fields and the client
 * rules, this screen only owns the request state and reports the outcome.
 *
 * `EXPERIENCE.md` → State Patterns: an expired session leaves for login with the
 * return path and the «Сессия закончилась» reason (the login screen owns that
 * toast); a missing wish is «Желание не найдено.» with the way back to the list;
 * a network failure never loses the draft, so the form stays exactly as it was
 * and only a toast reports it.
 *
 * A successful save leaves for the list with `?toast=gift_updated`: this screen
 * unmounts on the way back, so a toast set here would never be seen (the same
 * hand-over the create screen does with `?toast=gift_created`).
 */
export default function EditGiftScreen() {
  const t = useTranslations("app");
  const giftForm = useTranslations("app.giftForm");
  const common = useTranslations("common");
  const brand = getBrandName();
  const auth = useAuth();
  const { width } = useWindowDimensions();
  const gutter = pageGutter(width);
  const skeletonWidth = Math.max(0, Math.min(width, spacing["max-form"]) - gutter * 2);
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = paramValue(params.id) ?? "";
  // The guard sends a dead session back here after login, so the id travels along.
  const returnTo = `/gifts/${id}/edit`;

  const [state, setState] = useState<ScreenState>(() =>
    id === "" ? { status: "missing" } : { status: "loading" },
  );
  const [attempt, setAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<GiftFormServerError | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  // The disabled button follows a state update, which flushes after the handler:
  // a second tap in the same frame must not send a second PATCH.
  const inFlight = useRef(false);

  const ownerId = auth.state.status === "ready" ? auth.state.user.id : null;

  useEffect(() => {
    if (auth.state.status === "anonymous") {
      router.replace({
        pathname: "/login",
        params: sessionExpired
          ? { next: returnTo, reason: "session_expired" }
          : { next: returnTo },
      });
    }
  }, [auth.state.status, sessionExpired, returnTo]);

  useEffect(() => {
    if (!ownerId || id === "") return;
    let cancelled = false;
    void (async () => {
      const result = await fetchGift(id);
      if (cancelled) return;
      if (result.ok) {
        setState({ status: "ready", gift: result.gift });
        return;
      }
      if ("code" in result && result.code === "UNAUTHENTICATED") {
        // Same as «Мой вишлист»: clear the dead session and let the guard above
        // open login with the reason and a return to this screen.
        setSessionExpired(true);
        const signedOut = await auth.signOut();
        // A failed sign-out leaves the screen mounted: show the retry view, not a skeleton.
        if (!signedOut.ok && !cancelled) {
          setSessionExpired(false);
          setState({ status: "error", kind: "network" });
          setToast({ message: t("form.network"), tone: "error" });
        }
        return;
      }
      if ("code" in result && result.code === "NOT_FOUND") {
        // The wish behind the id is gone or not the owner's: its own state, not a form.
        setState({ status: "missing" });
        return;
      }
      // UX-DR6: a failure is never silent — the retry view and a toast. A body that
      // breaks the contract is not a network problem, so it gets the generic text.
      const network = "network" in result;
      setState({ status: "error", kind: network ? "network" : "generic" });
      setToast({
        message: network
          ? t("form.network")
          : "invalid" in result
            ? common("errors.generic")
            : common(`errors.code.${result.code}`),
        tone: "error",
      });
    })();
    return () => {
      cancelled = true;
    };
    // `auth` is only read on the expired-session branch; re-running the fetch on
    // every auth context update would refetch the wish for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, id, attempt]);

  if (auth.state.status !== "ready") {
    return null;
  }

  function retry() {
    setToast(null);
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }

  function backToList() {
    // `dismissTo` pops back to the list without leaving a duplicate behind, and
    // replaces this screen when a direct link left nothing to pop.
    router.dismissTo({ pathname: "/" });
  }

  async function save(values: GiftFormValues) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    // The screen owns the prop: the next submit drops the previous server error.
    setServerError(null);

    const result = await updateGift(id, toGiftUpdate(values));
    inFlight.current = false;
    setSubmitting(false);

    if (result.ok) {
      // The list shows the confirmation from the param and refetches on focus.
      router.dismissTo({ pathname: "/", params: { toast: "gift_updated" } });
      return;
    }
    if ("network" in result) {
      // The draft is not lost: the form stays exactly as it was.
      setToast({ message: t("form.network"), tone: "error" });
      return;
    }
    if ("invalid" in result) {
      setToast({ message: common("errors.generic"), tone: "error" });
      return;
    }
    if (result.code === "UNAUTHENTICATED") {
      // Same as on load: clear the dead session and let the guard open login.
      setSessionExpired(true);
      const signedOut = await auth.signOut();
      if (!signedOut.ok) {
        setSessionExpired(false);
        setToast({ message: t("form.network"), tone: "error" });
      }
      return;
    }
    if (result.code === "NOT_FOUND") {
      // The wish disappeared while the owner was editing: report it and stop
      // pretending there is a form to save (EXPERIENCE → «Желание не найдено»).
      setState({ status: "missing" });
      setToast({ message: common("errors.code.NOT_FOUND"), tone: "error" });
      return;
    }
    if (result.code === "VALIDATION") {
      // `GiftForm` shows the error under the field; phrase stays in the catalog.
      setServerError({ field: result.field, message: result.message });
      return;
    }
    setToast({ message: common(`errors.code.${result.code}`), tone: "error" });
  }

  function submit(values: GiftFormValues) {
    void save(values);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: giftForm("pageTitle.edit", { brand }) }} />
      <View style={[styles.column, { paddingHorizontal: gutter }]}>
        <Text style={styles.logo}>{common("brandName", { brand })}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {giftForm("title.edit")}
        </Text>
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {state.status === "loading" ? (
            // The list's skeleton, announced the same way (EXPERIENCE → «Загрузка»).
            <View
              accessible
              accessibilityState={{ busy: true }}
              accessibilityLabel={giftForm("loading")}
            >
              <WishCardSkeleton width={skeletonWidth} />
            </View>
          ) : state.status === "error" ? (
            <View style={styles.retry}>
              <Text style={styles.retryText}>
                {state.kind === "network"
                  ? giftForm("loadError")
                  : giftForm("loadErrorGeneric")}
              </Text>
              <PrimaryButton label={giftForm("retry")} onPress={retry} />
            </View>
          ) : state.status === "missing" ? (
            <View style={styles.retry}>
              <Text style={styles.retryText}>{giftForm("giftNotFound")}</Text>
              <PrimaryButton label={giftForm("backToList")} onPress={backToList} />
            </View>
          ) : (
            <GiftForm
              // `GiftForm` reads `initialValues` once, so another wish needs a remount.
              key={state.gift.id}
              initialValues={toFormValues(state.gift)}
              submitting={submitting}
              onSubmit={submit}
              submitLabel={giftForm("action.save")}
              serverError={serverError}
            />
          )}
        </ScrollView>
      </View>
      {toast ? (
        <ToastHost
          message={toast.message}
          tone={toast.tone}
          onDismiss={() => setToast(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

/** The stored AD-12 card back into the fields the form edits. */
function toFormValues(gift: GiftCard): GiftFormValues {
  return {
    title: gift.title,
    description: gift.description,
    link: gift.linkUrl,
    priceAmount: gift.priceAmount,
    priceCurrency: gift.priceCurrency,
    visibility: gift.visibility,
  };
}

/** `GiftFormValues` names the link `link`; the API body names it `linkUrl` (AD-12). */
function toGiftUpdate(values: GiftFormValues): GiftUpdate {
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
  retry: {
    width: "100%",
    paddingVertical: spacing["section-gap"] / 2,
    gap: spacing["grid-gap"],
  },
  retryText: {
    ...textStyle("body"),
    color: colors["muted-foreground"],
    textAlign: "center",
  },
});
