import { describe, expect, it } from "vitest";
import { textLength } from "@gift-list/contracts";
import {
  customTagIssue,
  giftTagFromCard,
  giftTagInput,
  giftTagInputs,
  giftTagKey,
  giftTagLabel,
  giftTagsEqual,
  giftTagsKey,
  isCustomTag,
  isFixedTag,
} from "@/ui/gift-form-tags";

const dream = { catalogId: "tag_dream", label: "мечта" };
const need = { catalogId: "tag_need", label: "нужно сейчас" };
const custom = { text: "своё" };

describe("GiftFormTag: модель выбора", () => {
  it("фиксированный тег определяется catalogId, свой — текстом", () => {
    expect(isFixedTag(dream)).toBe(true);
    expect(isCustomTag(dream)).toBe(false);
    expect(isFixedTag(custom)).toBe(false);
    expect(isCustomTag(custom)).toBe(true);
    expect(giftTagKey(dream)).toBe("catalog:tag_dream");
    expect(giftTagKey(custom)).toBe("custom:своё");
  });

  it("на провод уходит ровно один источник: catalogId или text", () => {
    expect(giftTagInput(dream)).toEqual({ catalogId: "tag_dream" });
    expect(giftTagInput(custom)).toEqual({ text: "своё" });
    expect(giftTagInputs([dream, custom])).toEqual([
      { catalogId: "tag_dream" },
      { text: "своё" },
    ]);
  });

  it("карточка AD-12 превращается в форму: null catalogId — свой текст", () => {
    expect(giftTagFromCard({ catalogId: "tag_dream", label: "мечта" })).toEqual(dream);
    expect(giftTagFromCard({ catalogId: null, label: "своё" })).toEqual(custom);
  });

  it("набор сравнивается без учёта порядка и подписи фиксированного тега", () => {
    expect(giftTagsEqual([dream, custom], [custom, dream])).toBe(true);
    expect(
      giftTagsEqual(
        [{ catalogId: "tag_dream", label: "dream" }],
        [{ catalogId: "tag_dream", label: "мечта" }],
      ),
    ).toBe(true);
    expect(giftTagsKey([need, dream])).toBe(giftTagsKey([dream, need]));
    expect(giftTagsEqual([dream], [dream, custom])).toBe(false);
    expect(giftTagsEqual([custom], [{ text: "другое" }])).toBe(false);
  });

  it("перевод строки в своём тексте не склеивает разные наборы", () => {
    const split = [{ text: "a" }, { text: "b" }];
    const joined = [{ text: "a\ncustom:b" }];
    expect(giftTagsKey(split)).not.toBe(giftTagsKey(joined));
    expect(giftTagsEqual(split, joined)).toBe(false);
  });

  it("подпись своего тега — его текст, фиксированного — подпись сервера", () => {
    expect(giftTagLabel(dream)).toBe("мечта");
    expect(giftTagLabel(custom)).toBe("своё");
  });
});

describe("customTagIssue: правило своего тега", () => {
  it("пустой и пробельный текст не добавляется", () => {
    expect(customTagIssue("", [])).toBe("empty");
    expect(customTagIssue("   ", [])).toBe("empty");
  });

  it("trim применяется до проверки длины", () => {
    expect(customTagIssue("  мечта  ", [])).toBeNull();
    expect(customTagIssue(`  ${"a".repeat(30)}  `, [])).toBeNull();
  });

  it("30 кодовых точек принимаются, 31 — нет", () => {
    const thirtyEmoji = "😀".repeat(30);
    expect(textLength(thirtyEmoji)).toBe(30);
    expect(thirtyEmoji.length).toBe(60);
    expect(customTagIssue(thirtyEmoji, [])).toBeNull();
    expect(customTagIssue("😀".repeat(31), [])).toBe("tooLong");
  });

  it("NUL отклоняется до запроса: PostgreSQL его не хранит", () => {
    expect(customTagIssue("сво\u0000ё", [])).toBe("invalid");
  });

  it("повтор своего текста отклоняется после trim и с учётом регистра", () => {
    expect(customTagIssue("  своё  ", [custom])).toBe("duplicate");
    expect(customTagIssue("Своё", [custom])).toBeNull();
    // Совпадение с подписью фиксированного тега — не дубль: у них разные uniques.
    expect(customTagIssue("мечта", [dream])).toBeNull();
  });
});
