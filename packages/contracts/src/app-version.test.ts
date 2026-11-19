import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import {
  APP_PLATFORMS,
  APP_VERSION_PATTERN,
  APP_VERSION_POLICY,
  APP_VERSION_STATUSES,
  DEFAULT_APP_VERSION,
  appVersionDataSchema,
  appVersionPolicySchema,
  appVersionStatus,
  compareAppVersions,
  parseAppVersionPolicy,
  type AppVersionData,
  type AppVersionPolicy,
} from "./app-version";

/**
 * CLE-86: the version format, the numeric comparison and the fail-open status
 * rule are one contract for the server answer and the mobile check, so the
 * table below is the single place that pins their behaviour.
 */

const UP_TO_DATE_POLICY: AppVersionPolicy = {
  latestVersion: "0.2.0",
  minSupportedVersion: "0.1.0",
  storeUrl: null,
};

function policy(overrides: Partial<AppVersionPolicy>): AppVersionPolicy {
  return { ...UP_TO_DATE_POLICY, ...overrides };
}

function dataOf(android: AppVersionPolicy, ios: AppVersionPolicy): AppVersionData {
  return { android, ios };
}

describe("APP_VERSION_PATTERN", () => {
  it("accepts exactly MAJOR.MINOR.PATCH of ASCII digits", () => {
    for (const version of ["0.1.0", "1.0.0", "10.200.300", "999999999.0.999999999"]) {
      expect(APP_VERSION_PATTERN.test(version)).toBe(true);
    }
  });

  it("rejects anything that is not three numeric segments", () => {
    const invalid = [
      "",
      " ",
      "0.1",
      "0.1.0.0",
      "v1.0.0",
      "+1.0.0",
      "1.0.0-beta",
      "1.0.0+build",
      "1..0",
      "1.0.",
      ".1.0",
      " 1.0.0",
      "1.0.0 ",
      "1.0.0\t",
      "1.0.0\n",
      "1000000000.0.0",
      "0.1000000000.0",
      "0.1.٠",
      "1,0,0",
    ];

    for (const version of invalid) {
      expect(APP_VERSION_PATTERN.test(version)).toBe(false);
    }
  });
});

describe("compareAppVersions", () => {
  const table: ReadonlyArray<readonly [string, string, -1 | 0 | 1]> = [
    ["0.1.0", "0.1.0", 0],
    ["0.1.10", "0.1.9", 1],
    ["0.1.9", "0.1.10", -1],
    ["0.2.0", "0.10.0", -1],
    ["0.10.0", "0.2.0", 1],
    ["1.0.0", "0.99.99", 1],
    ["0.0.1", "0.0.2", -1],
    ["2.0.0", "1.999999999.999999999", 1],
    ["999999999.999999999.999999999", "999999999.999999999.999999999", 0],
    ["01.0.0", "1.0.0", 0],
    ["1.02.0", "1.2.0", 0],
    ["0.0.10", "0.0.9", 1],
  ];

  it("compares each segment as a number, not as a string", () => {
    for (const [left, right, expected] of table) {
      expect(compareAppVersions(left, right)).toBe(expected);
    }
  });

  it("is symmetric when the arguments are swapped", () => {
    for (const [left, right, expected] of table) {
      const reversed = expected === 0 ? 0 : expected === 1 ? -1 : 1;
      expect(compareAppVersions(right, left)).toBe(reversed);
    }
  });

  it("returns null when either side is not a version", () => {
    const invalid = ["", "1.0", "1.0.0.0", "v1.0.0", "1.0.0-beta", " 1.0.0", "1.0.0 "];

    for (const version of invalid) {
      expect(compareAppVersions(version, "0.1.0")).toBeNull();
      expect(compareAppVersions("0.1.0", version)).toBeNull();
      expect(compareAppVersions(version, version)).toBeNull();
    }
  });
});

