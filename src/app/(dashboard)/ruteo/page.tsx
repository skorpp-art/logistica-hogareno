"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Package,
  MapPin,
  Printer,
  Navigation,
  CheckSquare,
  Search,
  ArrowUp,
  ArrowDown,
  X,
  Truck,
  TrendingUp,
} from "lucide-react";

interface ClientRoute {
  id: string;
  name: string;
  nombre_fantasia: string | null;
  address: string;
  bultos_count: number;
}

export default function RuteoPage() {
  const [clients, setClients] = useState<ClientRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [routeItems, setRouteItems] = useState<ClientRoute[]>([]);
  const [showPrint, setShowPrint] = useState(false);

  // Prediction state
  const [predTotalRoutes, setPredTotalRoutes] = useState(55);
  const [predTarget, setPredTarget] = useState(30);
  const [predTolerance, setPredTolerance] = useState(5);
  const [predCurrentDrivers, setPredCurrentDrivers] = useState(2);

  const supabase = useMemo(() => createClient(), []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [clientsRes, bultosRes] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name, nombre_fantasia, address")
          .is("deleted_at", null)
          .order("nombre_fantasia", { ascending: true }),
        supabase
          .from("bultos")
          .select("client_id")
          .is("deleted_at", null),
      ]);

      const clientsData = clientsRes.data ?? [];
      const bultosData = bultosRes.data ?? [];

      // Count bultos per client
      const countMap: Record<string, number> = {};
      bultosData.forEach((b: { client_id: string }) => {
        countMap[b.client_id] = (countMap[b.client_id] || 0) + 1;
      });

      // Only show clients that have at least 1 bulto
      const clientsWithBultos: ClientRoute[] = clientsData
        .filter((c) => countMap[c.id] > 0)
        .map((c) => ({
          id: c.id,
          name: c.name,
          nombre_fantasia: c.nombre_fantasia,
          address: c.address || "",
          bultos_count: countMap[c.id],
        }));

      setClients(clientsWithBultos);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const displayName = (c: ClientRoute) => c.nombre_fantasia || c.name;

  // Filtered clients based on search
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.nombre_fantasia ?? "").toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
    );
  }, [clients, searchQuery]);

  const allVisibleSelected =
    filteredClients.length > 0 &&
    filteredClients.every((c) => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filteredClients.forEach((c) => next.delete(c.id));
      } else {
        filteredClients.forEach((c) => next.add(c.id));
      }
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const buildRoute = () => {
    const selected = clients.filter((c) => selectedIds.has(c.id));
    selected.sort((a, b) => {
      const addrA = a.address.toLowerCase();
      const addrB = b.address.toLowerCase();
      if (addrA !== addrB) return addrA.localeCompare(addrB);
      return displayName(a).localeCompare(displayName(b));
    });
    setRouteItems(selected);
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    const newItems = [...routeItems];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    setRouteItems(newItems);
  };

  const removeFromRoute = (id: string) => {
    setRouteItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Google Maps multi-stop URL
  const googleMapsUrl = useMemo(() => {
    if (routeItems.length === 0) return "";
    const origin = encodeURIComponent("Córdoba 999, Morón, Provincia de Buenos Aires");
    const addresses = routeItems
      .map((c) => c.address)
      .filter((a) => a.length > 0)
      .map((a) => encodeURIComponent(a));
    return `https://www.google.com/maps/dir/${origin}/${addresses.join("/")}`;
  }, [routeItems]);

  const totalBultosInRoute = routeItems.reduce((sum, c) => sum + c.bultos_count, 0);

  const todayStr = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Prediction computed values
  const predSafe = Math.max(1, predCurrentDrivers);
  const predAvg = predTotalRoutes / predSafe;
  const predNeeded = Math.ceil(predTotalRoutes / Math.max(1, predTarget));
  const predDiff = predNeeded - predSafe;
  const bUC = predTarget + predTolerance * 2;
  const bUW = predTarget + predTolerance;
  const bLW = predTarget - predTolerance;
  const bLC = Math.max(0, predTarget - predTolerance * 2);
  const predZone =
    predAvg > bUC || predAvg < bLC ? "critical" : predAvg > bUW || predAvg < bLW ? "warning" : "optimal";

  // SVG chart constants
  const SL = 58, SR = 635, ST = 18, SB = 265;
  const svgMaxN = Math.max(predSafe + 3, 6);
  const svgMaxY = Math.max(60, predTotalRoutes + 5);
  const xS = (n: number) => SL + ((n - 1) / (svgMaxN - 1)) * (SR - SL);
  const yS = (v: number) => Math.max(ST, Math.min(SB, SB - (Math.min(v, svgMaxY) / svgMaxY) * (SB - ST)));
  const curvePts: string[] = [];
  for (let n = 1; n <= svgMaxN; n += 0.06) {
    curvePts.push(`${xS(n).toFixed(1)},${yS(predTotalRoutes / n).toFixed(1)}`);
  }
  const curvePath = `M ${curvePts.join(" L ")}`;
  const svgBands = [
    { y1: bUC, y2: svgMaxY, fill: "rgba(239,68,68,0.10)" },
    { y1: bUW, y2: bUC, fill: "rgba(245,158,11,0.13)" },
    { y1: bLW, y2: bUW, fill: "rgba(34,197,94,0.10)" },
    { y1: bLC, y2: bLW, fill: "rgba(245,158,11,0.13)" },
    { y1: 0, y2: bLC, fill: "rgba(239,68,68,0.10)" },
  ];
  const yTicks = Array.from(new Set([0, 10, 20, bLC, bLW, predTarget, bUW, bUC, 50].filter((v) => v >= 0 && v <= svgMaxY)));
  yTicks.sort((a, b) => a - b);

  // Print view
  if (showPrint) {
    return (
      <div className="min-h-screen bg-white text-black p-8 print:p-4">
        <style>{`
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
          }
        `}</style>

        <div className="no-print flex gap-2 mb-6">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
          <button
            onClick={() => setShowPrint(false)}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Volver
          </button>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold uppercase tracking-wide">
            LOGISTICA HOGAREÑO - HOJA DE RUTA
          </h1>
          <p className="text-sm text-gray-600 mt-1 capitalize">{todayStr}</p>
          <p className="text-xs text-gray-500 mt-1">Punto de partida: Córdoba 999, Morón, Provincia de Buenos Aires</p>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="p-2 text-left w-8">#</th>
              <th className="p-2 text-left">Cliente</th>
              <th className="p-2 text-left">Dirección</th>
              <th className="p-2 text-center">Bultos</th>
              <th className="p-2 text-center w-24">Entregado</th>
            </tr>
          </thead>
          <tbody>
            {routeItems.map((item, idx) => (
              <tr key={item.id} className="border-b border-gray-300">
                <td className="p-2 font-medium">{idx + 1}</td>
                <td className="p-2 font-medium">{displayName(item)}</td>
                <td className="p-2">{item.address || "-"}</td>
                <td className="p-2 text-center font-bold">{item.bultos_count}</td>
                <td className="p-2 text-center">
                  <div className="w-5 h-5 border-2 border-black inline-block" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-12 flex justify-between items-end">
          <div>
            <p className="text-sm text-gray-500">Total: {routeItems.length} clientes — {totalBultosInRoute} bultos</p>
          </div>
          <div className="text-center">
            <div className="w-64 border-t-2 border-black mt-16 pt-1">
              <p className="text-sm">Firma del chofer</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Truck className="w-7 h-7 text-accent" />
        <h1 className="text-2xl font-bold text-foreground">Ruteo de entregas</h1>
      </div>

      {/* Prediction Section */}
      <div className="card-base p-5 space-y-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-semibold text-foreground">Predicción de Choferes</h2>
        </div>

        {/* Config inputs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Recorridos totales", value: predTotalRoutes, set: setPredTotalRoutes },
            { label: "Objetivo (prom./chofer)", value: predTarget, set: setPredTarget },
            { label: "Tolerancia (±)", value: predTolerance, set: setPredTolerance },
            { label: "Choferes actuales", value: predCurrentDrivers, set: setPredCurrentDrivers },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className="block text-xs text-muted font-semibold mb-1 uppercase tracking-wide">{label}</label>
              <input
                type="number"
                min={1}
                value={value}
                onChange={(e) => set(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
          ))}
        </div>

        {/* Result cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className={`p-4 rounded-xl text-center border ${predZone === "optimal" ? "bg-emerald-500/10 border-emerald-500/20" : predZone === "warning" ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20"}`}>
            <p className={`text-3xl font-extrabold tracking-tight ${predZone === "optimal" ? "text-emerald-400" : predZone === "warning" ? "text-amber-400" : "text-red-400"}`}>
              {predAvg.toFixed(1)}
            </p>
            <p className="text-[10px] text-muted font-bold mt-1 uppercase tracking-wider">Promedio actual</p>
            <p className={`text-[11px] mt-1.5 font-semibold ${predZone === "optimal" ? "text-emerald-400" : predZone === "warning" ? "text-amber-400" : "text-red-400"}`}>
              {predZone === "optimal" ? "✓ Zona óptima" : predZone === "warning" ? "⚠ Zona de alerta" : "✗ Zona crítica"}
            </p>
          </div>
          <div className="p-4 rounded-xl text-center bg-blue-500/10 border border-blue-500/20">
            <p className="text-3xl font-extrabold text-blue-400 tracking-tight">{predNeeded}</p>
            <p className="text-[10px] text-muted font-bold mt-1 uppercase tracking-wider">Choferes necesarios</p>
            <p className="text-[11px] mt-1.5 font-medium text-muted">para promedio de {predTarget}</p>
          </div>
          <div className={`p-4 rounded-xl text-center border ${predDiff > 0 ? "bg-amber-500/10 border-amber-500/20" : predDiff < 0 ? "bg-purple-500/10 border-purple-500/20" : "bg-emerald-500/10 border-emerald-500/20"}`}>
            <p className={`text-3xl font-extrabold tracking-tight ${predDiff > 0 ? "text-amber-400" : predDiff < 0 ? "text-purple-400" : "text-emerald-400"}`}>
              {predDiff > 0 ? `+${predDiff}` : predDiff}
            </p>
            <p className="text-[10px] text-muted font-bold mt-1 uppercase tracking-wider">Ajuste recomendado</p>
            <p className="text-[11px] mt-1.5 font-medium text-muted">
              {predDiff > 0 ? `Agregar ${predDiff} chofer${predDiff !== 1 ? "es" : ""}` : predDiff < 0 ? `Reducir ${Math.abs(predDiff)} chofer${Math.abs(predDiff) !== 1 ? "es" : ""}` : "Plantilla correcta"}
            </p>
          </div>
        </div>

        {/* Trading Bands Chart */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Análisis de Bandas — Recorridos por Chofer</p>
          <div className="w-full overflow-x-auto rounded-xl border border-card-border bg-background/50">
            <svg viewBox="0 0 680 300" className="w-full min-w-[380px]" style={{ height: "300px" }}>
              {/* Band fills */}
              {svgBands.map((band, i) => (
                <rect
                  key={i}
                  x={SL}
                  y={yS(band.y2)}
                  width={SR - SL}
                  height={Math.max(0, yS(band.y1) - yS(band.y2))}
                  fill={band.fill}
                />
              ))}

              {/* Horizontal band boundary lines */}
              {[bLC, bLW, predTarget, bUW, bUC].filter(v => v >= 0 && v <= svgMaxY).map((v) => (
                <line
                  key={v}
                  x1={SL} y1={yS(v)} x2={SR} y2={yS(v)}
                  stroke={v === predTarget ? "#60a5fa" : v === bLW || v === bUW ? "#10b981" : "#f59e0b"}
                  strokeWidth={v === predTarget ? 2 : 1}
                  strokeDasharray={v === predTarget ? "8,4" : "4,4"}
                  opacity={0.7}
                />
              ))}

              {/* Band labels on the right */}
              {[
                { v: (bUC + svgMaxY) / 2, label: "Crítica alta", color: "#f87171" },
                { v: (bUW + bUC) / 2, label: "Alerta alta", color: "#fb923c" },
                { v: (bLW + bUW) / 2, label: `Óptima ±${predTolerance}`, color: "#4ade80" },
                { v: (bLC + bLW) / 2, label: "Alerta baja", color: "#fb923c" },
              ].filter(({ v }) => v >= 0 && v <= svgMaxY).map(({ v, label, color }) => (
                <text key={label} x={SR + 4} y={yS(v) + 4} fontSize="9" fill={color} opacity={0.8}>{label}</text>
              ))}

              {/* Curve */}
              <path d={curvePath} fill="none" stroke="#a78bfa" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

              {/* Current driver vertical line */}
              <line
                x1={xS(predSafe)} y1={ST} x2={xS(predSafe)} y2={SB}
                stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="5,3" opacity={0.5}
              />

              {/* Current driver dot */}
              <circle cx={xS(predSafe)} cy={yS(predAvg)} r={7} fill="#60a5fa" stroke="#1e293b" strokeWidth={2.5} />
              <text
                x={xS(predSafe) + (xS(predSafe) > SR - 80 ? -10 : 10)}
                y={yS(predAvg) - 10}
                textAnchor={xS(predSafe) > SR - 80 ? "end" : "start"}
                fontSize="11" fill="#60a5fa" fontWeight="bold"
              >
                {predAvg.toFixed(1)} rec/chofer
              </text>

              {/* Axes */}
              <line x1={SL} y1={SB} x2={SR} y2={SB} stroke="#334155" strokeWidth={1} />
              <line x1={SL} y1={ST} x2={SL} y2={SB} stroke="#334155" strokeWidth={1} />

              {/* X axis ticks & labels */}
              {Array.from({ length: svgMaxN }, (_, i) => i + 1).map((n) => (
                <g key={n}>
                  <line x1={xS(n)} y1={SB} x2={xS(n)} y2={SB + 5} stroke="#475569" strokeWidth={1} />
                  <text x={xS(n)} y={SB + 16} textAnchor="middle" fontSize="11" fill="#64748b">{n}</text>
                  {n === predSafe && (
                    <text x={xS(n)} y={SB + 28} textAnchor="middle" fontSize="9" fill="#60a5fa" fontWeight="bold">actual</text>
                  )}
                  {n === predNeeded && n !== predSafe && (
                    <text x={xS(n)} y={SB + 28} textAnchor="middle" fontSize="9" fill="#4ade80" fontWeight="bold">ideal</text>
                  )}
                </g>
              ))}

              {/* Y axis ticks & labels */}
              {yTicks.map((v) => (
                <g key={v}>
                  <line x1={SL - 5} y1={yS(v)} x2={SL} y2={yS(v)} stroke="#475569" strokeWidth={1} />
                  <text x={SL - 8} y={yS(v) + 4} textAnchor="end" fontSize="10" fill="#64748b">{v}</text>
                </g>
              ))}

              {/* Axis labels */}
              <text x={(SL + SR) / 2} y={293} textAnchor="middle" fontSize="11" fill="#475569">Cantidad de Choferes</text>
              <text
                x={14}
                y={(ST + SB) / 2}
                textAnchor="middle"
                fontSize="11"
                fill="#475569"
                transform={`rotate(-90,14,${(ST + SB) / 2})`}
              >Prom. Recorridos</text>

              {/* Target label */}
              <text x={SL + 6} y={yS(predTarget) - 4} fontSize="10" fill="#60a5fa" opacity={0.9}>Objetivo: {predTarget}</text>
            </svg>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-[11px]">
            {[
              { color: "bg-emerald-500/30", label: `Zona óptima (${bLW}–${bUW} rec/chofer)` },
              { color: "bg-amber-500/30", label: `Alerta (${bLC}–${bLW} / ${bUW}–${bUC})` },
              { color: "bg-red-500/30", label: `Crítica (<${bLC} / >${bUC})` },
              { color: "bg-blue-400 rounded-full", label: "Situación actual", dot: true },
            ].map(({ color, label, dot }) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className={`${dot ? "w-3 h-3" : "w-4 h-3"} ${color} rounded-sm inline-block shrink-0`} />
                <span className="text-muted">{label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Selection section */}
      <div className="card-base p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Package className="w-5 h-5" />
            Clientes con paquetes
          </h2>
          <span className="text-sm text-muted">
            {selectedIds.size} seleccionado{selectedIds.size !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Buscar por cliente o dirección..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-card-border rounded-lg text-foreground placeholder:text-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-muted" />
            </button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-8 text-muted">Cargando clientes...</div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-8 text-muted">
            No hay clientes con paquetes.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-muted">
                  <th className="p-2 text-left w-10">
                    <button onClick={toggleSelectAll} className="flex items-center">
                      <CheckSquare
                        className={`w-4 h-4 ${allVisibleSelected ? "text-accent" : "text-muted"}`}
                      />
                    </button>
                  </th>
                  <th className="p-2 text-left">Cliente</th>
                  <th className="p-2 text-left hidden md:table-cell">Dirección</th>
                  <th className="p-2 text-center">Bultos</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => toggleSelect(c.id)}
                    className={`border-b border-card-border cursor-pointer transition-colors ${
                      selectedIds.has(c.id) ? "bg-accent/10" : "hover:bg-card"
                    }`}
                  >
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="accent-accent"
                      />
                    </td>
                    <td className="p-2 text-foreground font-medium">{displayName(c)}</td>
                    <td className="p-2 text-muted hidden md:table-cell">{c.address || "-"}</td>
                    <td className="p-2 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold">
                        {c.bultos_count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Build route button */}
        {selectedIds.size > 0 && (
          <div className="flex justify-end">
            <button
              onClick={buildRoute}
              className="px-4 py-2 bg-accent text-white rounded-lg font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              <Navigation className="w-4 h-4" />
              Armar ruta ({selectedIds.size} cliente{selectedIds.size !== 1 ? "s" : ""})
            </button>
          </div>
        )}
      </div>

      {/* Route section */}
      {routeItems.length > 0 && (
        <div className="card-base p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <MapPin className="w-5 h-5 text-accent" />
              Ruta del día
            </h2>
            <div className="flex gap-2 flex-wrap">
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
              >
                <Navigation className="w-4 h-4" />
                Abrir en Google Maps
              </a>
              <button
                onClick={() => setShowPrint(true)}
                className="px-3 py-1.5 bg-card border border-card-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
              >
                <Printer className="w-4 h-4" />
                Imprimir hoja de ruta
              </button>
            </div>
          </div>

          {routeItems.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center gap-2 p-3 bg-background rounded-lg border border-card-border"
            >
              <span className="text-sm text-muted font-bold w-7 text-center shrink-0">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {displayName(item)}
                </p>
                <p className="text-xs text-muted truncate flex items-center gap-1">
                  <MapPin className="w-3 h-3 shrink-0" />
                  {item.address || "Sin dirección"}
                </p>
              </div>
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold shrink-0">
                {item.bultos_count}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => moveItem(index, "up")}
                  disabled={index === 0}
                  className="p-1 rounded hover:bg-card disabled:opacity-30 text-muted"
                  title="Mover arriba"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveItem(index, "down")}
                  disabled={index === routeItems.length - 1}
                  className="p-1 rounded hover:bg-card disabled:opacity-30 text-muted"
                  title="Mover abajo"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeFromRoute(item.id)}
                  className="p-1 rounded hover:bg-red-500/20 text-red-400"
                  title="Quitar de la ruta"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          <p className="text-xs text-muted pt-2">
            Total: {routeItems.length} parada{routeItems.length !== 1 ? "s" : ""} — {totalBultosInRoute} bultos
          </p>
        </div>
      )}
    </div>
  );
}
