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
  Download,
} from "lucide-react";

interface ReturnedBulto {
  id: string;
  client_id: string;
  description: string | null;
  tracking_id: string | null;
  barcode: string | null;
  entry_date: string;
  actual_return_date: string | null;
  status: string;
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
  "id, client_id, description, tracking_id, barcode, entry_date, actual_return_date, status, remito_number, destination_address, destination_locality, clients(name, nombre_fantasia)";

const STATUS_LABELS: Record<string, string> = {
  stored: "ALMACENADO",
  scheduled_return: "RETORNO PROG.",
  returned: "DEVUELTO",
  cancelled: "CANCELADO",
  duplicate: "DUPLICADO",
  cambio: "CAMBIO",
  devolucion: "DEVOLUCIÓN",
  rechazado: "RECHAZADO",
  ficha: "FICHA",
};

// Reimprime el remito de una devolución existente (solo abre ventana de impresión)
function printRemito(r: Remito) {
  const win = window.open("", "_blank");
  if (!win) return;

  const docLabel = r.remitoNumber != null ? String(r.remitoNumber).padStart(4, "0") : "—";
  const rows = r.bultos
    .map(
      (b) => `
      <tr>
        <td>${b.tracking_id || b.barcode || "-"}</td>
        <td>${b.description || "-"}</td>
        <td>${formatDate(b.entry_date)}</td>
        <td>${
          b.destination_address
            ? b.destination_address + (b.destination_locality ? " - " + b.destination_locality : "")
            : "-"
        }</td>
        <td class="status">${STATUS_LABELS[b.status] || b.status}</td>
      </tr>`
    )
    .join("");

  win.document.write(`
    <!DOCTYPE html><html><head><title>Remito ${docLabel} - ${r.clientName}</title>
    <style>
      @page { margin: 10mm; }
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: Arial, sans-serif; color:#111; padding:30px; }
      .header { display:flex; justify-content:space-between; align-items:start; margin-bottom:20px; border-bottom:3px solid #111; padding-bottom:15px; }
      .logo-area { display:flex; align-items:center; gap:12px; }
      .logo-box { width:40px; height:40px; border:3px solid #111; display:flex; align-items:center; justify-content:center; font-weight:bold; }
      .title { font-size:24px; font-weight:bold; }
      .subtitle { font-size:11px; color:#555; margin-top:2px; }
      .doc-info { text-align:right; font-size:12px; }
      .doc-info strong { display:block; }
      .doc-info span { display:block; margin-top:2px; }
      .client-box { background:#f3f4f6; padding:15px 20px; border-radius:6px; margin-bottom:20px; }
      .client-box .name { font-weight:bold; text-transform:uppercase; font-size:14px; }
      .client-box .meta { display:flex; justify-content:space-between; margin-top:5px; font-size:12px; color:#555; }
      table { width:100%; border-collapse:collapse; margin-bottom:30px; }
      th { background:#f9fafb; text-align:left; padding:8px 10px; font-size:11px; text-transform:uppercase; color:#555; border-bottom:2px solid #ddd; }
      td { padding:8px 10px; font-size:12px; border-bottom:1px solid #eee; word-wrap:break-word; max-width:180px; }
      .status { font-weight:bold; font-size:11px; }
      .signatures { display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px; margin-top:40px; border-top:2px solid #111; padding-top:20px; }
      .sig-box { text-align:center; padding-top:40px; border-top:1px solid #999; }
      .sig-box .role { font-weight:bold; font-size:12px; }
      .sig-box .desc { font-size:10px; color:#777; font-style:italic; }
    </style></head><body>
      <div class="header">
        <div class="logo-area">
          <div class="logo-box">LH</div>
          <div>
            <div class="title">LOGISTICA HOGARE&Ntilde;O</div>
            <div class="subtitle">FICHA DE CONTROL E INVENTARIO DE STOCK</div>
          </div>
        </div>
        <div class="doc-info">
          <strong>DOC N&deg;: ${docLabel}</strong>
          <span>FECHA: ${formatDate(r.date)}</span>
        </div>
      </div>
      <div class="client-box">
        <div class="name">${r.clientName}</div>
        <div class="meta">
          <span>TIPO DE OPERACI&Oacute;N: DEVOLUCI&Oacute;N</span>
          <span>TOTAL BULTOS: ${r.bultos.length}</span>
        </div>
      </div>
      <table>
        <thead><tr>
          <th>Tracking</th><th>Art&iacute;culo / Notas</th><th>Fecha</th><th>Destino</th><th>Estado</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="signatures">
        <div class="sig-box"><div class="role">ENCARGADO DE DEP&Oacute;SITO</div><div class="desc">Autorizaci&oacute;n de Salida</div></div>
        <div class="sig-box"><div class="role">CONDUCTOR LOG&Iacute;STICO</div><div class="desc">Verificaci&oacute;n y Carga</div></div>
        <div class="sig-box"><div class="role">CLIENTE RECEPTOR</div><div class="desc">Recibido Conforme</div></div>
      </div>
      <script>window.onload=function(){window.print();}<\/script>
    </body></html>
  `);
  win.document.close();
}

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
            {r.remitoNumber != null ? `DOC N° ${String(r.remitoNumber).padStart(4, "0")}` : "Devolución"}
          </p>
          <p className="text-[11px] text-muted flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {formatDate(r.date)}
          </p>
        </div>
        <span className="text-[11px] font-bold text-accent bg-accent/10 px-2.5 py-1 rounded-full shrink-0">
          {r.bultos.length} bulto{r.bultos.length !== 1 ? "s" : ""}
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); printRemito(r); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); printRemito(r); } }}
          title="Exportar PDF"
          className="p-1.5 rounded-lg text-muted hover:text-blue-500 hover:bg-blue-500/10 transition-all shrink-0"
        >
          <Download className="w-4 h-4" />
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