describe("appVersionPolicySchema", () => {
  it("accepts an https store link and a null one", () => {
    expect(
      appVersionPolicySchema.safeParse(
        policy({ storeUrl: "https://play.google.com/store/apps/details?id=dev.clever.wishmoon" }),
      ).success,
    ).toBe(true);
    expect(appVersionPolicySchema.safeParse(policy({ storeUrl: null })).success).toBe(true);
  });

  it("rejects a non-https store link", () => {
    for (const storeUrl of ["ftp://example.com/app", "http://example.com/app", "example.com"]) {
      expect(appVersionPolicySchema.safeParse(policy({ storeUrl })).success).toBe(false);
    }
  });

  it("rejects a version that does not match the format", () => {
    expect(appVersionPolicySchema.safeParse(policy({ latestVersion: "0.2" })).success).toBe(
      false,
    );
    expect(
      appVersionPolicySchema.safeParse(policy({ minSupportedVersion: "v0.1.0" })).success,
    ).toBe(false);
  });

  it("drops an unknown field instead of rejecting the answer", () => {
    const parsed = appVersionPolicySchema.safeParse({ ...UP_TO_DATE_POLICY, rollout: 10 });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect("rollout" in parsed.data).toBe(false);
  });
});

describe("appVersionDataSchema", () => {
  const valid = dataOf(policy({ latestVersion: "0.2.0" }), policy({ latestVersion: "0.3.0" }));

  it("accepts both platforms", () => {
    expect(appVersionDataSchema.safeParse(valid).success).toBe(true);
    expect(APP_PLATFORMS).toEqual(["android", "ios"]);
  });

  it("requires both platforms", () => {
    expect(appVersionDataSchema.safeParse({ android: policy({}) }).success).toBe(false);
    expect(appVersionDataSchema.safeParse({ ios: policy({}) }).success).toBe(false);
  });

  it("rejects minSupportedVersion above latestVersion per platform", () => {
    const androidBroken = dataOf(
      policy({ latestVersion: "0.2.0", minSupportedVersion: "0.3.0" }),
      policy({}),
    );
    const parsed = appVersionDataSchema.safeParse(androidBroken);

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(["android", "minSupportedVersion"]);
    }
  });

  it("accepts minSupportedVersion equal to latestVersion", () => {
    const blockedOnly = dataOf(
      policy({ latestVersion: "0.2.0", minSupportedVersion: "0.2.0" }),
      policy({}),
    );

    expect(appVersionDataSchema.safeParse(blockedOnly).success).toBe(true);
  });

  it("drops unknown fields instead of disabling the check on an extended answer", () => {
    const extended = { ...valid, extra: true, android: { ...valid.android, rollout: 5 } };
    const parsed = appVersionDataSchema.safeParse(extended);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect("extra" in parsed.data).toBe(false);
      expect("rollout" in parsed.data.android).toBe(false);
    }
  });
});

