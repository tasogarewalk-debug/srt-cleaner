import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SRT Cleaner — Clean & Format Subtitle Files",
  description: "Fix typos, remove filler words, and optimize line breaks in your SRT subtitle files. Free, browser-based, no login required.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "SRT Cleaner — Clean & Format Subtitle Files",
    description: "Fix typos, remove filler words, and optimize line breaks in your SRT subtitle files. Free, browser-based, no login required.",
    type: "website",
    locale: "en_US",
    siteName: "SRT Cleaner",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "SRT Cleaner" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SRT Cleaner — Clean & Format Subtitle Files",
    description: "Fix typos, remove filler words, and optimize line breaks in SRT files. Free & browser-based.",
    images: ["/og.png"],
    creator: "@Matsuya_dev",
  },
  keywords: ["SRT", "subtitle editor", "subtitle cleaner", "caption editor", "filler words", "subtitle formatter"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
