// CLE-141 (Story 7.5, AD-23): who sees a personal date and who sees its year.
import { describe, expect, it } from "vitest";
import {
  canSeePersonalDate,
  canSeePersonalDateYear,
  personalDateFor,
  toPersonalDate,
  visiblePersonalDates,
  type PersonalDateStored,
} from "./personal-dates";
import type { ViewerRelations } from "./visibility";

const OWNER = { id: "u1" } as const;
const FRIEND = { id: "u2" } as const;
const STRANGER = { id: "u3" } as const;

function relations(overrides: Partial<ViewerRelations> = {}): ViewerRelations {
  return {
    blocked: false,
    friend: false,
    subscriber: false,
    contactMatch: false,
    viaListToken: false,
    ...overrides,
  };
}

function stored(overrides: Partial<PersonalDateStored> = {}): PersonalDateStored {
  return {
    id: "d1",
    kind: "CUSTOM",
    title: "Годовщина",
    day: 14,
    month: 6,
    year: 2020,
    ownerId: "u1",
    visibility: "FRIENDS",
    yearVisibility: "ONLY_ME",
    ...overrides,
  };
}

const VIEWERS = [
  ["друг", FRIEND, { friend: true }],
  ["подписчик", STRANGER, { subscriber: true }],
  ["ContactMatch", STRANGER, { contactMatch: true }],
  ["знакомый без связи", STRANGER, {}],
  ["аноним", null, {}],
] as const;

describe("canSeePersonalDate — кто видит дату (AD-23)", () => {
  it("владелец видит свои даты при любой видимости и даже при Block", () => {
    for (const visibility of ["ONLY_ME", "FRIENDS", "EVERYONE"] as const) {
      expect(canSeePersonalDate(OWNER, relations(), stored({ visibility }))).toBe(true);
      expect(canSeePersonalDate(OWNER, relations({ blocked: true }), stored({ visibility }))).toBe(
        true,
      );
    }
  });

  it("«только я» не видит никто, кроме владельца", () => {
    for (const [, viewer, facts] of VIEWERS) {
      expect(canSeePersonalDate(viewer, relations(facts), stored({ visibility: "ONLY_ME" }))).toBe(
        false,
      );
    }
  });

  it("«друзья» видит принятый друг и больше никто", () => {
    for (const [name, viewer, facts] of VIEWERS) {
      const expected = name === "друг";
      expect(
        canSeePersonalDate(viewer, relations(facts), stored({ visibility: "FRIENDS" })),
        name,
      ).toBe(expected);
    }
  });

  it("«все» видит любой зритель профиля — друг, подписчик, ContactMatch, знакомый, аноним", () => {
    for (const [name, viewer, facts] of VIEWERS) {
      expect(
        canSeePersonalDate(viewer, relations(facts), stored({ visibility: "EVERYONE" })),
        name,
      ).toBe(true);
    }
  });

  it("Block в любую сторону закрывает «друзья» и «все»", () => {
    for (const [name, viewer, facts] of VIEWERS) {
      const blocked = relations({ ...facts, blocked: true });
      expect(canSeePersonalDate(viewer, blocked, stored({ visibility: "FRIENDS" })), name).toBe(
        false,
      );
      expect(canSeePersonalDate(viewer, blocked, stored({ visibility: "EVERYONE" })), name).toBe(
        false,
      );
    }
  });

  it("/l/:token не отдаёт даты никогда, даже «все»", () => {
    for (const [name, viewer, facts] of VIEWERS) {
      const viaToken = relations({ ...facts, viaListToken: true });
      expect(canSeePersonalDate(viewer, viaToken, stored({ visibility: "EVERYONE" })), name).toBe(
        false,
      );
    }
    // The owner still sees their own date through their own read.
    expect(canSeePersonalDate(OWNER, relations({ viaListToken: true }), stored())).toBe(true);
  });
});