describe("appVersionStatus", () => {
  it("asks for a soft update between the floor and the latest version", () => {
    expect(appVersionStatus("0.1.0", policy({ latestVersion: "0.2.0" }))).toBe("UPDATE_SOFT");
    expect(
      appVersionStatus("0.1.0", policy({ latestVersion: "0.3.0", minSupportedVersion: "0.1.0" })),
    ).toBe("UPDATE_SOFT");
    expect(appVersionStatus("0.1.9", policy({ latestVersion: "0.1.10" }))).toBe("UPDATE_SOFT");
  });

  it("blocks below the supported floor, and the floor wins over a pending soft offer", () => {
    expect(
      appVersionStatus("0.1.0", policy({ latestVersion: "0.3.0", minSupportedVersion: "0.2.0" })),
    ).toBe("UPDATE_BLOCK");
    expect(
      appVersionStatus("0.1.99", policy({ latestVersion: "0.3.0", minSupportedVersion: "0.2.0" })),
    ).toBe("UPDATE_BLOCK");
  });

  it("is up to date at the latest version or ahead of it", () => {
    expect(appVersionStatus("0.2.0", policy({ latestVersion: "0.2.0" }))).toBe("UP_TO_DATE");
    expect(appVersionStatus("0.3.0", policy({ latestVersion: "0.2.0" }))).toBe("UP_TO_DATE");
  });

  it("never offers a soft update when the floor equals the latest version", () => {
    const blockedOnly = policy({ latestVersion: "0.2.0", minSupportedVersion: "0.2.0" });

    expect(appVersionStatus("0.1.0", blockedOnly)).toBe("UPDATE_BLOCK");
    expect(appVersionStatus("0.2.0", blockedOnly)).toBe("UP_TO_DATE");
  });

  it("fails open without a readable current version", () => {
    expect(appVersionStatus(null, policy({ minSupportedVersion: "9.0.0" }))).toBe("UP_TO_DATE");

    for (const current of ["", "0.1", "v0.1.0", "0.1.0-beta", " 0.1.0"]) {
      expect(appVersionStatus(current, policy({ minSupportedVersion: "9.0.0" }))).toBe(
        "UP_TO_DATE",
      );
    }
  });

  it("fails open on an invalid policy", () => {
    const brokenValues: Partial<AppVersionPolicy>[] = [
      { latestVersion: "0.2" },
      { minSupportedVersion: "" },
      { latestVersion: "0.2.0", minSupportedVersion: "0.3.0" },
      { storeUrl: "ftp://example.com/app" },
    ];

    for (const overrides of brokenValues) {
      expect(appVersionStatus("0.1.0", policy(overrides))).toBe("UP_TO_DATE");
    }
  });

  it("decides every platform from its own branch", () => {
    const data = dataOf(
      policy({ latestVersion: "0.2.0", minSupportedVersion: "0.1.0" }),
      policy({ latestVersion: "0.3.0", minSupportedVersion: "0.3.0" }),
    );

    expect(appVersionStatus("0.2.5", data.android)).toBe("UP_TO_DATE");
    expect(appVersionStatus("0.2.5", data.ios)).toBe("UPDATE_BLOCK");
    expect(appVersionStatus("0.2.0", data.android)).toBe("UP_TO_DATE");
    expect(appVersionStatus("0.2.0", data.ios)).toBe("UPDATE_BLOCK");
  });

  it("only answers statuses from the closed set", () => {
    const statuses = [
      appVersionStatus("0.1.0", policy({ latestVersion: "0.2.0" })),
      appVersionStatus("0.1.0", policy({ latestVersion: "0.3.0", minSupportedVersion: "0.2.0" })),
      appVersionStatus("0.2.0", policy({})),
    ];

    expect(statuses).toEqual(["UPDATE_SOFT", "UPDATE_BLOCK", "UP_TO_DATE"]);
    for (const status of statuses) expect(APP_VERSION_STATUSES).toContain(status);
  });
});

describe("APP_VERSION_POLICY", () => {
  it("nobody is asked to update and no store link is invented", () => {
    for (const platform of APP_PLATFORMS) {
      expect(APP_VERSION_POLICY[platform]).toEqual({
        latestVersion: DEFAULT_APP_VERSION,
        minSupportedVersion: DEFAULT_APP_VERSION,
        storeUrl: null,
      });
    }
    expect(DEFAULT_APP_VERSION).toBe("0.1.0");
  });

  it("keeps the shipped policy valid and up to date for the default build", () => {
    expect(appVersionDataSchema.safeParse(APP_VERSION_POLICY).success).toBe(true);

    for (const platform of APP_PLATFORMS) {
      expect(appVersionStatus(DEFAULT_APP_VERSION, APP_VERSION_POLICY[platform])).toBe(
        "UP_TO_DATE",
      );
    }
  });

  /**
   * R1 (CLE-86): the constant is not built by the parser at import, because the
   * module also loads in the mobile app and a typo there must not break the start
   * of the whole package. This test is the guard: it fails as soon as the
   * shipped constants stop satisfying the schema.
   */
  it("is accepted by parseAppVersionPolicy", () => {
    expect(parseAppVersionPolicy(APP_VERSION_POLICY)).toEqual(APP_VERSION_POLICY);
  });
});

describe("parseAppVersionPolicy", () => {
  it("returns the data for a valid answer", () => {
    const valid = dataOf(policy({}), policy({ latestVersion: "0.3.0" }));

    expect(parseAppVersionPolicy(valid)).toEqual(valid);
  });

  it("throws ZodError for broken constants", () => {
    const broken = [
      undefined,
      null,
      {},
      { android: policy({}), ios: policy({ minSupportedVersion: "0.4.0" }) },
      { android: { ...policy({}), storeUrl: "http://example.com/app" }, ios: policy({}) },
    ];

    for (const value of broken) {
      expect(() => parseAppVersionPolicy(value)).toThrow(ZodError);
    }
  });
});
