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
    await supabase.from(table).update({ deleted_at: null }).eq("id", item.id);
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
        <h1 className="text-2xl font-bold text-gray-900">Papelera</h1>
        <span className="px-2 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-full">
          {items.length}
        </span>
      </div>

      {loading ? (
        <p className="text-gray-400">Cargando...</p>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Trash2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">La papelera está vacía</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
          {items.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-400">
                  Eliminado: {new Date(item.deleted_at).toLocaleDateString("es-AR")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRestore(item)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restaurar
                </button>
                <button
                  onClick={() => handlePermanentDelete(item)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors font-medium"
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
