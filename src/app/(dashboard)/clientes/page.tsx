"use client";

import { Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Plus,
  Search,
  Trash2,
  Edit,
  FileText,
  MapPin,
  Package,
  ArrowRight,
  X,
} from "lucide-react";
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
  const [clients, setClients] = useState<(Client & { bultos_count: number })[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState({
    name: "",
    nombre_fantasia: "",
    address: "",
    phone: "",
    email: "",
  });
  const [saving, setSaving] = useState(false);
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
      bultos_count:
        Array.isArray(c.bultos) && c.bultos[0]
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

  const openNew = () => {
    setEditingClient(null);
    setForm({ name: "", nombre_fantasia: "", address: "", phone: "", email: "" });
    setShowModal(true);
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setForm({
      name: client.name,
      nombre_fantasia: client.nombre_fantasia || "",
      address: client.address || "",
      phone: client.phone || "",
      email: client.email || "",
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();

    const payload = {
      name: form.name,
      nombre_fantasia: form.nombre_fantasia || null,
      address: form.address || null,
      phone: form.phone || null,
      email: form.email || null,
    };

    if (editingClient) {
      await supabase
        .from("clients")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editingClient.id);
    } else {
      await supabase.from("clients").insert(payload);
    }

    setSaving(false);
    setShowModal(false);
    fetchClients();
  };

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.nombre_fantasia &&
        c.nombre_fantasia.toLowerCase().includes(search.toLowerCase())) ||
      (c.address && c.address.toLowerCase().includes(search.toLowerCase()))
  );

  // Check if client has stock > 7 days
  const hasAlert = (c: Client & { bultos_count: number }) => {
    return c.bultos_count > 0; // we'll check in detail page
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Clientes Registrados
          </h1>
          <p className="text-sm text-gray-400">
            Gestión de cuentas y acceso a stock individual
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nuevo Cliente
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, fantasía o dirección..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Cards Grid */}
      {loading ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No se encontraron clientes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client) => (
            <div
              key={client.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow relative"
            >
              {/* Top row: icon + actions */}
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex items-center gap-3">
                  {/* Bultos badge */}
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full ${
                      client.bultos_count > 0
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {client.bultos_count}{" "}
                    {client.bultos_count === 1 ? "BULTO" : "BULTOS"}
                  </span>
                  <button
                    onClick={() => openEdit(client)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(client.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Client info */}
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                {client.name}
              </h3>
              {client.nombre_fantasia && (
                <p className="text-xs text-gray-500 font-medium mt-0.5 uppercase">
                  {client.nombre_fantasia}
                </p>
              )}
              {client.address && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
                  <MapPin className="w-3 h-3" />
                  {client.address}
                </div>
              )}

              {/* Bottom action */}
              <Link
                href={`/clientes/${client.id}`}
                className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" />
                  GESTIONAR STOCK
                </div>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-700" />
                <h2 className="text-lg font-bold text-gray-900">
                  {editingClient
                    ? "Editar Cliente"
                    : "Ficha de Nuevo Cliente"}
                </h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Razón Social
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Logística Nacional S.A."
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Nombre Fantasía
                </label>
                <input
                  type="text"
                  value={form.nombre_fantasia}
                  onChange={(e) =>
                    setForm({ ...form, nombre_fantasia: e.target.value })
                  }
                  placeholder="Ej: Tienda Express"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Domicilio / Planta
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  placeholder="Calle, Número, Localidad"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    placeholder="Teléfono"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    placeholder="Email"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {saving
                    ? "Guardando..."
                    : editingClient
                    ? "Guardar Cambios"
                    : "Guardar Cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
