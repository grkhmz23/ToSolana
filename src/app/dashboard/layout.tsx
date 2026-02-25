"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { NoiseOverlay } from "@/components/ui/NoiseOverlay";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#05050A] text-slate-50 overflow-hidden relative">
      <NoiseOverlay />

      <div className="fixed inset-0 z-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 15% 50%, rgba(99, 102, 241, 0.15), transparent 50%),
              radial-gradient(circle at 85% 30%, rgba(6, 182, 212, 0.15), transparent 50%),
              radial-gradient(circle at 50% 80%, rgba(139, 92, 246, 0.1), transparent 50%)
            `,
            filter: "blur(60px)",
            animation: "meshPulse 10s ease-in-out infinite alternate",
          }}
        />
      </div>

      <header className="fixed top-6 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-5xl">
        <div className="bg-[#12121a]/80 backdrop-blur-2xl border border-white/10 rounded-full px-6 py-2 shadow-2xl shadow-indigo-500/10 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
            <Image
              src="/icon-192x192.png"
              alt="ToSolana"
              width={48}
              height={48}
              className="w-full h-full object-cover"
              priority
            />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">ToSolana</span>
        </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 hover:text-white transition-colors"
            >
              Bridge
            </Link>
            <Link
              href="/dashboard"
              className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 hover:text-white transition-colors"
            >
              Migration
            </Link>
            <Link
              href="/dashboard/project/new"
              className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 hover:text-white transition-colors"
            >
              New Project
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 pt-28 pb-16 px-4">
        {children}
      </main>

      <style jsx global>{`
        @keyframes meshPulse {
          0% {
            transform: scale(1) rotate(0deg);
          }
          100% {
            transform: scale(1.1) rotate(5deg);
          }
        }
      `}</style>
    </div>
  );
}
