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
