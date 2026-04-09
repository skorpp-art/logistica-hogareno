"use client";

import { Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Search, Trash2, Edit, Eye } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Client } from "@/lib/types/database";

export default function ClientesPage() {
  return (
    <Suspense fallback={<p className="text-gray-400">Cargando...</p>}>
      <ClientesContent />
    </Suspense>
  );
}

function ClientesContent() {
  const [clients, setClients] = useState<(Client & { bultos_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setSearch(q);
  }, [searchParams]);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("clients")
      .select("*, bultos(count)")
      .is("deleted_at", null)
      .order("name");

    const mapped = (data || []).map((c: Record<string, unknown>) => ({
      ...c,
      bultos_count: Array.isArray(c.bultos) && c.bultos[0]
        ? (c.bultos[0] as { count: number }).count
        : 0,
    })) as (Client & { bultos_count: number })[];

    setClients(mapped);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Mover este cliente a la papelera?")) return;
    const supabase = createClient();
    await supabase
      .from("clients")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    fetchClients();
  };

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
      (c.phone && c.phone.includes(search))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <Link
          href="/clientes/nuevo"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Cliente
        </Link>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, email o teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-6 py-3">
                Nombre
              </th>
              <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-6 py-3">
                Teléfono
              </th>
              <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-6 py-3">
                Email
              </th>
              <th className="text-center text-xs font-bold text-gray-500 uppercase tracking-wider px-6 py-3">
                Bultos
              </th>
              <th className="text-center text-xs font-bold text-gray-500 uppercase tracking-wider px-6 py-3">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-sm text-gray-400">
                  Cargando...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-sm text-gray-400">
                  No se encontraron clientes
                </td>
              </tr>
            ) : (
              filtered.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {client.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {client.phone || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {client.email || "-"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-50 text-blue-700 rounded-full text-sm font-bold">
                      {client.bultos_count}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <Link
                        href={`/clientes/${client.id}`}
                        className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <Link
                        href={`/clientes/${client.id}?edit=true`}
                        className="p-1.5 text-gray-400 hover:text-green-600 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(client.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
