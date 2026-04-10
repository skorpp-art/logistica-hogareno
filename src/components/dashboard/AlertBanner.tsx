"use client";

import { Bell, ArrowRight } from "lucide-react";
import Link from "next/link";

interface AlertBannerProps {
  clientNames: string[];
}

export default function AlertBanner({ clientNames }: AlertBannerProps) {
  if (clientNames.length === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl animate-slide-up">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 dark:from-amber-500/10 dark:via-orange-500/5 dark:to-transparent" />
      <div className="absolute inset-0 border border-amber-500/20 rounded-2xl" />

      <div className="relative p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20 animate-float">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-extrabold tracking-[0.2em] text-amber-500 uppercase">
              Recordatorio de salida
            </p>
            <p className="text-sm font-semibold text-foreground mt-1">
              Devoluciones programadas para manana:{" "}
              <span className="text-accent font-bold">
                {clientNames.join(", ")}
              </span>
            </p>
          </div>
        </div>
        <Link
          href="/agenda"
          className="flex items-center gap-2 px-5 py-2.5 text-[11px] font-bold bg-amber-500/10 text-amber-500 rounded-xl hover:bg-amber-500 hover:text-white transition-all duration-300 whitespace-nowrap group"
        >
          VER AGENDA
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
