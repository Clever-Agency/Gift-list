/**
 * The app reads its public configuration with `process.env` inside
 * `apps/mobile/src/config/env.ts`; `scripts/check-boundaries.mjs` allows that file
 * and no other. A browser bundle has no `process`, and the catalog must not depend
 * on a developer's `.env`, so the catalog swaps the module for these fixed,
 * obviously fake values. The real parsing and fallbacks are covered by the unit
 * tests of that file; stories only need the product name.
 *
 * The brand is the real constant: the catalog should show the name users see, and
 * a second literal here would drift from `packages/contracts/src/brand.ts` (AD-24).
 */
import { PRODUCT_NAME } from "@gift-list/contracts";

export function normalizeWebOrigin(_value: string | undefined): string {
  return "";
}

export function getBrandName(): string {
  return PRODUCT_NAME;
}

export function getApiBaseUrl(): string {
  return "";
}

export function resolvePublicWebOrigin(): string {
  return "";
}

export function getPublicWebOrigin(): string {
  return "";
}
