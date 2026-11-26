import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGiftListConfig, GiftListProvider } from "@gift-list/ui";

const { headers, getUnsubscribePage, buildUnsubscribeMetadata, getBrandName } = vi.hoisted(() => ({
  headers: vi.fn(),
  getUnsubscribePage: vi.fn(),
  buildUnsubscribeMetadata: vi.fn(),
  getBrandName: vi.fn(() => "WishMoon"),
}));

vi.mock("next/headers", () => ({ headers }));
vi.mock("@/lib/env", () => ({ getBrandName }));
vi.mock("./unsubscribe-page", () => ({ getUnsubscribePage, buildUnsubscribeMetadata }));

import UnsubscribePage, { generateMetadata } from "./page";

const config = createGiftListConfig({
  body: "var(--font-sans)",
  heading: "var(--font-heading)",
});

const params = Promise.resolve({ token: "tok-1" });

async function render(
  view: Awaited<ReturnType<typeof getUnsubscribePage>>["view"],
  searchParams: Record<string, string> = {},
): Promise<string> {
  getUnsubscribePage.mockResolvedValue({ locale: "ru", view });
  const element = await UnsubscribePage({
    params,
    searchParams: Promise.resolve(searchParams),
  });
  return renderToString(<GiftListProvider config={config}>{element}</GiftListProvider>);
}

beforeEach(() => {
  headers.mockReset();
  getUnsubscribePage.mockReset();
  buildUnsubscribeMetadata.mockReset();
  headers.mockResolvedValue(new Headers({ "accept-language": "ru-RU,ru;q=0.9" }));
});

describe("app/unsubscribe/[token]/page.tsx", () => {
  it("confirms the date reminder opt-out, offers «Вернуть» and no way into an account", async () => {
    const html = await render({ kind: "done", type: "friendDates" });

    expect(html).toContain("Вы отписались от напоминаний о днях рождения и датах друзей");
    expect(html).toContain("Вернуть");
    expect(html).toContain('method="post"');
    expect(html).toContain('action="/unsubscribe/tok-1/restore"');
    expect(html).not.toContain("Войти");
    expect(html).not.toContain("Настройки");
    expect(html).not.toContain("friendDates");
    expect(html.match(/aria-level="1"/g)).toHaveLength(1);
  });

  it("confirms the own-list reminder opt-out", async () => {
    const html = await render({ kind: "done", type: "ownList" });

    expect(html).toContain("Вы отписались от напоминания обновить вишлист");
    expect(html).toContain('action="/unsubscribe/tok-1/restore"');
  });

  it("reads the restored state from the form redirect and leaves the write to the POST", async () => {
    await render({ kind: "restored" }, { restored: "1" });

    expect(getUnsubscribePage).toHaveBeenCalledWith("tok-1", true);
  });

  it("shows the restored sentence as the one status heading and drops the button", async () => {
    const html = await render({ kind: "restored" }, { restored: "1" });

    expect(html).toContain("Напоминания снова включены");
    expect(html).toContain('role="status"');
    expect(html).toContain('tabindex="-1"');
    expect(html).not.toContain("Вернуть");
    expect(html.match(/aria-level="1"/g)).toHaveLength(1);
  });

  it("gives a forged token the neutral sentence without any action", async () => {
    const html = await render({ kind: "invalid" });

    expect(html).toContain(
      "Ссылка недействительна. Управлять письмами можно в настройках приложения.",
    );
    expect(html).not.toContain("Вернуть");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("Войти");
  });

  it("gives a forged restored token the neutral sentence without any action", async () => {
    const html = await render({ kind: "invalid" }, { restored: "1" });

    expect(html).toContain(
      "Ссылка недействительна. Управлять письмами можно в настройках приложения.",
    );
    expect(html).not.toContain("Напоминания снова включены");
    expect(html).not.toContain("Вернуть");
    expect(html).not.toContain("<form");
  });

  it("asks the loader to turn the switch off on a plain GET", async () => {
    await render({ kind: "done", type: "friendDates" });

    expect(getUnsubscribePage).toHaveBeenCalledWith("tok-1", false);
  });

  it("builds the document head from the request language and the product", async () => {
    await generateMetadata();

    expect(buildUnsubscribeMetadata).toHaveBeenCalledWith("ru", "WishMoon");
  });
});
