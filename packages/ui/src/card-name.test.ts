import { describe, expect, it } from "vitest";
import { joinCardName } from "./card-name";

describe("joinCardName: имя карточки одной фразой", () => {
  it("собирает название, цену, статус и теги через запятую", () => {
    expect(joinCardName(["Плед", "2 500 ₽", "Открыт", "мечта"])).toBe(
      "Плед, 2 500 ₽, Открыт, мечта",
    );
  });

  it("выбрасывает пустые части, чтобы диктор не читал двойные запятые", () => {
    expect(joinCardName(["Плед", null, "", "   ", "Открыт"])).toBe("Плед, Открыт");
  });

  it("на пустом наборе отдаёт пустую строку", () => {
    expect(joinCardName([null, ""])).toBe("");
  });
});
