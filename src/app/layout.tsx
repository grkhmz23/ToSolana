import type { Metadata } from "next";
import { Providers } from "./providers";
import { ToastContainer } from "@/components/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "ToSolana - Bridge Assets to Solana",
  description: "Move assets from EVM chains to Solana. Non-custodial cross-chain bridge.",
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
