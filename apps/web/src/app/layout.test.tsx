// @vitest-environment node
import { type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * CLE-135 (Story 6.4): `/l`, `/l/{token}/{giftId}` and `/i` are Russian pages, and
 * the document says so — `<html lang="ru">` comes from the one root layout and the
 * negotiated public locale (`PUBLIC_LOCALE_HEADER`, AD-27), not from the view.
 * `next/font/local` and the Tamagui registry are not what this test is about, so
 * they are replaced with stubs; the markup of `html`/`body` stays real.
 */
const request = vi.hoisted(() => ({ headers: new Headers() }));

vi.mock("next/headers", () => ({ headers: async () => request.headers }));
vi.mock("next/font/local", () => ({
  default: () => ({ variable: "--font-stub" }),
}));
vi.mock("@/lib/env", () => ({ getBrandName: () => "WishMoon" }));
vi.mock("./tamagui-registry", () => ({
  TamaguiRegistry: ({ children }: { children: ReactNode }) => children,
}));

import RootLayout from "./layout";

async function render(): Promise<string> {
  return renderToString(
    await RootLayout({ params: Promise.resolve({}), children: <p>Содержимое</p> }),
  );
}

describe("app/layout.tsx: язык документа публичных страниц", () => {
  it("без заголовка прокси отдаёт русский lang", async () => {
    request.headers = new Headers();

    const html = await render();

    expect(html).toContain('<html lang="ru"');
    expect(html).toContain("<body>");
    expect(html).toContain("Содержимое");
  });

  it("язык из PUBLIC_LOCALE_HEADER уходит в lang (так /l и /i получают ru)", async () => {
    request.headers = new Headers({ "x-gift-list-locale": "ru" });

    const html = await render();

    expect(html).toContain('<html lang="ru"');
    expect(html).toContain("--font-stub");
  });
});
