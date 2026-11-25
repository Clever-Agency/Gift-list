import { describe, expect, it } from "vitest";
import {
  isVisibilityNarrowing,
  needsSurpriseWarning,
  needsVisibilityWarning,
  type SurpriseWarningSubject,
} from "./surprise-warning";

/** Every state the owner can see: status × visibility, with and without the archive. */
const STATUSES = ["OPEN", "RESERVED", "CLOSED"] as const;
const VISIBILITIES = ["PUBLIC", "FRIENDS", "SECRET"] as const;

function subject(overrides: Partial<SurpriseWarningSubject> = {}): SurpriseWarningSubject {
  return { status: "OPEN", visibility: "PUBLIC", archivedAt: null, ...overrides };
}

/**
 * D-49 (CLE-124): the warning belongs to an open non-secret wish and to nothing
 * else. There is no reservation input at all — a `RESERVED` answer of an old
 * server is just another open wish for the owner.
 */
describe("needsSurpriseWarning: статус × видимость × архив", () => {
  it("открытое и забронированное не-секретное желание просят предупреждение", () => {
    expect(needsSurpriseWarning(subject({ status: "OPEN", visibility: "PUBLIC" }))).toBe(true);
    expect(needsSurpriseWarning(subject({ status: "OPEN", visibility: "FRIENDS" }))).toBe(true);
    expect(needsSurpriseWarning(subject({ status: "RESERVED", visibility: "PUBLIC" }))).toBe(true);
    expect(needsSurpriseWarning(subject({ status: "RESERVED", visibility: "FRIENDS" }))).toBe(true);
  });

  it("секретное желание окна не получает ни в каком статусе", () => {
    for (const status of STATUSES) {
      expect(
        needsSurpriseWarning(subject({ status, visibility: "SECRET" })),
        `${status}/SECRET`,
      ).toBe(false);
    }
  });

  it("полученное желание окна не получает", () => {
    for (const visibility of ["PUBLIC", "FRIENDS"] as const) {
      expect(needsSurpriseWarning(subject({ status: "CLOSED", visibility }))).toBe(false);
    }
  });

  it("архивное желание окна не получает, даже если оно открыто и не секретно", () => {
    expect(
      needsSurpriseWarning(
        subject({ status: "OPEN", visibility: "PUBLIC", archivedAt: "2026-10-01T00:00:00.000Z" }),
      ),
    ).toBe(false);
    expect(
      needsSurpriseWarning(
        subject({ status: "RESERVED", visibility: "FRIENDS", archivedAt: "2026-10-01T00:00:00.000Z" }),
      ),
    ).toBe(false);
  });

  it("покрывает все комбинации статуса и видимости без брони", () => {
    const cases: [string, string, boolean][] = [];
    for (const status of STATUSES) {
      for (const visibility of VISIBILITIES) {
        cases.push([
          status,
          visibility,
          (status === "OPEN" || status === "RESERVED") && visibility !== "SECRET",
        ]);
      }
    }

    for (const [status, visibility, expected] of cases) {
      expect(
        needsSurpriseWarning(
          subject({
            status: status as SurpriseWarningSubject["status"],
            visibility: visibility as SurpriseWarningSubject["visibility"],
          }),
        ),
        `${status}/${visibility}`,
      ).toBe(expected);
    }
  });
});

describe("isVisibilityNarrowing: сужение и расширение", () => {
  it("сужение — только PUBLIC→FRIENDS, PUBLIC→SECRET и FRIENDS→SECRET", () => {
    expect(isVisibilityNarrowing("PUBLIC", "FRIENDS")).toBe(true);
    expect(isVisibilityNarrowing("PUBLIC", "SECRET")).toBe(true);
    expect(isVisibilityNarrowing("FRIENDS", "SECRET")).toBe(true);
  });

  it("расширение окна не открывает", () => {
    expect(isVisibilityNarrowing("SECRET", "FRIENDS")).toBe(false);
    expect(isVisibilityNarrowing("SECRET", "PUBLIC")).toBe(false);
    expect(isVisibilityNarrowing("FRIENDS", "PUBLIC")).toBe(false);
  });

  it("то же значение — не сужение и не расширение", () => {
    for (const visibility of VISIBILITIES) {
      expect(isVisibilityNarrowing(visibility, visibility), visibility).toBe(false);
    }
  });
});

describe("needsVisibilityWarning", () => {
  it("спрашивает только у открытого не-секретного желания при сужении", () => {
    expect(needsVisibilityWarning(subject({ visibility: "PUBLIC" }), "FRIENDS")).toBe(true);
    expect(needsVisibilityWarning(subject({ visibility: "PUBLIC" }), "SECRET")).toBe(true);
    expect(needsVisibilityWarning(subject({ visibility: "FRIENDS" }), "SECRET")).toBe(true);
    expect(needsVisibilityWarning(subject({ status: "RESERVED", visibility: "PUBLIC" }), "SECRET")).toBe(
      true,
    );
  });

  it("расширение, то же значение, секретное, полученное и архивное молчат", () => {
    expect(needsVisibilityWarning(subject({ visibility: "FRIENDS" }), "PUBLIC")).toBe(false);
    expect(needsVisibilityWarning(subject({ visibility: "PUBLIC" }), "PUBLIC")).toBe(false);
    expect(needsVisibilityWarning(subject({ visibility: "SECRET" }), "SECRET")).toBe(false);
    expect(needsVisibilityWarning(subject({ status: "CLOSED", visibility: "PUBLIC" }), "SECRET")).toBe(
      false,
    );
    expect(
      needsVisibilityWarning(
        subject({ visibility: "PUBLIC", archivedAt: "2026-10-01T00:00:00.000Z" }),
        "SECRET",
      ),
    ).toBe(false);
  });
});
