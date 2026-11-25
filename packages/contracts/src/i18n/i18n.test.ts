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

  /** Story 5.5: the reservation card shows «до DD.MM»; the detail keeps the full date. */
  it("drops the year only when the caller asks for the short form", () => {
    expect(formatDate("2026-11-20", "ru", { year: false })).toBe("20.11");
    expect(formatDate("2026-11-20", "ru")).toBe("20.11.2026");
    expect(formatDate("2026-11-20", "ru", { year: true })).toBe("20.11.2026");
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

/**
 * Story 6.2: названия разделов навигации и подпись badge входящих запросов.
 * «Разделы», «Вишлист», «Поиск», «Друзья», «Брони», «Профиль», «Мой вишлист»,
 * «Мои брони» — дословно из `EXPERIENCE.md` и `DESIGN.md`; «Мой профиль» и формы
 * множественного числа badge — новые, без утверждения в UX (Open Questions 6.2,
 * п. 13). Шаблон badge повторяет «Друзья, N запроса» из `DESIGN.md` → Badge.
 */
describe("navigation copy", () => {
  /** The ICU plural of the catalog, resolved the way next-intl does for Russian. */
  function friendsBadge(count: number): string {
    const template = getMessages("ru").app.nav.friendsBadge;
    const start = template.indexOf("{count, plural,");
    if (start < 0) throw new Error("app.nav.friendsBadge без ICU-плюрала");
    // Everything after the plural header up to its closing brace: the four forms.
    const body = template.slice(start + "{count, plural,".length, -1);
    const forms = new Map<string, string>();
    for (const [, category, text] of body.matchAll(/(\w+)\s*\{([^{}]*)\}/g)) {
      forms.set(category, text);
    }
    const category = new Intl.PluralRules("ru").select(count);
    const chosen = forms.get(category) ?? forms.get("other") ?? "";
    return `${template.slice(0, start)}${chosen.replace("#", String(count))}`;
  }

  it("keeps the section names verbatim and not empty", () => {
    const nav = getMessages("ru").app.nav;

    expect(nav.sections).toBe("Разделы");
    expect(nav.wishlist).toBe("Мой вишлист");
    expect(nav.wishlistTab).toBe("Вишлист");
    expect(nav.search).toBe("Поиск");
    expect(nav.friends).toBe("Друзья");
    expect(nav.reservations).toBe("Мои брони");
    expect(nav.reservationsTab).toBe("Брони");
    expect(nav.profile).toBe("Профиль");
    expect(nav.myProfile).toBe("Мой профиль");

    for (const text of Object.values(nav)) {
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });

  it("carries only the navigation keys of Story 6.2", () => {
    expect(Object.keys(getMessages("ru").app.nav).sort()).toEqual([
      "friends",
      "friendsBadge",
      "myProfile",
      "profile",
      "reservations",
      "reservationsTab",
      "search",
      "sections",
      "wishlist",
      "wishlistTab",
    ]);
  });

  it("formats the incoming-request badge for 1, 2 and 5", () => {
    const template = getMessages("ru").app.nav.friendsBadge;

    expect(template).toContain("{count, plural");
    expect(friendsBadge(1)).toBe("Друзья, 1 запрос");
    expect(friendsBadge(2)).toBe("Друзья, 2 запроса");
    expect(friendsBadge(5)).toBe("Друзья, 5 запросов");
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
   * Story 5.2: the holder's confirm is worded by the AC of the story and by
   * `EXPERIENCE.md`. D-49 (CLE-124) removed the owner's release, so the warning
   * sentences are gone with it.
   */
  it("keeps the release texts verbatim and not empty", () => {
    const release = getMessages("ru").app.gift.release;

    expect(release.title).toBe("Снять бронь? Желание снова станет открытым.");
    expect(release.confirm).toBe("Снять бронь");
    expect(release.cancel).toBe("Отмена");
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

/**
 * Story 5.5: «Мои брони» — экран держателя. Тексты из epics (Story 5.5),
 * EXPERIENCE (Empty states, Reservation actions, Подписи брони) и DESIGN
 * (ReservationCard), дословно. Три строки новых, без утверждения в UX:
 * `pageTitle`, `loading`, `openGift` (Open Questions спеки 5.5, п. 5).
 */
describe("reservation copy", () => {
  it("keeps the card, empty and action texts verbatim and not empty", () => {
    const reservations = getMessages("ru").app.reservations;

    expect(reservations.title).toBe("Мои брони");
    expect(reservations.pageTitle).toBe("Мои брони — {brand}");
    expect(reservations.loading).toBe("Загружаем брони");
    expect(reservations.emptyTitle).toBe("Броней нет");
    expect(reservations.emptyText).toBe(
      "Нажмите «Куплю сам» у желания друга — бронь появится здесь.",
    );
    expect(reservations.openGift).toBe("Открыть желание «{title}»");
    expect(reservations.owner).toBe("у @{nick}");
    expect(reservations.due).toBe("до {date}");
    expect(reservations.bought).toBe("Купил");
    expect(reservations.boughtChip).toBe("Куплено");

    expect(reservations.visibility.title).toBe("Кто видит, что это я");
    expect(reservations.visibility.others).toBe("Показать другим, кто берёт");
    // CLE-124/D-49: the owner switch and its hint are gone.
    expect(Object.keys(reservations.visibility).sort()).toEqual(["others", "title"]);

    expect(reservations.extend).toBe("Продлить до…");
    expect(reservations.extendCaption).toBe("Не позже {max}");
    expect(reservations.release).toBe("Снять бронь");

    for (const value of Object.values(reservations)) {
      if (typeof value === "string") expect(value.length).toBeGreaterThan(0);
    }
    for (const value of Object.values(reservations.visibility)) {
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it("substitutes the day, the nick, the title and the max day exactly once", () => {
    const reservations = getMessages("ru").app.reservations;

    expect(reservations.due.replace("{date}", "08.12")).toBe("до 08.12");
    expect(reservations.owner.replace("{nick}", "anna")).toBe("у @anna");
    expect(reservations.openGift.replace("{title}", "Наушники")).toBe(
      "Открыть желание «Наушники»",
    );
    expect(reservations.extendCaption.replace("{max}", "20.12.2026")).toBe(
      "Не позже 20.12.2026",
    );
  });

  /** New texts of 5.5 that no source in epics/EXPERIENCE/DESIGN approved. */
  it("marks the three new texts of Story 5.5", () => {
    const reservations = getMessages("ru").app.reservations;

    expect(reservations.pageTitle.endsWith("{brand}")).toBe(true);
    expect(reservations.loading).toBe("Загружаем брони");
    expect(reservations.openGift).toContain("«{title}»");
  });
});

/**
 * Story 5.4: удаление забронированного желания. D-49 (CLE-124) убрал подсказку
 * правки, тела confirm про бронь и тост о брони: владелец не знает о брони.
 * Прежние строки удаления («Удалить «{title}»?», «Удалить», «Отмена»,
 * «Удаляем…», «Желание удалено.») не меняются.
 */
describe("reserved wish editing and deletion copy", () => {
  it("block confirm does not mention a reservation", () => {
    const body = getMessages("ru").app.friends.block.body;

    expect(body).toBe("Вы перестанете видеть друг друга, дружба и подписки удалятся.");
    expect(body).not.toContain("бронь");
  });

  it("no longer carries the edit notice of a reserved wish", () => {
    const { giftForm } = getMessages("ru").app;

    expect("notice" in giftForm).toBe(false);
    expect("quantityLocked" in giftForm.field).toBe(false);
    expect("quantityLocked" in giftForm.error).toBe(false);
  });

  it("keeps the plain delete texts and drops the two reservation bodies", () => {
    const { delete: remove } = getMessages("ru").app.giftForm;

    expect(remove.action).toBe("Удалить желание");
    expect(remove.confirmTitle).toBe("Удалить «{title}»?");
    expect(remove.confirmBody).toBe("Желание исчезнет из вишлиста. Это нельзя отменить.");
    expect(remove.confirm).toBe("Удалить");
    expect(remove.cancel).toBe("Отмена");
    expect(remove.deleting).toBe("Удаляем…");
    expect("reservedBody" in remove).toBe(false);
    expect("reservedBoughtBody" in remove).toBe(false);
    expect(getMessages("ru").app.giftForm.toast.deleted).toBe("Желание удалено.");
    expect("reserved" in getMessages("ru").app.gift.toast).toBe(false);

    for (const text of Object.values(remove)) {
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it("substitutes the title exactly once in the confirm question", () => {
    const remove = getMessages("ru").app.giftForm.delete;

    expect(remove.confirmTitle.replace("{title}", "Наушники")).toBe(
      "Удалить «Наушники»?",
    );
  });
});

/**
 * D-49 (CLE-124), S8: one neutral owner warning before «Изменить», «Удалить» and
 * a visibility narrowing. The texts are `EXPERIENCE.md` → Interaction Primitives,
 * word for word; none of them depends on a reservation.
 */
describe("owner change warning copy", () => {
  it("has the edit question verbatim", () => {
    const edit = getMessages("ru").app.giftForm.surpriseWarning.edit;

    expect(edit.title).toBe("Изменить желание?");
    expect(edit.body).toBe(
      "Кто-то мог уже забронировать или купить этот подарок. Если вы измените желание, даритель получит уведомление.",
    );
    expect(edit.confirm).toBe("Изменить");
    expect(edit.cancel).toBe("Отмена");
  });

  it("has the delete question verbatim, with the wish name", () => {
    const remove = getMessages("ru").app.giftForm.surpriseWarning.delete;

    expect(remove.title).toBe("Удалить «{title}»?");
    expect(remove.title.replace("{title}", "Наушники")).toBe("Удалить «Наушники»?");
    expect(remove.body).toBe(
      "Кто-то мог уже забронировать или купить этот подарок. Даритель получит уведомление. Это нельзя отменить.",
    );
    expect(remove.confirm).toBe("Удалить");
    expect(remove.cancel).toBe("Отмена");
  });

  it("has the visibility question verbatim, with the wish name", () => {
    const visibility = getMessages("ru").app.giftForm.surpriseWarning.visibility;

    expect(visibility.title).toBe("Изменить, кто видит «{title}»?");
    expect(visibility.title.replace("{title}", "Наушники")).toBe(
      "Изменить, кто видит «Наушники»?",
    );
    expect(visibility.body).toBe(
      "Кто-то мог уже забронировать или купить этот подарок. Если он перестанет видеть желание, бронь снимется.",
    );
    expect(visibility.confirm).toBe("Изменить");
    expect(visibility.cancel).toBe("Отмена");
  });

  it("opens with the same sentence in all three questions", () => {
    const warning = getMessages("ru").app.giftForm.surpriseWarning;

    for (const kind of ["edit", "delete", "visibility"] as const) {
      expect(warning[kind].body.startsWith("Кто-то мог уже забронировать или купить этот подарок.")).toBe(
        true,
      );
    }
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
