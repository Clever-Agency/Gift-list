import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";

// DM Sans / Fraunces have no Cyrillic glyphs in Google Fonts (next/font subsets:
// latin|latin-ext only). Cyrillic UI falls back to the system stack below.
const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  fallback: [
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "Arial",
    "Noto Sans",
    "sans-serif",
  ],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-heading",
  subsets: ["latin", "latin-ext", "vietnamese"],
  fallback: ["Georgia", "Times New Roman", "serif"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Gift List",
  description: "Персональные вишлисты подарков",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${dmSans.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
