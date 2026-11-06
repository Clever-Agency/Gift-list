import { describe, expect, it } from "vitest";
import { LINK_PAGE_HEADERS } from "./link-page-headers";

describe("link page response headers", () => {
  it("is private/no-store and varies on Accept-Language", () => {
    const headers = Object.fromEntries(
      LINK_PAGE_HEADERS.map(function toEntry(header) {
        return [header.key.toLowerCase(), header.value];
      }),
    );

    expect(headers["cache-control"]).toBe("private, no-store");
    expect(headers.vary).toBe("Accept-Language");
  });
});
