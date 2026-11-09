import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { containsEmulatorOrigin } from "./emulator-origin.mjs";

describe("containsEmulatorOrigin", () => {
  it("finds the baked host in a bundle", function findsHost() {
    assert.equal(containsEmulatorOrigin('var a="http://10.0.2.2:3417";'), true);
    assert.equal(containsEmulatorOrigin("fetch(`http://10.0.2.2:3417/api/v1/me`)"), true);
  });

  it("does not match a longer address", function ignoresLongerAddress() {
    assert.equal(containsEmulatorOrigin("http://110.0.2.23:3417"), false);
    assert.equal(containsEmulatorOrigin("http://192.168.100.2:3417"), false);
  });
});
