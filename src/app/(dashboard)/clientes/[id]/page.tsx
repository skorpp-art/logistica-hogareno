"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  FileText,
  Edit,
  Trash2,
  Package,
  X,
  Download,
} from "lucide-react";
import Link from "next/link";
import type { Client, Bulto } from "@/lib/types/database";

export default function ClienteDetailPage() {
  return (
    <Suspense fallback={<p className="text-gray-400">Cargando...</p>}>
      <ClienteDetailContent />
    </Suspense>
  );
}

const STATUS_OPTIONS = [
  { value: "stored", label: "ALMACENADO", color: "bg-green-100 text-green-700" },
  { value: "scheduled_return", label: "RETORNO PROG.", color: "bg-amber-100 text-amber-700" },
  { value: "returned", label: "DEVUELTO", color: "bg-blue-100 text-blue-700" },
  { value: "cancelled", label: "CANCELADO", color: "bg-red-100 text-red-700" },
  { value: "duplicate", label: "DUPLICADO", color: "bg-purple-100 text-purple-700" },
];

function ClienteDetailContent() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [bultos, setBultos] = useState<Bulto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    tracking_id: "",
    description: "",
    destination_address: "",
    destination_locality: "",
    scheduled_return_date: "",
  });
  const [saving, setSaving] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    const supabase = createClient();
    const { data: clientData } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single();

    if (clientData) setClient(clientData);

    const { data: bultosData } = await supabase
      .from("bultos")
      .select("*")
      .eq("client_id", id)
      .is("deleted_at", null)
      .order("entry_date", { ascending: false });

    setBultos(bultosData || []);
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    await supabase.from("bultos").insert({
      client_id: id,
      tracking_id: form.tracking_id || null,
      barcode: form.tracking_id || null,
      description: form.description || null,
      destination_address: form.destination_address || null,
      destination_locality: form.destination_locality || null,
      status: form.scheduled_return_date ? "scheduled_return" : "stored",
      entry_date: new Date().toISOString().split("T")[0],
      scheduled_return_date: form.scheduled_return_date || null,
    });
    setForm({
      tracking_id: "",
      description: "",
      destination_address: "",
      destination_locality: "",
      scheduled_return_date: "",
    });
    setShowForm(false);
    setSaving(false);
    fetchData();
  };

  const handleStatusChange = async (bultoId: string, newStatus: string) => {
    const supabase = createClient();
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "returned") {
      updates.actual_return_date = new Date().toISOString().split("T")[0];
    }
    await supabase.from("bultos").update(updates).eq("id", bultoId);
    fetchData();
  };

  const handleDeleteBulto = async (bultoId: string) => {
    if (!confirm("¿Eliminar este registro?")) return;
    const supabase = createClient();
    await supabase
      .from("bultos")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", bultoId);
    fetchData();
  };

  const handleExportPDF = () => {
    if (!pdfRef.current) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const today = new Date();
    const dateStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

    const activeBultos = bultos.filter(
      (b) => b.status !== "returned" && b.status !== "cancelled"
    );

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Remito - ${client?.name}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 40px; color: #111; }
          .header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px; border-bottom: 3px solid #111; padding-bottom: 15px; }
          .logo-area { display: flex; align-items: center; gap: 12px; }
          .logo-box { width: 40px; height: 40px; border: 3px solid #111; display: flex; align-items: center; justify-content: center; font-weight: bold; }
          .title { font-size: 24px; font-weight: bold; }
          .subtitle { font-size: 11px; color: #555; margin-top: 2px; }
          .doc-info { text-align: right; font-size: 12px; }
          .doc-info strong { display: block; }
          .client-box { background: #f3f4f6; padding: 15px 20px; border-radius: 6px; margin-bottom: 20px; }
          .client-box .name { font-size: 14px; font-weight: bold; text-transform: uppercase; }
          .client-box .meta { display: flex; justify-content: space-between; margin-top: 5px; font-size: 12px; color: #555; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #f9fafb; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; color: #555; border-bottom: 2px solid #ddd; }
          td { padding: 8px 10px; font-size: 12px; border-bottom: 1px solid #eee; }
          .status { font-weight: bold; font-size: 11px; text-transform: uppercase; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 40px; border-top: 2px solid #111; padding-top: 20px; }
          .sig-box { text-align: center; padding-top: 40px; border-top: 1px solid #999; }
          .sig-box .role { font-weight: bold; font-size: 12px; }
          .sig-box .desc { font-size: 10px; color: #777; font-style: italic; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-area">
            <div class="logo-box">LH</div>
            <div>
              <div class="title">LOGISTICA HOGAREÑO</div>
              <div class="subtitle">FICHA DE CONTROL E INVENTARIO DE STOCK</div>
            </div>
          </div>
          <div class="doc-info">
            <strong>DOC N°: ${String(activeBultos.length).padStart(2, "0")}</strong>
            <span>FECHA: ${dateStr}</span>
          </div>
        </div>

        <div class="client-box">
          <div class="name">${client?.nombre_fantasia ? client.nombre_fantasia + " - " : ""}${client?.name}</div>
          <div class="meta">
            <span>TIPO DE OPERACIÓN: STOCK INGRESO</span>
            <span>TOTAL BULTOS: ${activeBultos.length}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Tracking</th>
              <th>Artículo / Notas</th>
              <th>Fecha</th>
              <th>Destino</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${activeBultos
              .map(
                (b) => `
              <tr>
                <td>${b.tracking_id || b.barcode || "-"}</td>
                <td>${b.description || b.tracking_id || b.barcode || "-"}</td>
                <td>${b.entry_date}</td>
                <td>${b.destination_address ? b.destination_address + (b.destination_locality ? " - " + b.destination_locality : "") : "-"}</td>
                <td class="status">${STATUS_OPTIONS.find((s) => s.value === b.status)?.label || b.status}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-box">
            <div class="role">ASESOR COMERCIAL</div>
            <div class="desc">Autorización de Salida</div>
          </div>
          <div class="sig-box">
            <div class="role">CONDUCTOR LOGÍSTICO</div>
            <div class="desc">Verificación y Carga</div>
          </div>
          <div class="sig-box">
            <div class="role">CLIENTE RECEPTOR</div>
            <div class="desc">Recibido Conforme</div>
          </div>
        </div>

        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();

    // Move bultos to papelera after export
    moveBultosToPapelera(activeBultos.map((b) => b.id));
  };

  const moveBultosToPapelera = async (ids: string[]) => {
    if (ids.length === 0) return;
    const supabase = createClient();
    await supabase
      .from("bultos")
      .update({ deleted_at: new Date().toISOString(), status: "returned" })
      .in("id", ids);
    fetchData();
  };

  const formatDate = (d: string) => {
    const parts = d.split("-");
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // Days in storage
  const getDaysStored = (entryDate: string) => {
    const entry = new Date(entryDate);
    const today = new Date();
    return Math.floor(
      (today.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24)
    );
  };

  if (loading) {
    return <p className="text-gray-400">Cargando...</p>;
  }

  if (!client) {
    return <p className="text-gray-400">Cliente no encontrado</p>;
  }

  const activeBultos = bultos.filter(
    (b) => b.status !== "returned" && b.status !== "cancelled"
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/clientes"
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            REGRESAR A CLIENTES
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPDF}
            disabled={activeBultos.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 border-2 border-gray-900 text-gray-900 rounded-xl text-sm font-bold hover:bg-gray-900 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            EXPORTAR PDF OFICIAL
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            NUEVO REGISTRO
          </button>
        </div>
      </div>

      {/* Client name */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
          <Package className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 uppercase">
            {client.name}
          </h1>
          <p className="text-xs text-gray-400">
            Gestión de Stock Logística Hogareño
            {client.nombre_fantasia && ` · ${client.nombre_fantasia}`}
          </p>
        </div>
      </div>

      {/* New record form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                Nuevo Registro
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  ID Tracking
                </label>
                <input
                  type="text"
                  value={form.tracking_id}
                  onChange={(e) =>
                    setForm({ ...form, tracking_id: e.target.value })
                  }
                  placeholder="Ej: 46757373883"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Descripción / Notas
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Descripción del paquete"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Dirección Destino
                  </label>
                  <input
                    type="text"
                    value={form.destination_address}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        destination_address: e.target.value,
                      })
                    }
                    placeholder="Calle y número"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Localidad
                  </label>
                  <input
                    type="text"
                    value={form.destination_locality}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        destination_locality: e.target.value,
                      })
                    }
                    placeholder="Localidad"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Fecha devolución programada
                </label>
                <input
                  type="date"
                  value={form.scheduled_return_date}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      scheduled_return_date: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-gray-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Agregar Registro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bultos table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {bultos.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              No hay registros para este cliente
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider px-6 py-3">
                  ID Tracking
                </th>
                <th className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider px-6 py-3">
                  Detalles y Estado
                </th>
                <th className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider px-6 py-3">
                  Fecha
                </th>
                <th className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider px-6 py-3">
                  Ubicación Destino
                </th>
                <th className="text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider px-6 py-3">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {bultos.map((bulto) => {
                const days = getDaysStored(bulto.entry_date);
                const isOverdue = days > 7 && bulto.status === "stored";

                return (
                  <tr
                    key={bulto.id}
                    className={`border-b border-gray-50 hover:bg-gray-50 ${
                      isOverdue ? "bg-red-50/50" : ""
                    }`}
                  >
                    <td className="px-6 py-4">
                      <span className="inline-block px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-mono font-bold">
                        {bulto.tracking_id || bulto.barcode || "-"}
                      </span>
                      {isOverdue && (
                        <span className="block text-[10px] text-red-500 font-bold mt-1">
                          ⚠ {days} días en depósito
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-gray-900 mb-1">
                        {bulto.tracking_id || bulto.barcode || bulto.description || "-"}
                      </p>
                      <select
                        value={bulto.status}
                        onChange={(e) =>
                          handleStatusChange(bulto.id, e.target.value)
                        }
                        className={`text-[10px] font-bold px-3 py-1 rounded-full border-0 cursor-pointer ${
                          STATUS_OPTIONS.find((s) => s.value === bulto.status)
                            ?.color || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(bulto.entry_date)}
                    </td>
                    <td className="px-6 py-4">
                      {bulto.destination_address ? (
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {bulto.destination_address}
                          </p>
                          {bulto.destination_locality && (
                            <p className="text-xs text-gray-400">
                              {bulto.destination_locality}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleDeleteBulto(bulto.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Hidden PDF ref */}
      <div ref={pdfRef} className="hidden" />
    </div>
  );
}
