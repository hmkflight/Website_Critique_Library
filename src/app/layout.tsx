import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: { default: "Website Critique Library", template: "%s · Critique Library" },
  description: "Hudson's workspace for Claude critiques, revisions and final review.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} antialiased`}>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">
          Skip to content
        </a>
        <header className="border-b border-rule">
          <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-5 py-3 sm:px-8">
            <Link href="/" className="group flex items-baseline gap-2">
              <span className="font-display text-lg italic leading-none">Critique Library</span>
              <span className="tag hidden text-ink-3 sm:inline">Codex → Claude → Hudson</span>
            </Link>
            <span className="tag text-ink-3">Local workspace</span>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-[1240px] px-5 pb-24 sm:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
