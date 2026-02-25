import type { Metadata } from "next";
import { Providers } from "./providers";
import { ToastContainer } from "@/components/Toast";
import "./globals.css";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "ToSolana - Bridge Assets to Solana",
  description: "Move assets from EVM chains to Solana. Non-custodial cross-chain bridge.",
  keywords: ["Solana", "bridge", "cross-chain", "EVM", "crypto", "DeFi"],
  authors: [{ name: "ToSolana" }],
  creator: "ToSolana",
  publisher: "ToSolana",
  metadataBase: new URL("https://tosolana.io"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "ToSolana - Bridge Assets to Solana",
    description: "Move assets from EVM chains to Solana. Non-custodial cross-chain bridge.",
    url: "https://tosolana.io",
    siteName: "ToSolana",
    images: [
      {
        url: "/icon-512x512.png",
        width: 512,
        height: 512,
        alt: "ToSolana Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ToSolana - Bridge Assets to Solana",
    description: "Move assets from EVM chains to Solana. Non-custodial cross-chain bridge.",
    images: ["/icon-512x512.png"],
    creator: "@tosolana",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
    ],
    other: [
      { rel: "mask-icon", url: "/tosolana-logo.svg", color: "#9945FF" },
    ],
  },
  manifest: "/manifest.json",
  themeColor: "#9945FF",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ToSolana",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>
          {children}
          <ToastContainer />
        </Providers>
      </body>
    </html>
  );
}
