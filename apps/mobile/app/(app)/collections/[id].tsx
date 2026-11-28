import type { EditorialItem } from "@gift-list/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { addCollectionItem, fetchCollection } from "@/api/collections";
import { useAuth } from "@/session/auth-context";
import { mutationErrorMessage, signOutErrorMessage } from "@/session/form-issue";
import { paramValue } from "@/session/return-path";
import { CollectionScreen, type CollectionState } from "@/ui/collection-screen";
import { SessionErrorScreen } from "@/ui/session-error-screen";
import { SessionLoadingScreen } from "@/ui/session-loading-screen";
import { ToastHost } from "@/ui/toast";

type ToastState = { message: string; tone: "info" | "error" };

/**
 * `/collections/[id]` (Story 10.1, CLE-143): one published collection of ideas
 * and «Добавить в мой вишлист». The route owns the session, the read and the
 * add; the screen only draws the state and the idea list. A draft or an unknown
 * id is the one `NOT_FOUND` page, so a deep link reveals nothing about drafts.
 */
export default function CollectionRoute() {
  const auth = useAuth();
  const t = useTranslations("app");
  const common = useTranslations("common");
  const collections = useTranslations("app.collections");
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = paramValue(params.id);

  const [sessionExpired, setSessionExpired] = useState(false);
  const [state, setState] = useState<CollectionState>(
    id ? { status: "loading" } : { status: "missing" },
  );
  const [attempt, setAttempt] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  // «Добавлено» lives on this screen only: a new visit may add the idea again
  // (an open decision of the plan). One request per idea at a time.
  const [addedIds, setAddedIds] = useState<ReadonlySet<string>>(function noneAdded() {
    return new Set<string>();
  });
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(function noneBusy() {
    return new Set<string>();
  });
  const inFlight = useRef(new Set<string>());

  useEffect(
    function redirectAnonymous() {
      if (auth.state.status === "anonymous") {
        // The login screen owns the «Сессия закончилась» toast: it outlives this screen.
        const next = id ? `/collections/${id}` : "/collections";
        router.replace({
          pathname: "/login",
          params: sessionExpired ? { next, reason: "session_expired" } : { next },
        });
      }
    },
    [auth.state.status, id, sessionExpired],
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
    function loadCollection() {
      if (!id || auth.state.status !== "ready") return;
      let cancelled = false;

      async function requestCollection() {
        if (!id) return;
        const result = await fetchCollection(id);
        if (cancelled) return;

        if (result.ok) {
          setState(
            "access" in result
              ? { status: "missing" }
              : { status: "ready", collection: result.collection },
          );
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

      void requestCollection();
      return function stopLoad() {
        cancelled = true;
      };
      // `auth` is only read on the expired-session branch; re-running the read on
      // every auth context update would refetch the collection for no reason.
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auth.state.status, id, attempt],
  );

  function retry() {
    setToast(null);
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }

  function dismissToast() {
    setToast(null);
  }

  /**
   * One «Добавить в мой вишлист»: the server creates an ordinary `OPEN` wish
   * with the default «всем» visibility through the create use-case. A success
   * turns the button into «Добавлено» and shows the toast; a failure keeps the
   * button usable and reports the catalog sentence (network, limits, and so on).
   */
  async function addItem(item: EditorialItem) {
    if (!id || addedIds.has(item.id) || inFlight.current.has(item.id)) return;
    inFlight.current.add(item.id);
    setBusyIds(function markBusy(current) {
      const next = new Set(current);
      next.add(item.id);
      return next;
    });
    setToast(null);

    const result = await addCollectionItem(id, item.id).finally(function release() {
      inFlight.current.delete(item.id);
      setBusyIds(function clearBusy(current) {
        if (!current.has(item.id)) return current;
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    });

    if (result.ok) {
      setAddedIds(function markAdded(current) {
        const next = new Set(current);
        next.add(item.id);
        return next;
      });
      setToast({ message: collections("addedToast"), tone: "info" });
      return;
    }
    if ("network" in result) {
      setToast({ message: t("form.network"), tone: "error" });
      return;
    }
    if ("invalid" in result) {
      setToast({ message: common("errors.generic"), tone: "error" });
      return;
    }
    if (result.code === "UNAUTHENTICATED") {
      await expireSession();
      return;
    }
    setToast({ message: mutationErrorMessage(result, common), tone: "error" });
  }

  if (auth.state.status === "error") {
    return <SessionErrorScreen onRetry={auth.retry} />;
  }

  if (auth.state.status !== "ready") {
    return <SessionLoadingScreen />;
  }

  return (
    <>
      <CollectionScreen
        state={state}
        addedIds={addedIds}
        busyIds={busyIds}
        onRetry={retry}
        onAdd={function add(item) {
          void addItem(item);
        }}
      />
      {toast ? (
        <ToastHost message={toast.message} tone={toast.tone} onDismiss={dismissToast} />
      ) : null}
    </>
  );
}

CollectionRoute.displayName = "CollectionRoute";
