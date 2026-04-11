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
    <Suspense fallback={<p className="text-muted">Cargando...</p>}>
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
  const [filterBy, setFilterBy] = useState<"all" | "with_bultos" | "no_bultos" | "alphabetical">("all");
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setSearch(q);
    const filtro = searchParams.get("filtro");
    if (filtro === "con_paquetes") setFilterBy("with_bultos");
  }, [searchParams]);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("clients")
      .select("*")
      .is("deleted_at", null)
      .order("name");

    // Count active bultos per client (not deleted)
    const { data: bultoCounts } = await supabase
      .from("bultos")
      .select("client_id")
      .is("deleted_at", null);

    const countMap: Record<string, number> = {};
    (bultoCounts || []).forEach((b: { client_id: string }) => {
      countMap[b.client_id] = (countMap[b.client_id] || 0) + 1;
    });

    const mapped = (data || []).map((c: Record<string, unknown>) => ({
      ...c,
      bultos_count: countMap[c.id as string] || 0,
    })) as (Client & { bultos_count: number })[];

    // Sort by nombre_fantasia alphabetically (fallback to name)
    mapped.sort((a, b) => {
      const nameA = (a.nombre_fantasia || a.name || "").toLowerCase();
      const nameB = (b.nombre_fantasia || b.name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

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

  const filtered = clients
    .filter((c) => {
      // Text search
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.nombre_fantasia && c.nombre_fantasia.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q));
      if (!matchesSearch) return false;

      // Filter
      if (filterBy === "with_bultos") return c.bultos_count > 0;
      if (filterBy === "no_bultos") return c.bultos_count === 0;
      return true;
    })
    .sort((a, b) => {
      if (filterBy === "with_bultos") {
        // Sort by most bultos first
        return b.bultos_count - a.bultos_count;
      }
      // Default: alphabetical by nombre_fantasia
      const nameA = (a.nombre_fantasia || a.name || "").toLowerCase();
      const nameB = (b.nombre_fantasia || b.name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Clientes Registrados
          </h1>
          <p className="text-sm text-muted">
            Gestión de cuentas y acceso a stock individual
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 shadow-lg shadow-blue-600/25 transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          Nuevo Cliente
        </button>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Buscar por nombre, fantasía o dirección..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2.5 text-sm border border-card-border rounded-xl w-full bg-background text-foreground focus:ring-2 focus:ring-accent/40 focus:border-accent/40"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: "all" as const, label: "Todos" },
            { key: "with_bultos" as const, label: "Con paquetes" },
            { key: "no_bultos" as const, label: "Sin paquetes" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterBy(f.key)}
              className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all duration-200 ${
                filterBy === f.key
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                  : "bg-accent/10 text-muted hover:bg-accent/20 hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="flex items-center text-xs text-muted ml-2">
            {filtered.length} cliente{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <p className="text-muted text-sm">Cargando...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-2xl shadow-sm border border-card-border p-12 text-center">
          <FileText className="w-12 h-12 text-muted mx-auto mb-3" />
          <p className="text-muted">No se encontraron clientes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
          {filtered.map((client) => (
            <div
              key={client.id}
              className="bg-card rounded-2xl border border-card-border shadow-sm p-5 hover:shadow-md transition-shadow relative"
            >
              {/* Top row: icon + actions */}
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-muted" />
                </div>
                <div className="flex items-center gap-3">
                  {/* Bultos badge */}
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full ${
                      client.bultos_count > 0
                        ? "bg-blue-600 text-white"
                        : "bg-accent/10 text-muted"
                    }`}
                  >
                    {client.bultos_count}{" "}
                    {client.bultos_count === 1 ? "BULTO" : "BULTOS"}
                  </span>
                  <button
                    onClick={() => openEdit(client)}
                    className="p-1.5 text-muted hover:text-blue-600 transition-all duration-200"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(client.id)}
                    className="p-1.5 text-muted hover:text-red-600 transition-all duration-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Client info */}
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                {client.nombre_fantasia || client.name}
              </h3>
              {client.nombre_fantasia && (
                <p className="text-xs text-muted font-medium mt-0.5 uppercase">
                  {client.name}
                </p>
              )}
              {client.address && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-muted">
                  <MapPin className="w-3 h-3" />
                  {client.address}
                </div>
              )}

              {/* Bottom action */}
              <Link
                href={`/clientes/${client.id}`}
                className="flex items-center justify-between mt-4 pt-3 border-t border-card-border text-xs font-medium text-muted hover:text-blue-600 transition-all duration-200"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-md p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-foreground" />
                <h2 className="text-lg font-bold text-foreground">
                  {editingClient
                    ? "Editar Cliente"
                    : "Ficha de Nuevo Cliente"}
                </h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-muted hover:text-foreground transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                  Razón Social
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Logística Nacional S.A."
                  className="w-full px-4 py-2.5 border border-card-border rounded-xl text-sm bg-background text-foreground focus:ring-2 focus:ring-accent/40 focus:border-accent/40"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                  Nombre Fantasía
                </label>
                <input
                  type="text"
                  value={form.nombre_fantasia}
                  onChange={(e) =>
                    setForm({ ...form, nombre_fantasia: e.target.value })
                  }
                  placeholder="Ej: Tienda Express"
                  className="w-full px-4 py-2.5 border border-card-border rounded-xl text-sm bg-background text-foreground focus:ring-2 focus:ring-accent/40 focus:border-accent/40"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                  Domicilio / Planta
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  placeholder="Calle, Número, Localidad"
                  className="w-full px-4 py-2.5 border border-card-border rounded-xl text-sm bg-background text-foreground focus:ring-2 focus:ring-accent/40 focus:border-accent/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    placeholder="Teléfono"
                    className="w-full px-4 py-2.5 border border-card-border rounded-xl text-sm bg-background text-foreground focus:ring-2 focus:ring-accent/40 focus:border-accent/40"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    placeholder="Email"
                    className="w-full px-4 py-2.5 border border-card-border rounded-xl text-sm bg-background text-foreground focus:ring-2 focus:ring-accent/40 focus:border-accent/40"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-muted hover:text-foreground transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-all duration-200"
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
