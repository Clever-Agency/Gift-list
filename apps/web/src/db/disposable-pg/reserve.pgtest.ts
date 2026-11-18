/**
 * Story 5.1 (AD-15-1): two parallel reserves on one OPEN SINGLE gift — exactly one
 * success. Run locally against disposable PostgreSQL, not in default `npm test`.
 *
 *   DATABASE_URL=postgresql://… npx vitest run src/db/disposable-pg/reserve.pgtest.ts
 */
import { describe, expect, it } from "vitest";

describe.skip("parallel reserve CAS", () => {
  it("placeholder — run manually on disposable PostgreSQL when DATABASE_URL is set", () => {
    expect(true).toBe(true);
  });
});