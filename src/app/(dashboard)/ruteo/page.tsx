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
import type { Bulto, Client } from "@/lib/types/database";

interface BultoWithClient extends Bulto {
  clientName: string;
}

export default function RuteoPage() {
  const [bultos, setBultos] = useState<BultoWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [routeItems, setRouteItems] = useState<BultoWithClient[]>([]);
  const [showPrint, setShowPrint] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [bultosRes, clientsRes] = await Promise.all([
        supabase
          .from("bultos")
          .select("*")
          .is("deleted_at", null)
          .order("destination_locality", { ascending: true }),
        supabase
          .from("clients")
          .select("id, name, nombre_fantasia")
          .is("deleted_at", null),
      ]);

      const bultosData: Bulto[] = bultosRes.data ?? [];
      const clientsData: Pick<Client, "id" | "name" | "nombre_fantasia">[] = clientsRes.data ?? [];

      const clientMap = new Map(clientsData.map((c) => [c.id, c.nombre_fantasia || c.name]));

      const merged: BultoWithClient[] = bultosData.map((b) => ({
        ...b,
        clientName: clientMap.get(b.client_id) ?? "Sin cliente",
      }));

      setBultos(merged);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered bultos based on search
  const filteredBultos = useMemo(() => {
    if (!searchQuery.trim()) return bultos;
    const q = searchQuery.toLowerCase();
    return bultos.filter(
      (b) =>
        b.clientName.toLowerCase().includes(q) ||
        (b.destination_address ?? "").toLowerCase().includes(q) ||
        (b.destination_locality ?? "").toLowerCase().includes(q) ||
        (b.tracking_id ?? "").toLowerCase().includes(q)
    );
  }, [bultos, searchQuery]);

  // Select all visible
  const allVisibleSelected =
    filteredBultos.length > 0 &&
    filteredBultos.every((b) => selectedIds.has(b.id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filteredBultos.forEach((b) => next.delete(b.id));
      } else {
        filteredBultos.forEach((b) => next.add(b.id));
      }
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Build route from selected items, grouped by locality
  const buildRoute = () => {
    const selected = bultos.filter((b) => selectedIds.has(b.id));
    // Sort by locality then by client name
    selected.sort((a, b) => {
      const locA = (a.destination_locality ?? "").toLowerCase();
      const locB = (b.destination_locality ?? "").toLowerCase();
      if (locA !== locB) return locA.localeCompare(locB);
      return a.clientName.localeCompare(b.clientName);
    });
    setRouteItems(selected);
  };

  // Move item in route
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
    const addresses = routeItems
      .map((item) => {
        const parts = [item.destination_address, item.destination_locality].filter(Boolean);
        return parts.join(", ");
      })
      .filter((a) => a.length > 0)
      .map((a) => encodeURIComponent(a));
    return `https://www.google.com/maps/dir/${addresses.join("/")}`;
  }, [routeItems]);

  // Group route items by locality
  const groupedRouteItems = useMemo(() => {
    const groups: Record<string, BultoWithClient[]> = {};
    routeItems.forEach((item) => {
      const loc = item.destination_locality ?? "Sin localidad";
      if (!groups[loc]) groups[loc] = [];
      groups[loc].push(item);
    });
    return groups;
  }, [routeItems]);

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
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="p-2 text-left w-8">#</th>
              <th className="p-2 text-left">Cliente</th>
              <th className="p-2 text-left">Dirección</th>
              <th className="p-2 text-left">Localidad</th>
              <th className="p-2 text-left">Tracking</th>
              <th className="p-2 text-center w-24">Entregado</th>
            </tr>
          </thead>
          <tbody>
            {routeItems.map((item, idx) => (
              <tr key={item.id} className="border-b border-gray-300">
                <td className="p-2 font-medium">{idx + 1}</td>
                <td className="p-2">{item.clientName}</td>
                <td className="p-2">{item.destination_address ?? "-"}</td>
                <td className="p-2">{item.destination_locality ?? "-"}</td>
                <td className="p-2 font-mono text-xs">{item.tracking_id ?? "-"}</td>
                <td className="p-2 text-center">
                  <div className="w-5 h-5 border-2 border-black inline-block" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-12 flex justify-between items-end">
          <div>
            <p className="text-sm text-gray-500">Total de bultos: {routeItems.length}</p>
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
            Bultos disponibles para ruta
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
            placeholder="Buscar por cliente, dirección o tracking..."
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
          <div className="text-center py-8 text-muted">Cargando bultos...</div>
        ) : filteredBultos.length === 0 ? (
          <div className="text-center py-8 text-muted">
            No hay bultos disponibles para entrega.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-muted">
                  <th className="p-2 text-left w-10">
                    <button onClick={toggleSelectAll} className="flex items-center">
                      <CheckSquare
                        className={`w-4 h-4 ${
                          allVisibleSelected ? "text-accent" : "text-muted"
                        }`}
                      />
                    </button>
                  </th>
                  <th className="p-2 text-left">Tracking</th>
                  <th className="p-2 text-left">Cliente</th>
                  <th className="p-2 text-left hidden md:table-cell">Dirección</th>
                  <th className="p-2 text-left hidden sm:table-cell">Localidad</th>
                  <th className="p-2 text-left">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredBultos.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => toggleSelect(b.id)}
                    className={`border-b border-card-border cursor-pointer transition-colors ${
                      selectedIds.has(b.id)
                        ? "bg-accent/10"
                        : "hover:bg-card"
                    }`}
                  >
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(b.id)}
                        onChange={() => toggleSelect(b.id)}
                        className="accent-accent"
                      />
                    </td>
                    <td className="p-2 font-mono text-xs text-foreground">
                      {b.tracking_id ?? "-"}
                    </td>
                    <td className="p-2 text-foreground font-medium">{b.clientName}</td>
                    <td className="p-2 text-muted hidden md:table-cell">
                      {b.destination_address ?? "-"}
                    </td>
                    <td className="p-2 text-muted hidden sm:table-cell">
                      {b.destination_locality ?? "-"}
                    </td>
                    <td className="p-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          b.status === "scheduled_return"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-blue-500/20 text-blue-400"
                        }`}
                      >
                        {b.status === "scheduled_return" ? "Programado" : "Almacenado"}
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
              Armar ruta ({selectedIds.size} bulto{selectedIds.size !== 1 ? "s" : ""})
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

          {/* Grouped by locality */}
          {Object.entries(groupedRouteItems).map(([locality, items]) => (
            <div key={locality} className="space-y-1">
              <h3 className="text-sm font-semibold text-accent flex items-center gap-1.5 mt-3 mb-1">
                <MapPin className="w-3.5 h-3.5" />
                {locality}
              </h3>
              {items.map((item) => {
                const globalIndex = routeItems.indexOf(item);
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 p-2 bg-background rounded-lg border border-card-border"
                  >
                    <span className="text-xs text-muted font-mono w-6 text-center shrink-0">
                      {globalIndex + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.clientName}
                      </p>
                      <p className="text-xs text-muted truncate">
                        {item.destination_address ?? "Sin dirección"} &middot;{" "}
                        <span className="font-mono">{item.tracking_id ?? "-"}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => moveItem(globalIndex, "up")}
                        disabled={globalIndex === 0}
                        className="p-1 rounded hover:bg-card disabled:opacity-30 text-muted"
                        title="Mover arriba"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveItem(globalIndex, "down")}
                        disabled={globalIndex === routeItems.length - 1}
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
                );
              })}
            </div>
          ))}

          <p className="text-xs text-muted pt-2">
            Total: {routeItems.length} parada{routeItems.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
