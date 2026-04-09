"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Package, Plus, Calendar } from "lucide-react";
import type { Bulto, Client } from "@/lib/types/database";

type BultoWithClient = Bulto & { clients: Pick<Client, "name"> };

export default function ControlOperativoPage() {
  const [bultos, setBultos] = useState<BultoWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [clients, setClients] = useState<Pick<Client, "id" | "name">[]>([]);
  const [form, setForm] = useState({
    client_id: "",
    description: "",
    barcode: "",
    scheduled_return_date: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const supabase = createClient();
    const { data: bultosData } = await supabase
      .from("bultos")
      .select("*, clients(name)")
      .is("deleted_at", null)
      .in("status", ["stored", "scheduled_return"])
      .order("entry_date", { ascending: false });

    setBultos((bultosData as BultoWithClient[]) || []);

    const { data: clientsData } = await supabase
      .from("clients")
      .select("id, name")
      .is("deleted_at", null)
      .order("name");

    setClients(clientsData || []);
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    await supabase.from("bultos").insert({
      client_id: form.client_id,
      description: form.description || null,
      barcode: form.barcode || null,
      status: form.scheduled_return_date ? "scheduled_return" : "stored",
      entry_date: new Date().toISOString().split("T")[0],
      scheduled_return_date: form.scheduled_return_date || null,
    });
    setForm({ client_id: "", description: "", barcode: "", scheduled_return_date: "" });
    setShowForm(false);
    fetchData();
  };

  const handleMarkReturned = async (id: string) => {
    const supabase = createClient();
    await supabase
      .from("bultos")
      .update({
        status: "returned",
        actual_return_date: new Date().toISOString().split("T")[0],
      })
      .eq("id", id);
    fetchData();
  };

  const handleScheduleReturn = async (id: string) => {
    const date = prompt("Fecha de devolución (YYYY-MM-DD):");
    if (!date) return;
    const supabase = createClient();
    await supabase
      .from("bultos")
      .update({ status: "scheduled_return", scheduled_return_date: date })
      .eq("id", id);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Mover a papelera?")) return;
    const supabase = createClient();
    await supabase
      .from("bultos")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    fetchData();
  };

  const filtered =
    filter === "all"
      ? bultos
      : bultos.filter((b) => b.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Control Operativo</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Bulto
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-white rounded-xl shadow-sm p-6 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cliente *
              </label>
              <select
                required
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seleccionar...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código de barras
              </label>
              <input
                type="text"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha devolución programada
              </label>
              <input
                type="date"
                value={form.scheduled_return_date}
                onChange={(e) =>
                  setForm({ ...form, scheduled_return_date: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Agregar
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="flex gap-2">
        {[
          { key: "all", label: "Todos" },
          { key: "stored", label: "Almacenados" },
          { key: "scheduled_return", label: "Retorno programado" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              filter === f.key
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-6 py-3">
                Cliente
              </th>
              <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-6 py-3">
                Descripción
              </th>
              <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-6 py-3">
                Código
              </th>
              <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-6 py-3">
                Ingreso
              </th>
              <th className="text-center text-xs font-bold text-gray-500 uppercase tracking-wider px-6 py-3">
                Estado
              </th>
              <th className="text-center text-xs font-bold text-gray-500 uppercase tracking-wider px-6 py-3">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-sm text-gray-400">
                  Cargando...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-sm text-gray-400">
                  No hay bultos
                </td>
              </tr>
            ) : (
              filtered.map((bulto) => (
                <tr key={bulto.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {bulto.clients?.name || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {bulto.description || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                    {bulto.barcode || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {bulto.entry_date}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded-full ${
                        bulto.status === "stored"
                          ? "bg-green-50 text-green-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {bulto.status === "stored"
                        ? "Almacenado"
                        : "Retorno prog."}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleMarkReturned(bulto.id)}
                        className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors"
                        title="Marcar devuelto"
                      >
                        Devolver
                      </button>
                      {bulto.status === "stored" && (
                        <button
                          onClick={() => handleScheduleReturn(bulto.id)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Programar retorno"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(bulto.id)}
                        className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
                      >
                        Eliminar
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
