/**
 * The app reads its public configuration with `process.env` inside
 * `apps/mobile/src/config/env.ts`; `scripts/check-boundaries.mjs` allows that file
 * and no other. A browser bundle has no `process`, and the catalog must not depend
 * on a developer's `.env`, so the catalog swaps the module for these fixed,
 * obviously fake values. The real parsing and fallbacks are covered by the unit
 * tests of that file; stories only need a brand and a non-empty author link.
 */

const BRAND_NAME = "Gift List";
/** A placeholder on purpose: a real author address is configuration, not copy. */
const AUTHOR_URL = "https://example.com/napisat-avtoru";

export function normalizeWebOrigin(_value: string | undefined): string {
  return "";
}

export function getBrandName(): string {
  return BRAND_NAME;
}

export function getApiBaseUrl(): string {
  return "";
}

export function getAuthorUrl(): string {
  return AUTHOR_URL;
}

export function resolvePublicWebOrigin(): string {
  return "";
}

export function getPublicWebOrigin(): string {
  return "";
}
