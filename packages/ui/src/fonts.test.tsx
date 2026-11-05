// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createGiftListConfig } from "./config";
import { fontFor } from "./font-style";
import { Button } from "./button";
import { GiftListProvider } from "./provider";
import { Heading, Text } from "./text";
import { TextField } from "./text-field";

const config = createGiftListConfig({
  body: "Manrope",
  heading: "Lora",
  bodyFaces: { 400: "Manrope", 500: "Manrope-500", 600: "Manrope-600" },
});

function html(element: React.ReactElement) {
  return renderToString(<GiftListProvider config={config}>{element}</GiftListProvider>);
}

describe("шрифты на вебе (Expo web)", () => {
  it("fontFor выбирает семейство по весу роли, Lora отдельно", () => {
    expect(fontFor("body").fontFamily).toBe("body");
    expect(fontFor("button").fontFamily).toBe("body-600");
    expect(fontFor("display").fontFamily).toBe("display");
  });

  it("вес 500/600 попадает в загруженный файл начертания с обычным весом", () => {
    const out = html(
      <>
        <Text kind="button">a</Text>
        <Text kind="display">b</Text>
        <Text kind="body">c</Text>
      </>,
    );
    const rule = (font: string) => out.match(new RegExp(String.raw`.font_${font}, [^{]*{[^}]*}`))?.[0] ?? "";
    expect(rule("body-600")).toContain("--f-family:Manrope-600");
    expect(rule("body-600")).toContain("--f-weight-button:400");
    expect(rule("body-500")).toContain("--f-family:Manrope-500");
    expect(rule("body-500")).toContain("--f-weight-label:400");
    expect(rule("display")).toContain("--f-family:Lora");
    expect(rule("display")).toContain("--f-weight-display:400");
  });

  /** The class list of the element that holds the text (the font class sits on it). */
  function classesOf(out: string, text: string): string {
    const end = out.indexOf(`>${text}<`);
    const tag = out.slice(out.lastIndexOf("<", end), end);
    return tag.match(/class="([^"]*)"/)?.[1] ?? "";
  }

  it("элемент с ролью получает класс шрифта своего файла (font_*)", () => {
    const out = html(
      <>
        <Heading level={1} kind="display-sm">Вход</Heading>
        <Text kind="label">Email</Text>
        <Text kind="body">Текст</Text>
        <Button label="Войти" onPress={() => {}} />
        <TextField label="Пароль" value="" onChangeText={() => {}} />
      </>,
    );

    expect(classesOf(out, "Вход")).toContain("font_display");
    expect(classesOf(out, "Email")).toContain("font_body-500");
    expect(classesOf(out, "Войти")).toContain("font_body-600");
    expect(classesOf(out, "Пароль")).toContain("font_body-500");
    expect(classesOf(out, "Текст")).not.toContain("font_body-");
  });
});
