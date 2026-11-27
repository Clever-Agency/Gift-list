import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { fetchCollections } from "@/api/collections";
import { useAuth } from "@/session/auth-context";
import { signOutErrorMessage } from "@/session/form-issue";
import { CollectionsScreen, type CollectionsState } from "@/ui/collections-screen";
import { SessionErrorScreen } from "@/ui/session-error-screen";
import { SessionLoadingScreen } from "@/ui/session-loading-screen";
import { ToastHost } from "@/ui/toast";

type ToastState = { message: string; tone: "info" | "error" };

/**
 * «Подборки» (Story 10.1, CLE-143): the session gate of «Настройки» — an
 * anonymous visitor leaves for login with a return here, and the list starts
 * only after `/me` answered. The route owns the request, the session and the
 * toast; the card grid itself is `CollectionsScreen`.
 */
export default function CollectionsRoute() {
  const auth = useAuth();
  const t = useTranslations("app");
  const common = useTranslations("common");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [state, setState] = useState<CollectionsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(
    function redirectAnonymous() {
      if (auth.state.status === "anonymous") {
        // The login screen owns the «Сессия закончилась» toast: it outlives this screen.
        router.replace({
          pathname: "/login",
          params: sessionExpired
            ? { next: "/collections", reason: "session_expired" }
            : { next: "/collections" },
        });
      }
    },
    [auth.state.status, sessionExpired],
  );

  /** The stored session is dead: clear it and let the guard open login with the reason. */
  async function expireSession() {
    setSessionExpired(true);
    const signedOut = await auth.signOut();
    if (!signedOut.ok) {
      setSessionExpired(false);
      setToast({
        message: signOutErrorMessage(signedOut, t("form.network"), common),
        tone: "error",
      });
    }
  }

  useEffect(
    function loadCollections() {
      if (auth.state.status !== "ready") return;
      let cancelled = false;

      async function requestCollections() {
        const result = await fetchCollections();
        if (cancelled) return;

        if (result.ok) {
          setState({ status: "ready", collections: result.collections });
          return;
        }
        if ("code" in result && result.code === "UNAUTHENTICATED") {
          await expireSession();
          return;
        }
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
      }

      void requestCollections();
      return function stopLoad() {
        cancelled = true;
      };
      // `auth` is only read on the expired-session branch; re-running the read on
      // every auth context update would refetch the list for no reason.
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auth.state.status, attempt],
  );

  function retry() {
    setToast(null);
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }

  function dismissToast() {
    setToast(null);
  }

  function openCollection(id: string) {
    router.push({ pathname: "/collections/[id]", params: { id } });
  }

  if (auth.state.status === "error") {
    return <SessionErrorScreen onRetry={auth.retry} />;
  }

  if (auth.state.status !== "ready") {
    return <SessionLoadingScreen />;
  }

  return (
    <>
      <CollectionsScreen state={state} onRetry={retry} onOpen={openCollection} />
      {toast ? (
        <ToastHost message={toast.message} tone={toast.tone} onDismiss={dismissToast} />
      ) : null}
    </>
  );
}

CollectionsRoute.displayName = "CollectionsRoute";
