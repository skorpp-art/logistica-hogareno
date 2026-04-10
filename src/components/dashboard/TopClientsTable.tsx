import { ArrowRight, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { TopClient } from "@/lib/types/database";

interface TopClientsTableProps {
  clients: TopClient[];
}

export default function TopClientsTable({ clients }: TopClientsTableProps) {
  return (
    <div className="card-base p-6 animate-fade-in">
      <div className="flex items-center gap-2.5 mb-6">
        <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-accent" />
        </div>
        <h2 className="text-[13px] font-bold tracking-wide text-foreground">
          Top 5 Clientes
        </h2>
        <span className="text-[10px] font-semibold text-muted tracking-wider uppercase ml-auto">
          Mayor Volumen
        </span>
      </div>

      <div className="space-y-1">
        {clients.map((client, index) => (
          <div
            key={client.id}
            className="flex items-center gap-4 px-3 py-3.5 rounded-xl hover:bg-accent/[0.04] transition-all duration-200 group"
          >
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white ${
              index === 0 ? "bg-gradient-to-br from-blue-500 to-blue-700" :
              index === 1 ? "bg-gradient-to-br from-blue-400 to-blue-600" :
              "bg-gradient-to-br from-slate-400 to-slate-600"
            }`}>
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground truncate">
                {client.name}
              </p>
              {client.notes && (
                <p className="text-[11px] text-muted mt-0.5 truncate">
                  {client.notes}
                </p>
              )}
            </div>
            <span className="inline-flex items-center justify-center min-w-[36px] h-8 bg-accent/10 text-accent rounded-lg text-[13px] font-bold px-2">
              {client.bultos_count}
            </span>
            <Link
              href={`/clientes/${client.id}`}
              className="w-8 h-8 flex items-center justify-center text-muted hover:text-accent hover:bg-accent/10 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
            >
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ))}
        {clients.length === 0 && (
          <div className="text-center py-10 text-sm text-muted">
            No hay clientes con bultos almacenados
          </div>
        )}
      </div>
    </div>
  );
}
