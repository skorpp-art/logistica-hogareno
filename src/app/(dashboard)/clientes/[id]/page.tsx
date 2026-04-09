"use client";

import { Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Save, Package } from "lucide-react";
import Link from "next/link";
import type { Client, Bulto } from "@/lib/types/database";

export default function ClienteDetailPage() {
  return (
    <Suspense fallback={<p className="text-gray-400">Cargando...</p>}>
      <ClienteDetailContent />
    </Suspense>
  );
}

function ClienteDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const isEdit = searchParams.get("edit") === "true";

  const [client, setClient] = useState<Client | null>(null);
  const [bultos, setBultos] = useState<Bulto[]>([]);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });
  const [editing, setEditing] = useState(isEdit);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClient();
  }, [id]);

  const fetchClient = async () => {
    const supabase = createClient();
    const { data: clientData } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single();

    if (clientData) {
      setClient(clientData);
      setForm({
        name: clientData.name,
        phone: clientData.phone || "",
        email: clientData.email || "",
        address: clientData.address || "",
        notes: clientData.notes || "",
      });
    }

    const { data: bultosData } = await supabase
      .from("bultos")
      .select("*")
      .eq("client_id", id)
      .is("deleted_at", null)
      .order("entry_date", { ascending: false });

    setBultos(bultosData || []);
    setLoading(false);
  };

  const handleSave = async () => {
    const supabase = createClient();
    await supabase
      .from("clients")
      .update({
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    setEditing(false);
    fetchClient();
  };

  if (loading) {
    return <p className="text-gray-400">Cargando...</p>;
  }

  if (!client) {
    return <p className="text-gray-400">Cliente no encontrado</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/clientes"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Editar
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                Guardar
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Teléfono</p>
              <p className="font-medium text-gray-900">{client.phone || "-"}</p>
            </div>
            <div>
              <p className="text-gray-500">Email</p>
              <p className="font-medium text-gray-900">{client.email || "-"}</p>
            </div>
            <div>
              <p className="text-gray-500">Dirección</p>
              <p className="font-medium text-gray-900">{client.address || "-"}</p>
            </div>
            <div>
              <p className="text-gray-500">Notas</p>
              <p className="font-medium text-gray-900">{client.notes || "-"}</p>
            </div>
          </div>
        )}
      </div>

      {/* Bultos del cliente */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-blue-500" />
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
            Bultos ({bultos.length})
          </h2>
        </div>
        {bultos.length === 0 ? (
          <p className="text-sm text-gray-400">No hay bultos para este cliente</p>
        ) : (
          <div className="space-y-2">
            {bultos.map((bulto) => (
              <div
                key={bulto.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {bulto.description || "Sin descripción"}
                  </p>
                  <p className="text-xs text-gray-400">
                    Código: {bulto.barcode || "-"} | Ingreso: {bulto.entry_date}
                  </p>
                </div>
                <span
                  className={`text-xs font-bold px-2 py-1 rounded-full ${
                    bulto.status === "stored"
                      ? "bg-green-50 text-green-700"
                      : bulto.status === "scheduled_return"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {bulto.status === "stored"
                    ? "Almacenado"
                    : bulto.status === "scheduled_return"
                    ? "Retorno programado"
                    : bulto.status === "returned"
                    ? "Devuelto"
                    : bulto.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