describe("canSeePersonalDateYear — кто видит год (AD-23)", () => {
  it("владелец видит год, когда он есть", () => {
    expect(canSeePersonalDateYear(OWNER, relations(), stored())).toBe(true);
    expect(canSeePersonalDateYear(OWNER, relations(), stored({ year: null }))).toBe(false);
  });

  it("год без самой даты не открывается никому", () => {
    for (const [, viewer, facts] of VIEWERS) {
      expect(
        canSeePersonalDateYear(
          viewer,
          relations(facts),
          stored({ visibility: "ONLY_ME", yearVisibility: "EVERYONE" }),
        ),
      ).toBe(false);
    }
  });

  it("«все» у даты само по себе год не открывает: по умолчанию он «только я»", () => {
    for (const [name, viewer, facts] of VIEWERS) {
      expect(
        canSeePersonalDateYear(
          viewer,
          relations(facts),
          stored({ visibility: "EVERYONE", yearVisibility: "ONLY_ME" }),
        ),
        name,
      ).toBe(false);
    }
  });

  it("открытый год «друзья» видит только принятый друг", () => {
    for (const [name, viewer, facts] of VIEWERS) {
      const expected = name === "друг";
      expect(
        canSeePersonalDateYear(
          viewer,
          relations(facts),
          stored({ visibility: "EVERYONE", yearVisibility: "FRIENDS" }),
        ),
        name,
      ).toBe(expected);
    }
  });

  it("открытый год «все» видит каждый, кому видна дата", () => {
    for (const [name, viewer, facts] of VIEWERS) {
      expect(
        canSeePersonalDateYear(
          viewer,
          relations(facts),
          stored({ visibility: "EVERYONE", yearVisibility: "EVERYONE" }),
        ),
        name,
      ).toBe(true);
    }

    // ...но не когда сама дата закрыта.
    expect(
      canSeePersonalDateYear(
        FRIEND,
        relations({ friend: true }),
        stored({ visibility: "ONLY_ME", yearVisibility: "EVERYONE" }),
      ),
    ).toBe(false);
  });

  it("закрытый год не открывает Block и не отдаёт дата без года", () => {
    expect(
      canSeePersonalDateYear(
        FRIEND,
        relations({ friend: true, blocked: true }),
        stored({ visibility: "EVERYONE", yearVisibility: "EVERYONE" }),
      ),
    ).toBe(false);
    expect(
      canSeePersonalDateYear(
        FRIEND,
        relations({ friend: true }),
        stored({ visibility: "EVERYONE", yearVisibility: "EVERYONE", year: null }),
      ),
    ).toBe(false);
  });
});

describe("personalDateFor — что уходит зрителю", () => {
  it("друг получает дату без переключателей видимости", () => {
    const row = personalDateFor(FRIEND, relations({ friend: true }), stored());

    expect(row).toEqual({
      id: "d1",
      kind: "CUSTOM",
      title: "Годовщина",
      day: 14,
      month: 6,
      year: null,
    });
    expect(row).not.toHaveProperty("visibility");
    expect(row).not.toHaveProperty("yearVisibility");
    expect(row).not.toHaveProperty("ownerId");
  });

  it("закрытый год приходит как null, как и отсутствие года", () => {
    const hidden = personalDateFor(STRANGER, relations(), stored({ visibility: "EVERYONE" }));
    const missing = personalDateFor(
      STRANGER,
      relations(),
      stored({ visibility: "EVERYONE", year: null }),
    );

    expect(hidden?.year).toBeNull();
    expect(missing).toEqual(hidden);
  });

  it("открытый год приходит числом", () => {
    const row = personalDateFor(
      FRIEND,
      relations({ friend: true }),
      stored({ visibility: "FRIENDS", yearVisibility: "FRIENDS" }),
    );

    expect(row?.year).toBe(2020);
  });

  it("владелец получает полную строку через toPersonalDate", () => {
    expect(toPersonalDate(stored())).toEqual({
      id: "d1",
      kind: "CUSTOM",
      title: "Годовщина",
      day: 14,
      month: 6,
      year: 2020,
      visibility: "FRIENDS",
      yearVisibility: "ONLY_ME",
    });
  });
});

describe("visiblePersonalDates — список профиля", () => {
  const dates = [
    stored({ id: "d1", visibility: "EVERYONE", yearVisibility: "EVERYONE" }),
    stored({ id: "d2", visibility: "ONLY_ME" }),
    stored({ id: "d3", visibility: "FRIENDS" }),
  ];

  it("друг видит «все» и «друзья» в исходном порядке, без «только я»", () => {
    const visible = visiblePersonalDates(FRIEND, relations({ friend: true }), dates);

    expect(visible.map((date) => date.id)).toEqual(["d1", "d3"]);
    expect(visible[0]?.year).toBe(2020);
  });

  it("подписчик видит только «все» и без года по умолчанию", () => {
    const visible = visiblePersonalDates(STRANGER, relations({ subscriber: true }), dates);

    expect(visible.map((date) => date.id)).toEqual(["d1"]);
    expect(visible[0]?.year).toBe(2020);
  });

  it("аноним видит только «все»", () => {
    expect(visiblePersonalDates(null, relations(), dates).map((date) => date.id)).toEqual(["d1"]);
  });

  it("Block оставляет пустой список, а владелец видит все свои строки", () => {
    expect(visiblePersonalDates(FRIEND, relations({ friend: true, blocked: true }), dates)).toEqual(
      [],
    );
    expect(dates.map((date) => toPersonalDate(date).id)).toEqual(["d1", "d2", "d3"]);
  });
});
