import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
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

// Subsets of the faces Expo loads (latin, latin-ext, cyrillic, cyrillic-ext).
// woff2 is in the repo, so `next build` does not call fonts.googleapis.com.
// Licenses: ./fonts/OFL-Manrope.txt, ./fonts/OFL-Lora.txt. The Lora file is a
// subset, so its internal name is Gift List Display (OFL reserved name "Lora").
const manrope = localFont({
  src: [
    { path: "./fonts/manrope-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/manrope-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/manrope-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
  adjustFontFallback: "Arial",
});

const lora = localFont({
  src: "./fonts/lora-600.woff2",
  weight: "600",
  style: "normal",
  variable: "--font-heading",
  display: "swap",
  adjustFontFallback: "Times New Roman",
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
