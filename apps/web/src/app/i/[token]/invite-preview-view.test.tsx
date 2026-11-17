import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AUTHOR_MAILTO, getMessages } from "@gift-list/contracts";
import { createGiftListConfig, GiftListProvider } from "@gift-list/ui";
import { InvitePreviewView, type InvitePreviewData } from "./invite-preview-view";

const config = createGiftListConfig({
  body: "var(--font-sans)",
  heading: "var(--font-heading)",
});

function render(view: InvitePreviewData) {
  return renderToString(
    <GiftListProvider config={config}>
      <InvitePreviewView view={view} locale="ru" brand="WishMoon" />
    </GiftListProvider>,
  );
}

const invite: InvitePreviewData = {
  kind: "invite",
  inviter: { displayName: "Сергей Петров", nick: "sergey" },
  to: "/invite/tok-1",
};

/** L8: a page has exactly one level-1 heading. */
function levelOneHeadings(html: string): number {
  return html.match(/aria-level="1"/g)?.length ?? 0;
}

describe("InvitePreviewView: anonymous invite HTML", () => {
  it("renders the shell, the inviter as the only h1, the body and the app links", () => {
    const html = render(invite);

    expect(levelOneHeadings(html)).toBe(1);
    expect(html).toContain("WishMoon");
    expect(html).toContain("Сергей Петров приглашает вас в друзья");
    expect(html).toContain("Сразу после регистрации вы станете друзьями");
    expect(html).toContain("СП");

    // One primary action into registration with the token in `next`, one ghost
    // action into login with the same return path.
    expect(html).toContain('href="/register?next=/invite/tok-1"');
    expect(html).toContain("Принять приглашение");
    expect(html).toContain('href="/login?next=/invite/tok-1"');
    expect(html).toContain("У меня уже есть аккаунт");
    expect(html).toContain("Войти");

    // The footer of the shell: «Написать автору» and the agency tagline.
    expect(html).toContain(`href="${AUTHOR_MAILTO}"`);
    expect(html).toContain("Написать автору");
    expect(html).toContain("Сделано с любовью командой cleverAgency");
    expect(html).toContain('role="contentinfo"');

    // Server HTML with the Tamagui CSS, not a client-only shell.
    expect(html).toContain('role="main"');
    expect(html).toContain("<style");
    expect(html).toContain("--c-primary:#2F5D3A");
  });

  it("renders one not-found phrase without the inviter, the nick or the actions", () => {
    const html = render({ kind: "not_found" });
    // CLE-102: the phrase is the catalog sentence, not a literal of the view.
    const notFound = getMessages("ru").web.invite.notFound;

    expect(notFound).toBe("Приглашение не найдено.");
    expect(levelOneHeadings(html)).toBe(1);
    expect(html).toContain(notFound);
    expect(html).not.toContain("Сергей");
    expect(html).not.toContain("@sergey");
    expect(html).not.toContain("Принять приглашение");
    expect(html).not.toContain("У меня уже есть аккаунт");
    expect(html).not.toContain("/register");
    // The anonymous shell keeps the one way in and the full footer.
    expect(html).toContain('href="/login"');
    expect(html).toContain(`href="${AUTHOR_MAILTO}"`);
    expect(html).toContain("Написать автору");
    expect(html).toContain("Сделано с любовью командой cleverAgency");
    expect(html).toContain('role="contentinfo"');
  });
});
