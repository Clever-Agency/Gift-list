import { describe, expect, it } from "vitest";
import { isGiftTagApprovedForAggregates } from "./tag";

describe("isGiftTagApprovedForAggregates", () => {
  it("includes a fixed catalog tag", () => {
    expect(isGiftTagApprovedForAggregates({ tagId: "tag_1", aggregateEligible: true })).toBe(true);
  });

  it("excludes a custom tag that ADMIN has not approved", () => {
    expect(isGiftTagApprovedForAggregates({ tagId: null, aggregateEligible: false })).toBe(false);
  });

  it("excludes a catalog tag not marked eligible", () => {
    expect(isGiftTagApprovedForAggregates({ tagId: "tag_1", aggregateEligible: false })).toBe(
      false,
    );
  });

  it("excludes an eligible flag without a catalog link", () => {
    expect(isGiftTagApprovedForAggregates({ tagId: null, aggregateEligible: true })).toBe(false);
  });
});
