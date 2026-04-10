import { Clock, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { OldestStockItem } from "@/lib/types/database";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface OldestStockProps {
  items: OldestStockItem[];
}

export default function OldestStock({ items }: OldestStockProps) {
  const getDaysAgo = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  };

  const maxDays = items.length > 0 ? getDaysAgo(items[0].entry_date) : 1;

  return (
    <div className="card-base p-6 animate-fade-in">
      <div className="flex items-center gap-2.5 mb-6">
        <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center">
          <Clock className="w-4 h-4 text-red-400" />
        </div>
        <h2 className="text-[13px] font-bold tracking-wide text-foreground">
          Stock Mas Antiguo
        </h2>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => {
          const days = getDaysAgo(item.entry_date);
          const pct = Math.min((days / Math.max(maxDays, 1)) * 100, 100);

          return (
            <div
              key={item.id}
              className="group rounded-xl p-3 hover:bg-accent/[0.04] transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white ${
                      index === 0
                        ? "bg-gradient-to-br from-red-500 to-red-700"
                        : index === 1
                        ? "bg-gradient-to-br from-orange-500 to-orange-700"
                        : index === 2
                        ? "bg-gradient-to-br from-amber-500 to-amber-700"
                        : "bg-gradient-to-br from-slate-400 to-slate-600"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-foreground leading-tight">
                      {item.client_name}
                    </p>
                    <p className="text-[10px] text-muted font-medium">
                      {format(new Date(item.entry_date), "dd MMM yyyy", { locale: es })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-red-400">{days}d</span>
                  <Link
                    href={`/clientes`}
                    className="text-muted hover:text-accent transition-all duration-200 opacity-0 group-hover:opacity-100"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-accent/[0.06] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full animate-bar-grow ${
                    index === 0 ? "bg-gradient-to-r from-red-500 to-red-400" :
                    index === 1 ? "bg-gradient-to-r from-orange-500 to-orange-400" :
                    "bg-gradient-to-r from-amber-500 to-amber-400"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="text-center py-6 text-sm text-muted">
            No hay stock registrado
          </p>
        )}
      </div>
    </div>
  );
}
