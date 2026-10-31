import type { Metadata } from "next";
import { Lora, Manrope } from "next/font/google";
import { createTranslator } from "next-intl";
import { DEFAULT_LOCALE, getMessages } from "@gift-list/contracts";
import { getBrandName } from "@/lib/env";
import "./globals.css";

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${manrope.variable} ${lora.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
