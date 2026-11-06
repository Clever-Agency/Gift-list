/**
 * Story 3.3 / AD-27: the public link page is per-visitor (session check, owner
 * name) and its language comes from `Accept-Language`. Both headers are needed:
 * a shared cache must not serve one visitor's page to another, and a cache that
 * ignores the language would mix documents.
 */
export const LINK_PAGE_HEADERS = [
  { key: "Cache-Control", value: "private, no-store" },
  { key: "Vary", value: "Accept-Language" },
] as const;
