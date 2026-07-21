"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  History,
  Search,
  Package,
  Calendar,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
  User,
} from "lucide-react";

interface ReturnedBulto {
  id: string;
  client_id: string;
  description: string | null;
  tracking_id: string | null;
  barcode: string | null;
  actual_return_date: string | null;
  remito_number: number | null;
  destination_address: string | null;
  destination_locality: string | null;
  clients: { name: string; nombre_fantasia: string | null } | null;
}

// Un "remito" = una devolución (un grupo de bultos exportados juntos)
interface Remito {
  key: string;
  clientId: string;
  clientName: string;
  date: string;
  remitoNumber: number | null;
  bultos: ReturnedBulto[];
}

function formatDate(d: string | null) {
  if (!d) return "-";
  const p = d.split("-");
  return `${p[2]}/${p[1]}/${p[0]}`;
}

// Agrupa bultos devueltos en remitos (por N° de remito, o por cliente+fecha si es viejo)
function groupIntoRemitos(bultos: ReturnedBulto[]): Remito[] {
  const map = new Map<string, Remito>();
  for (const b of bultos) {
    const date = b.actual_return_date || "";
    const key =
      b.remito_number != null
        ? `r${b.remito_number}`
        : `${b.client_id}-${date}`;
    const clientName = b.clients?.nombre_fantasia
      ? `${b.clients.nombre_fantasia} (${b.clients.name})`
      : b.clients?.name || "Sin cliente";
    if (!map.has(key)) {
      map.set(key, {
        key,
        clientId: b.client_id,
        clientName,
        date,
        remitoNumber: b.remito_number,
        bultos: [],
      });
    }
    map.get(key)!.bultos.push(b);
  }
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}

const SELECT =
  "id, client_id, description, tracking_id, barcode, actual_return_date, remito_number, destination_address, destination_locality, clients(name, nombre_fantasia)";

