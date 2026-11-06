import type { TagCatalogItem } from "@gift-list/contracts";
import { useEffect, useState } from "react";
import { fetchTagCatalog } from "@/api/tags";

/**
 * What the tag picker shows for the fixed catalogue. The selected tags live in
 * the form, not here, so a failed or empty catalogue never clears a choice:
 * this state describes only what can be offered next.
 */
export type TagCatalogState =
  | { status: "loading" }
  | { status: "ready"; tags: TagCatalogItem[] }
  | { status: "error" };

export type TagCatalogLoader = {
  state: TagCatalogState;
  /** Runs the request again after a failure; the form's selected tags stay put. */
  retry: () => void;
};

/**
 * Loads the fixed tag catalogue once with the request language and keeps the
 * three states the form renders. A catalogue that answers with no tags is
 * `ready` with `[]`, not an error: the server may not have been seeded yet, and
 * the owner can still add a custom tag (F-2.5.3-1).
 */
export function useTagCatalog(): TagCatalogLoader {
  const [state, setState] = useState<TagCatalogState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(
    function loadTagCatalog() {
      let cancelled = false;

      async function request() {
        const result = await fetchTagCatalog();
        if (cancelled) return;
        if (result.ok) {
          setState({ status: "ready", tags: result.tags });
          return;
        }
        setState({ status: "error" });
      }

      void request();
      return function stopLoad() {
        cancelled = true;
      };
    },
    [attempt],
  );

  function retry() {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }

  return { state, retry };
}
