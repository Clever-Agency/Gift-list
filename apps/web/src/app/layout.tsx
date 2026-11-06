import type { Metadata } from "next";
import { headers } from "next/headers";
import { Lora, Manrope } from "next/font/google";
import { createTranslator } from "next-intl";
import { DEFAULT_LOCALE, getMessages } from "@gift-list/contracts";
import { getBrandName } from "@/lib/env";
import { pageLocale } from "@/lib/request-locale";
import "./globals.css";
import { TamaguiRegistry } from "./tamagui-registry";

const webCopy = createTranslator({
  locale: DEFAULT_LOCALE,
  messages: getMessages(DEFAULT_LOCALE),
  namespace: "web",
});

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const lora = Lora({
  variable: "--font-heading",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  weight: "600",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: getBrandName(),
    description: webCopy("description"),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The proxy marks `/l/*` with the negotiated language; every other route keeps
  // `ru`, so the Russian-only admin does not start varying by `Accept-Language`.
  const locale = pageLocale(await headers());
  return (
    <html lang={locale} className={`${manrope.variable} ${lora.variable}`}>
      <body>
        <TamaguiRegistry>{children}</TamaguiRegistry>
      </body>
    </html>
  );
}