export default function HistorialPage() {
  const [recent, setRecent] = useState<ReturnedBulto[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Búsqueda de devoluciones anteriores
  const [searchName, setSearchName] = useState("");
  const [searchFrom, setSearchFrom] = useState("");
  const [searchTo, setSearchTo] = useState("");
  const [searchResults, setSearchResults] = useState<ReturnedBulto[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Cargar devoluciones del último mes
  useEffect(() => {
    const fetchRecent = async () => {
      const supabase = createClient();
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const sinceStr = since.toISOString().split("T")[0];

      const { data } = await supabase
        .from("bultos")
        .select(SELECT)
        .eq("status", "returned")
        .gte("actual_return_date", sinceStr)
        .order("actual_return_date", { ascending: false });

      setRecent((data as unknown as ReturnedBulto[]) || []);
      setLoading(false);
    };
    fetchRecent();
  }, []);

  // Remitos del último mes agrupados por cliente
  const byClient = useMemo(() => {
    const remitos = groupIntoRemitos(recent);
    const map = new Map<string, { name: string; remitos: Remito[] }>();
    for (const r of remitos) {
      if (!map.has(r.clientId)) map.set(r.clientId, { name: r.clientName, remitos: [] });
      map.get(r.clientId)!.remitos.push(r);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.remitos[0].date.localeCompare(a.remitos[0].date)
    );
  }, [recent]);

  const handleSearch = async () => {
    if (!searchName.trim() && !searchFrom && !searchTo) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    const supabase = createClient();
    let query = supabase
      .from("bultos")
      .select(SELECT)
      .eq("status", "returned");

    if (searchFrom) query = query.gte("actual_return_date", searchFrom);
    if (searchTo) query = query.lte("actual_return_date", searchTo);

    const { data } = await query
      .order("actual_return_date", { ascending: false })
      .limit(1000);

    let results = (data as unknown as ReturnedBulto[]) || [];
    if (searchName.trim()) {
      const q = searchName.trim().toLowerCase();
      results = results.filter((b) => {
        const n = `${b.clients?.name || ""} ${b.clients?.nombre_fantasia || ""}`.toLowerCase();
        return n.includes(q);
      });
    }
    setSearchResults(results);
    setSearching(false);
  };

  const searchRemitos = useMemo(
    () => (searchResults ? groupIntoRemitos(searchResults) : []),
    [searchResults]
  );

  const RemitoCard = ({ r }: { r: Remito }) => (
    <div className="rounded-xl border border-card-border bg-background overflow-hidden">
      <button
        onClick={() => setExpanded(expanded === r.key ? null : r.key)}
        className="w-full flex items-center gap-3 p-3 hover:bg-accent/5 transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-foreground">
            {r.remitoNumber != null ? `Remito N° ${String(r.remitoNumber).padStart(4, "0")}` : "Devolución"}
          </p>
          <p className="text-[11px] text-muted flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {formatDate(r.date)}
          </p>
        </div>
        <span className="text-[11px] font-bold text-accent bg-accent/10 px-2.5 py-1 rounded-full shrink-0">
          {r.bultos.length} bulto{r.bultos.length !== 1 ? "s" : ""}
        </span>
        {expanded === r.key ? (
          <ChevronUp className="w-4 h-4 text-muted shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted shrink-0" />
        )}
      </button>
      {expanded === r.key && (
        <div className="border-t border-card-border divide-y divide-card-border/50">
          {r.bultos.map((b) => (
            <div key={b.id} className="px-4 py-2.5 flex items-start gap-3">
              <Package className="w-4 h-4 text-muted mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[12px] font-mono font-bold text-foreground">
                  {b.tracking_id || b.barcode || "-"}
                </p>
                <p className="text-[11px] text-muted truncate">
                  {b.description || "-"}
                  {b.destination_address ? ` · ${b.destination_address}` : ""}
                  {b.destination_locality ? `, ${b.destination_locality}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-8">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
          <History className="w-6 h-6 text-blue-500" />
          Historial de devoluciones
        </h1>
        <p className="text-[13px] text-muted font-medium mt-1">
          Devoluciones realizadas (remitos exportados) por cliente
        </p>
      </div>

      {/* Búsqueda de devoluciones anteriores */}
      <div className="card-base p-4 sm:p-5 animate-fade-in">
        <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-3">
          Buscar devoluciones anteriores
        </p>
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Nombre del cliente..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-background border border-card-border text-[13px] text-foreground placeholder:text-muted/40 outline-none focus:border-accent/40 transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Desde</label>
              <input
                type="date"
                value={searchFrom}
                onChange={(e) => setSearchFrom(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-background border border-card-border text-[13px] text-foreground outline-none focus:border-accent/40 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Hasta</label>
              <input
                type="date"
                value={searchTo}
                onChange={(e) => setSearchTo(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-background border border-card-border text-[13px] text-foreground outline-none focus:border-accent/40 transition-colors"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSearch}
              disabled={searching}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[13px] font-bold active:scale-[0.98] disabled:opacity-50 transition-all"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar
            </button>
            {searchResults !== null && (
              <button
                onClick={() => { setSearchResults(null); setSearchName(""); setSearchFrom(""); setSearchTo(""); }}
                className="px-4 py-2.5 rounded-xl text-[13px] font-bold text-muted hover:text-foreground hover:bg-background transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Resultados de búsqueda */}
        {searchResults !== null && (
          <div className="mt-4 pt-4 border-t border-card-border space-y-2">
            {searchRemitos.length === 0 ? (
              <p className="text-[13px] text-muted text-center py-4">
                No se encontraron devoluciones con esos criterios
              </p>
            ) : (
              <>
                <p className="text-[11px] text-muted font-semibold mb-1">
                  {searchRemitos.length} devolución{searchRemitos.length !== 1 ? "es" : ""} encontrada{searchRemitos.length !== 1 ? "s" : ""}
                </p>
                {searchRemitos.map((r) => (
                  <div key={r.key}>
                    <p className="text-[11px] font-bold text-foreground mt-2 mb-1 flex items-center gap-1">
                      <User className="w-3 h-3 text-muted" /> {r.clientName}
                    </p>
                    <RemitoCard r={r} />
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Último mes por cliente */}
      <div className="animate-fade-in">
        <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-3 px-1">
          Último mes · por cliente
        </p>

        {loading ? (
          <div className="card-base p-10 flex items-center justify-center gap-2 text-muted">
            <Loader2 className="w-5 h-5 animate-spin" /> Cargando...
          </div>
        ) : byClient.length === 0 ? (
          <div className="card-base p-10 sm:p-14 text-center">
            <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center mx-auto mb-5">
              <History className="w-10 h-10 text-blue-400" />
            </div>
            <p className="text-[15px] font-bold text-foreground mb-1">Sin devoluciones este mes</p>
            <p className="text-[13px] text-muted max-w-sm mx-auto">
              Cuando exportes un remito desde la ficha de un cliente, la devolución va a aparecer acá.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {byClient.map((c) => {
              const totalBultos = c.remitos.reduce((n, r) => n + r.bultos.length, 0);
              return (
                <div key={c.name} className="card-base p-4 sm:p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold text-foreground truncate">{c.name}</p>
                      <p className="text-[11px] text-muted">
                        {c.remitos.length} devolución{c.remitos.length !== 1 ? "es" : ""} · {totalBultos} bulto{totalBultos !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {c.remitos.map((r) => (
                      <RemitoCard key={r.key} r={r} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
