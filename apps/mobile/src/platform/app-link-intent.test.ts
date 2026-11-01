import { describe, expect, it } from "vitest";
import { appLinkHost, linkData } from "../../app.config";

describe("app link intent", () => {
  it("claims no paths when the API base is empty or not http(s)", () => {
    expect(appLinkHost("")).toBeNull();
    expect(appLinkHost("   ")).toBeNull();
    expect(appLinkHost("not a url")).toBeNull();
    expect(appLinkHost("giftlist://app")).toBeNull();
  });

  it("claims /l/, /i/, /wishlist and an exact /reset", () => {
    const host = appLinkHost("https://gift.example:8443");
    expect(host).toEqual({ hostname: "gift.example", port: "8443" });
    const data = linkData(host!);
    expect(data.map((item) => ("path" in item ? item.path : item.pathPrefix))).toEqual([
      "/l/",
      "/i/",
      "/wishlist",
      "/wishlist/",
      "/reset",
    ]);
    expect(data.find((item) => "path" in item && item.path === "/reset")).toMatchObject({
      scheme: "https",
      host: "gift.example",
      port: "8443",
      path: "/reset",
    });
    expect(data.some((item) => "pathPrefix" in item && item.pathPrefix === "/l")).toBe(false);
    expect(data.some((item) => "pathPrefix" in item && item.pathPrefix === "/wishlist")).toBe(false);
  });
});
