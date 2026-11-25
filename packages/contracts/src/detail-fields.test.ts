import { describe, expect, it } from "vitest";
import type { GiftCard } from "./index";
import { toDetailFacts } from "./detail-fields";

function gift(overrides: Partial<GiftCard> = {}): GiftCard {
  return {
    id: "g1",
    title: "Плед",
    description: "Тёплый, цвет — овсяный.",
    priceAmount: 250000,
    priceCurrency: "RUB",
    linkUrl: "https://shop.example/pled",
    visibility: "FRIENDS",
    quantity: "SINGLE",
    expiresOn: "2026-12-31",
    archivedAt: "2026-11-01T00:00:00.000Z",
    tags: [
      { catalogId: "home", label: "Дом" },
      { catalogId: null, label: "Уют" },
    ],
    status: "RESERVED",
    reservedBy: { id: "u2", nick: "anna", displayName: "Анна" },
    reservationLabel: "BOUGHT",
    ownerAction: "CONFIRM_GIVEN",
    reservation: {
      dueAt: "2026-12-01",
      phase: "ACTIVE",
      bought: true,
      holderVisibleToOwner: false,
      holderVisibleToOthers: true,
    },
    ...overrides,
  };
}

function ids(viewer: "owner" | "guest", overrides?: Partial<GiftCard>): string[] {
  return toDetailFacts(gift(overrides), viewer, "ru").map(function idOf(fact) {
    return fact.id;
  });
}

describe("toDetailFacts", () => {
  it("владелец видит свои поля и не видит блок брони, даже если он попал в объект", () => {
    const facts = toDetailFacts(gift(), "owner", "ru");
    const factIds = facts.map(function idOf(fact) {
      return fact.id;
    });

    expect(factIds).toEqual([
      "description",
      "price",
      "link",
      "quantity",
      "expires",
      "tags",
      "status",
      "visibility",
      "archived",
    ]);
    expect(factIds).not.toContain("reservedBy");
    expect(factIds).not.toContain("ownerAction");
    expect(factIds).not.toContain("due");
    expect(factIds).not.toContain("phase");
    expect(factIds).not.toContain("bought");
    expect(factIds).not.toContain("reservationLabel");
    expect(factIds).not.toContain("showOwner");
    expect(facts.find(function isVisibility(fact) {
      return fact.id === "visibility";
    })?.value).toBe("Друзьям");
    expect(facts.find(function isExpires(fact) {
      return fact.id === "expires";
    })?.value).toBe("31.12.2026");
    expect(facts.find(function isStatus(fact) {
      return fact.id === "status";
    })?.value).toBe("Открыт");
    expect(facts.map(function valueOf(fact) {
      return fact.value;
    }).join(" ")).not.toContain("01.12.2026");
    expect(facts.map(function valueOf(fact) {
      return fact.value;
    }).join(" ")).not.toContain("Куплено");
    expect(facts.map(function valueOf(fact) {
      return fact.value;
    }).join(" ")).not.toContain("Куплен");
    expect(facts.map(function valueOf(fact) {
      return fact.value;
    }).join(" ")).not.toContain("Анна");
  });

  /** D-49: a stale owner payload with `RESERVED` still reads as an open wish. */
  it("владелец не получает ни одного признака брони, даже если ответ старый", () => {
    const facts = toDetailFacts(gift(), "owner", "ru");
    const text = facts.map(function valueOf(fact) {
      return fact.value;
    }).join(" ");

    expect(text).not.toContain("Забронирован");
    expect(text).not.toContain("Берёт");
    expect(text).not.toContain("Ждёт вашего подтверждения");
    expect(text).not.toContain("Срок брони истёк");
  });

  it("гость не видит видимость и действия владельца, держатель видит свою бронь", () => {
    const facts = toDetailFacts(gift(), "guest", "ru");
    const factIds = facts.map(function idOf(fact) {
      return fact.id;
    });

    expect(factIds).not.toContain("visibility");
    expect(factIds).not.toContain("ownerAction");
    expect(factIds).not.toContain("archived");
    expect(factIds).toContain("due");
    expect(factIds).toContain("phase");
    expect(factIds).toContain("bought");
    expect(factIds).toContain("reservationLabel");
    expect(facts.find(function isDue(fact) {
      return fact.id === "due";
    })?.value).toContain("01.12.2026");
    expect(facts.find(function isShowOthers(fact) {
      return fact.id === "showOthers";
    })?.value).toBe("да");
    expect(facts.map(function valueOf(fact) {
      return fact.value;
    }).join(" ")).not.toContain("Друзьям");
    expect(facts.map(function valueOf(fact) {
      return fact.value;
    }).join(" ")).not.toContain("Секрет");
  });

  it("гость без ключа reservation не получает срок, фазу и переключатели", () => {
    const factIds = ids("guest", { reservation: undefined, reservationLabel: null, reservedBy: null });
    expect(factIds).not.toContain("due");
    expect(factIds).not.toContain("phase");
    expect(factIds).not.toContain("bought");
    expect(factIds).not.toContain("showOthers");
    expect(factIds).not.toContain("showOwner");
    expect(factIds).not.toContain("reservationLabel");
    expect(factIds).not.toContain("visibility");
  });

  it("ссылка остаётся адресом, пустое описание не рисуется", () => {
    const facts = toDetailFacts(gift({ description: "   ", linkUrl: null }), "guest", "ru");
    expect(facts.map(function idOf(fact) {
      return fact.id;
    })).not.toContain("description");
    expect(facts.map(function idOf(fact) {
      return fact.id;
    })).not.toContain("link");
    const link = toDetailFacts(gift(), "guest", "ru").find(function isLink(fact) {
      return fact.id === "link";
    });
    expect(link?.href).toBe("https://shop.example/pled");
  });
});
