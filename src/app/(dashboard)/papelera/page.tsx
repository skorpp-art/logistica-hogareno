"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Trash2, RotateCcw, AlertTriangle } from "lucide-react";

interface DeletedItem {
  id: string;
  type: "client" | "bulto";
  name: string;
  deleted_at: string;
}

export default function PapeleraPage() {
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    const supabase = createClient();

    const { data: clients } = await supabase
      .from("clients")
      .select("id, name, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });

    const { data: bultos } = await supabase
      .from("bultos")
      .select("id, description, barcode, deleted_at, clients(name)")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });

    const all: DeletedItem[] = [
      ...(clients || []).map((c: { id: string; name: string; deleted_at: string }) => ({
        id: c.id,
        type: "client" as const,
        name: `Cliente: ${c.name}`,
        deleted_at: c.deleted_at,
      })),
      ...(bultos || []).map(
        (b: Record<string, unknown>) => {
          const c = b.clients;
          const clientName = Array.isArray(c) && c[0] ? c[0].name : (c && typeof c === "object" && c !== null && "name" in c ? (c as { name: string }).name : "?");
          return {
            id: b.id as string,
            type: "bulto" as const,
            name: `Bulto: ${b.description || b.barcode || "Sin descripción"} (${clientName})`,
            deleted_at: b.deleted_at as string,
          };
        }
      ),
    ].sort(
      (a, b) =>
        new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime()
    );

    setItems(all);
    setLoading(false);
  };

  const handleRestore = async (item: DeletedItem) => {
    const supabase = createClient();
    const table = item.type === "client" ? "clients" : "bultos";
    const updates: Record<string, unknown> = { deleted_at: null };
    if (item.type === "bulto") updates.status = "stored";
    await supabase.from(table).update(updates).eq("id", item.id);
    fetchItems();
  };

  const handlePermanentDelete = async (item: DeletedItem) => {
    if (!confirm("¿Eliminar permanentemente? Esta acción no se puede deshacer."))
      return;
    const supabase = createClient();
    const table = item.type === "client" ? "clients" : "bultos";
    await supabase.from(table).delete().eq("id", item.id);
    fetchItems();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">Papelera</h1>
        <span className="px-2 py-1 bg-red-500/15 text-red-400 text-xs font-bold rounded-full">
          {items.length}
        </span>
      </div>

      {loading ? (
        <p className="text-muted">Cargando...</p>
      ) : items.length === 0 ? (
        <div className="bg-card rounded-2xl shadow-sm border border-card-border p-12 text-center">
          <Trash2 className="w-12 h-12 text-muted mx-auto mb-3" />
          <p className="text-muted">La papelera está vacía</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl shadow-sm border border-card-border divide-y divide-card-border animate-fade-in">
          {items.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-accent/5 transition-colors duration-200"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{item.name}</p>
                <p className="text-xs text-muted">
                  Eliminado: {new Date(item.deleted_at).toLocaleDateString("es-AR")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRestore(item)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-all duration-200 font-medium"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restaurar
                </button>
                <button
                  onClick={() => handlePermanentDelete(item)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all duration-200 font-medium"
                >
                  <AlertTriangle className="w-3 h-3" />
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
