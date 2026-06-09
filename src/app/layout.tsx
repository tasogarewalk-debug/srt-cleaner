import type { Metadata } from "next";
import Script from "next/script";
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
  verification: {
    google: "2quVhjHIQERuQnsLdTsOac18xjM8-ePREUbrHeEVCsk",
  },
  keywords: ["SRT", "subtitle editor", "subtitle cleaner", "caption editor", "filler words", "subtitle formatter"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-RD0N6DESCP"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-RD0N6DESCP');
          `}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
