import { describe, expect, it } from "vitest";
import { PRODUCT_NAME } from "../brand";
import { ERROR_CODES, ERROR_REASONS, PASSWORD_MAX, PASSWORD_MIN } from "../index";
import {
  compareForSort,
  formatDate,
  formatPrice,
  getMessages,
  negotiateLocale,
  normalizeForSearch,
  preferredFromAcceptLanguage,
} from "./index";

describe("negotiateLocale", () => {
  it("returns ru for an empty list", () => {
    expect(negotiateLocale([])).toBe("ru");
  });

  it("returns ru when nothing is supported", () => {
    expect(negotiateLocale(["en-US"])).toBe("ru");
  });

  it("matches the language subtag of a regional tag", () => {
    expect(negotiateLocale(["ru-BY"])).toBe("ru");
  });

  it("negotiates ru out of an Accept-Language header that also lists English", () => {
    expect(negotiateLocale(preferredFromAcceptLanguage("en-US,ru;q=0.8"))).toBe("ru");
  });

  it("falls back when the header is only English", () => {
    expect(negotiateLocale(preferredFromAcceptLanguage("en;q=0.9"))).toBe("ru");
  });

  it("treats a missing header as no preference", () => {
    expect(preferredFromAcceptLanguage(null)).toEqual([]);
    expect(negotiateLocale(preferredFromAcceptLanguage(null))).toBe("ru");
  });
});

describe("normalizeForSearch", () => {
  it("folds ё and an NFD spelling of the same name", () => {
    expect(normalizeForSearch("Алёна")).toBe("алена");
    expect(normalizeForSearch("Алёна".normalize("NFD"))).toBe("алена");
  });

  it("keeps й", () => {
    expect(normalizeForSearch("Йога")).toBe("йога");
  });
});

describe("formatDate", () => {
  it("formats a calendar date without shifting the day", () => {
    expect(formatDate("2026-10-31", "ru")).toBe("31.10.2026");
  });

  it("formats an instant in the requested time zone", () => {
    expect(formatDate("2026-10-31T23:30:00.000Z", "ru", { timeZone: "Europe/Minsk" })).toBe(
      "01.11.2026",
    );
  });
});

describe("formatPrice", () => {
  it("formats BYN from minor units with the currency code", () => {
    expect(formatPrice(1050, "BYN", "ru")).toBe("10,50\u00a0BYN");
  });

  it("formats RUB with the ruble sign", () => {
    expect(formatPrice(250000, "RUB", "ru")).toBe("2\u00a0500,00\u00a0₽");
  });

  it("throws for a currency outside the closed set", () => {
    expect(() => formatPrice(100, "GBP", "ru")).toThrow();
  });
});

describe("compareForSort", () => {
  it("orders Алена, Алёна, then Яна", () => {
    const names = ["Яна", "Алёна", "Алена"];
    names.sort((left, right) => compareForSort("ru", left, right));
    expect(names).toEqual(["Алена", "Алёна", "Яна"]);
  });
});

describe("catalogs", () => {
  it("does not embed the product name, neither the current nor the old one", () => {
    const catalog = JSON.stringify(getMessages("ru"));
    expect(catalog.includes(PRODUCT_NAME)).toBe(false);
    expect(catalog.includes("Gift List")).toBe(false);
  });
});

describe("not-found copy", () => {
  /**
   * CLE-102: a not-found state is one and the same sentence on the web page and
   * in the app, and a sentence ends with a period (`EXPERIENCE.md` → State
   * Patterns: «Список не найден.», «Приглашение не найдено.»).
   */
  it("is the same sentence with a final period on the web and in the app", () => {
    const { web, app } = getMessages("ru");
    const pairs: ReadonlyArray<readonly [string, string]> = [
      [web.wishlist.notFound, app.myWishlist.listNotFound],
      [web.invite.notFound, app.invite.notFound],
    ];

    for (const [webText, appText] of pairs) {
      expect(webText).toBe(appText);
      expect(webText.endsWith(".")).toBe(true);
    }
  });

  /** A page title is not a sentence: it drops the final period before the brand. */
  it("keeps the document titles without the final period", () => {
    const { web } = getMessages("ru");

    expect(web.wishlist.notFoundTitle).toBe(`${web.wishlist.notFound.slice(0, -1)} — {brand}`);
    expect(web.invite.notFoundTitle).toBe(`${web.invite.notFound.slice(0, -1)} — {brand}`);
  });
});

describe("public shell copy", () => {
  /**
   * CLE-105: the skip link is the first stop of the Tab order on `/l` and `/i`
   * (`DESIGN.md` → Порядок Tab, Next-страницы). One sentence in the catalog, so
   * the shell never hard-codes the label.
   */
  it("names the skip link «Перейти к содержимому» without a final period", () => {
    const { skipToContent } = getMessages("ru").web;

    expect(skipToContent).toBe("Перейти к содержимому");
    expect(skipToContent.endsWith(".")).toBe(false);
  });
});

describe("invite confirmation copy", () => {
  /**
   * CLE-73 followup: the name is not declined (AD-24), so the sentence names
   * «пользователя» and keeps the display name in «ёлочки», the same way the
   * catalog quotes `{char}` and `{query}`.
   */
  it("quotes the display name and substitutes it unchanged", () => {
    const text = getMessages("ru").app.invite.addTitle;

    expect(text).toBe("Добавить пользователя «{name}» в друзья?");
    expect(text.match(/\{name\}/g)).toHaveLength(1);
    expect(text.replace("{name}", "Сергей")).toBe("Добавить пользователя «Сергей» в друзья?");
  });
});

describe("reservation release copy", () => {
  /**
   * Story 5.2: the holder's confirm and the owner's step are worded by the AC of
   * the story and by `EXPERIENCE.md`, so the catalog keeps the sentences verbatim.
   */
  it("keeps the release texts verbatim and not empty", () => {
    const release = getMessages("ru").app.gift.release;

    expect(release.title).toBe("Снять бронь? Желание снова станет открытым.");
    expect(release.confirm).toBe("Снять бронь");
    expect(release.cancel).toBe("Отмена");
    expect(release.warningBought).toBe(
      "Даритель отметил, что подарок уже куплен. Если снять бронь, его может купить кто-то ещё",
    );
    expect(release.warningGiven).toBe("Даритель отметил, что уже вручил");
    for (const text of Object.values(release)) {
      expect(text.length).toBeGreaterThan(0);
    }
  });
});

describe("closing copy", () => {
  /**
   * Story 5.3: закрытие владельцем, секция «Получено» и undo-тост — дословно из
   * epics (Story 5.3), EXPERIENCE (Undo toast, Received section) и DESIGN
   * (Archive section, мелкие элементы: «Вернуть в открытые · ещё N мин»).
   */
  it("keeps the close, closed and undo texts verbatim", () => {
    const { app, common } = getMessages("ru");
    const { close, closed, toast } = app.gift;

    expect(close.menuAction).toBe("Отметить полученным");
    expect(close.title).toBe("Подарок «{title}» получен?");
    expect(close.reservedBody).toBe("Бронь будет закрыта, бронировавший получит уведомление");
    expect(close.confirm).toBe("Подтвердить");
    expect(close.cancel).toBe("Отмена");

    expect(closed.undo).toBe("Вернуть в открытые");
    expect(closed.undoWithTime).toBe("Вернуть в открытые · ещё {minutes} мин");
    expect(closed.copy).toBe("Хочу ещё такой");
    expect(closed.delete).toBe("Удалить");
    expect(closed.sectionOwner).toBe("Получено ({count})");
    expect(closed.sectionViewer).toBe("Уже подарено");
    expect(closed.menuLabel).toBe("Меню");

    expect(toast.closed).toBe("Отмечено полученным");
    expect(toast.undo).toBe("Отменить");

    expect(common.errors.reason.UNDO_WINDOW_EXPIRED).toBe("Время на отмену вышло");

    for (const text of [...Object.values(close), ...Object.values(closed)]) {
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it("substitutes the title and the minutes exactly once", () => {
    const { app } = getMessages("ru");

    expect(app.gift.close.title.replace("{title}", "Наушники")).toBe(
      "Подарок «Наушники» получен?",
    );
    expect(app.gift.closed.undoWithTime.replace("{minutes}", "7")).toBe(
      "Вернуть в открытые · ещё 7 мин",
    );
  });

  it("counts the received section the same way as the archive", () => {
    const { app } = getMessages("ru");

    expect(app.gift.closed.sectionOwner).toContain("{count}");
    expect(app.myWishlist.archiveSection).toContain("{count}");
  });
});

describe("error catalog", () => {
  it("covers every error code and reason with non-empty text", () => {
    const { code, reason } = getMessages("ru").common.errors;
    expect(Object.keys(code).sort()).toEqual([...ERROR_CODES].sort());
    expect(Object.keys(reason).sort()).toEqual([...ERROR_REASONS].sort());
    for (const text of [...Object.values(code), ...Object.values(reason)]) {
      expect(text.length).toBeGreaterThan(0);
    }
    const app = getMessages("ru").app.form;
    expect(app.passwordRules).toContain(String(PASSWORD_MIN));
    expect(reason.PASSWORD_TOO_SHORT).toBe(app.passwordRules);
    expect(reason.PASSWORD_TOO_LONG).toContain(String(PASSWORD_MAX));
  });
});
