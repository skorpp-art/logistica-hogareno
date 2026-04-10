"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Package,
  TrendingUp,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Plus,
  Trash2,
  BarChart3,
  Clock,
  Users,
  Activity,
} from "lucide-react";
import type { Client } from "@/lib/types/database";

interface BultoRow {
  id: string;
  client_id: string;
  description: string | null;
  barcode: string | null;
  status: string;
  entry_date: string;
  scheduled_return_date: string | null;
  actual_return_date: string | null;
  deleted_at: string | null;
  created_at: string;
  clients: { name: string } | null;
}

interface DateActivity {
  date: string;
  count: number;
}

export default function ControlOperativoPage() {
  // Date range
  const [rangeFrom, setRangeFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [rangeTo, setRangeTo] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 0);
    return d.toISOString().split("T")[0];
  });

  // Data
  const [allBultos, setAllBultos] = useState<BultoRow[]>([]);
  const [clients, setClients] = useState<Pick<Client, "id" | "name">[]>([]);
  const [loading, setLoading] = useState(true);

  // Form for new bulto
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    client_id: "",
    description: "",
    barcode: "",
    scheduled_return_date: "",
  });

  // Tab for bottom section
  const [activeTab, setActiveTab] = useState<"bultos" | "metrics">("metrics");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const supabase = createClient();

    const { data: bultosData } = await supabase
      .from("bultos")
      .select("*, clients(name)")
      .order("created_at", { ascending: false });

    setAllBultos((bultosData as BultoRow[]) || []);

    const { data: clientsData } = await supabase
      .from("clients")
      .select("id, name")
      .is("deleted_at", null)
      .order("name");

    setClients(clientsData || []);
    setLoading(false);
  };

  // ---- Computed metrics ----
  const metrics = useMemo(() => {
    const inRange = allBultos.filter((b) => {
      const returnDate = b.actual_return_date || b.scheduled_return_date;
      if (!returnDate) return false;
      return returnDate >= rangeFrom && returnDate <= rangeTo;
    });

    const returned = inRange.filter(
      (b) => b.status === "returned" && b.actual_return_date
    );

    // Total devoluciones en el período
    const totalReturns = returned.length;

    // Promedio por día laboral (lun-vie)
    const from = new Date(rangeFrom);
    const to = new Date(rangeTo);
    let workDays = 0;
    const current = new Date(from);
    while (current <= to) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) workDays++;
      current.setDate(current.getDate() + 1);
    }
    const avgPerDay = workDays > 0 ? (totalReturns / workDays).toFixed(1) : "0";

    // Día pico
    const returnsByDate: Record<string, number> = {};
    returned.forEach((b) => {
      const d = b.actual_return_date!;
      returnsByDate[d] = (returnsByDate[d] || 0) + 1;
    });
    let peakDate = "-";
    let peakCount = 0;
    Object.entries(returnsByDate).forEach(([date, count]) => {
      if (count > peakCount) {
        peakDate = date;
        peakCount = count;
      }
    });

    // Fechas con mayor actividad (top 7)
    const activityDates: DateActivity[] = Object.entries(returnsByDate)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 7)
      .map(([date, count]) => ({ date, count }));

    // Stock actual por cliente
    const activeBultos = allBultos.filter(
      (b) => b.deleted_at === null && b.status === "stored"
    );
    const byClient: Record<string, { name: string; count: number }> = {};
    activeBultos.forEach((b) => {
      const name = b.clients?.name || "Sin cliente";
      if (!byClient[b.client_id]) byClient[b.client_id] = { name, count: 0 };
      byClient[b.client_id].count++;
    });
    const clientDistribution = Object.values(byClient)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Alertas de stock crítico (>10 paquetes por cliente)
    const criticalClients = Object.values(byClient).filter(
      (c) => c.count > 10
    );

    // Stock antiguo (>30 días)
    const today = new Date();
    const oldStock = activeBultos.filter((b) => {
      const entry = new Date(b.entry_date);
      const diffDays = Math.floor(
        (today.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24)
      );
      return diffDays > 30;
    });

    // Tiempo promedio de almacenamiento
    const avgStorageDays =
      activeBultos.length > 0
        ? Math.round(
            activeBultos.reduce((acc, b) => {
              const entry = new Date(b.entry_date);
              return (
                acc +
                Math.floor(
                  (today.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24)
                )
              );
            }, 0) / activeBultos.length
          )
        : 0;

    // Eficiencia: devoluciones a tiempo vs tarde
    const onTime = returned.filter((b) => {
      if (!b.scheduled_return_date || !b.actual_return_date) return false;
      return b.actual_return_date <= b.scheduled_return_date;
    }).length;
    const late = returned.length - onTime;

    return {
      totalReturns,
      avgPerDay,
      peakDate,
      peakCount,
      activityDates,
      clientDistribution,
      criticalClients,
      oldStock: oldStock.length,
      avgStorageDays,
      activeBultos: activeBultos.length,
      onTime,
      late,
      totalBultos: allBultos.filter((b) => b.deleted_at === null).length,
    };
  }, [allBultos, rangeFrom, rangeTo]);

  // ---- Actions ----
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

  const handleDelete = async (id: string) => {
    if (!confirm("¿Mover a papelera?")) return;
    const supabase = createClient();
    await supabase
      .from("bultos")
      .update({ deleted_at: new Date().toISOString() })
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

  // Max for bar chart
  const maxActivity = Math.max(
    ...metrics.activityDates.map((d) => d.count),
    1
  );
  const maxClient = Math.max(
    ...metrics.clientDistribution.map((c) => c.count),
    1
  );

  const formatDate = (d: string) => {
    if (d === "-") return "-";
    const parts = d.split("-");
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // Filtered bultos for table
  const filteredBultos = allBultos.filter((b) => {
    if (b.deleted_at !== null) return false;
    if (filterStatus === "all") return b.status !== "returned";
    return b.status === filterStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">Cargando métricas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Panel de Control Operativo
            </h1>
            <p className="text-xs text-gray-400 uppercase tracking-wider">
              Métricas de rendimiento y alertas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-bold text-gray-500 uppercase">Rango:</span>
          <input
            type="date"
            value={rangeFrom}
            onChange={(e) => setRangeFrom(e.target.value)}
            className="text-sm border-0 bg-transparent focus:outline-none text-gray-700 font-medium"
          />
          <span className="text-gray-300">—</span>
          <input
            type="date"
            value={rangeTo}
            onChange={(e) => setRangeTo(e.target.value)}
            className="text-sm border-0 bg-transparent focus:outline-none text-gray-700 font-medium"
          />
        </div>
      </div>

      {/* Top stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Total período
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{metrics.totalReturns}</p>
          <p className="text-xs text-gray-400 mt-1">
            Documentos de Devolución Generados
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Promedio / Salida
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{metrics.avgPerDay}</p>
          <p className="text-xs text-gray-400 mt-1">
            Promedio por Día Laboral (Lun-Vie)
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Día pico
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatDate(metrics.peakDate)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {metrics.peakCount} devoluciones
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Tiempo promedio
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {metrics.avgStorageDays}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Días de almacenamiento promedio
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Stock antiguo
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{metrics.oldStock}</p>
          <p className="text-xs text-gray-400 mt-1">
            Bultos con más de 30 días
          </p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fechas con mayor actividad */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="w-5 h-5 text-gray-700" />
            <h2 className="text-sm font-bold text-gray-900">
              Fechas con Mayor Actividad
            </h2>
          </div>
          {metrics.activityDates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <BarChart3 className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">Sin datos en este período</p>
            </div>
          ) : (
            <div className="space-y-3">
              {metrics.activityDates.map((item) => (
                <div key={item.date} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-20 font-mono">
                    {formatDate(item.date)}
                  </span>
                  <div className="flex-1 h-7 bg-gray-100 rounded-md overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-md flex items-center justify-end pr-2 transition-all duration-500"
                      style={{
                        width: `${Math.max((item.count / maxActivity) * 100, 8)}%`,
                      }}
                    >
                      <span className="text-[10px] font-bold text-white">
                        {item.count}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alertas de stock crítico */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle className="w-5 h-5 text-gray-700" />
            <h2 className="text-sm font-bold text-gray-900">
              Alertas de Stock Crítico (&gt;10 Paquetes)
            </h2>
          </div>
          {metrics.criticalClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-3">
                <Package className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-sm font-medium text-gray-500">Todo bajo control</p>
              <p className="text-xs text-gray-400 mt-1">
                Ningún cliente supera el límite de alerta.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {metrics.criticalClients
                .sort((a, b) => b.count - a.count)
                .map((client) => (
                  <div
                    key={client.name}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100"
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-medium text-gray-900">
                        {client.name}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-red-600">
                      {client.count} bultos
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Distribution + Efficiency row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución por cliente */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <Users className="w-5 h-5 text-gray-700" />
            <h2 className="text-sm font-bold text-gray-900">
              Distribución de Stock por Cliente
            </h2>
          </div>
          {metrics.clientDistribution.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Sin stock almacenado
            </p>
          ) : (
            <div className="space-y-2">
              {metrics.clientDistribution.map((client) => (
                <div key={client.name} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-28 truncate font-medium">
                    {client.name}
                  </span>
                  <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 rounded flex items-center justify-end pr-2 transition-all duration-500"
                      style={{
                        width: `${Math.max(
                          (client.count / maxClient) * 100,
                          10
                        )}%`,
                      }}
                    >
                      <span className="text-[10px] font-bold text-white">
                        {client.count}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Eficiencia de devoluciones */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-5 h-5 text-gray-700" />
            <h2 className="text-sm font-bold text-gray-900">
              Resumen de Operaciones
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">
                {metrics.activeBultos}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Bultos almacenados
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-700">
                {metrics.totalReturns}
              </p>
              <p className="text-xs text-green-600 mt-1">
                Devueltos (período)
              </p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">
                {metrics.onTime}
              </p>
              <p className="text-xs text-amber-600 mt-1">A tiempo</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{metrics.late}</p>
              <p className="text-xs text-red-600 mt-1">Con demora</p>
            </div>
          </div>
          {metrics.totalReturns > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Tasa de puntualidad</span>
                <span className="font-bold">
                  {Math.round(
                    (metrics.onTime / Math.max(metrics.totalReturns, 1)) * 100
                  )}
                  %
                </span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${(metrics.onTime / Math.max(metrics.totalReturns, 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs: Metrics / Bultos table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab("metrics")}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "metrics"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Métricas
          </button>
          <button
            onClick={() => setActiveTab("bultos")}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "bultos"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Gestión de Bultos
          </button>
        </div>

        {activeTab === "metrics" ? (
          <div className="p-6">
            <h3 className="text-sm font-bold text-gray-700 mb-4">
              Indicadores clave del período {formatDate(rangeFrom)} — {formatDate(rangeTo)}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-4 border border-gray-100 rounded-lg">
                <p className="text-lg font-bold text-gray-900">{metrics.totalBultos}</p>
                <p className="text-xs text-gray-400">Total bultos activos</p>
              </div>
              <div className="p-4 border border-gray-100 rounded-lg">
                <p className="text-lg font-bold text-gray-900">{metrics.activeBultos}</p>
                <p className="text-xs text-gray-400">Actualmente almacenados</p>
              </div>
              <div className="p-4 border border-gray-100 rounded-lg">
                <p className="text-lg font-bold text-gray-900">{metrics.avgStorageDays}d</p>
                <p className="text-xs text-gray-400">Promedio almacenamiento</p>
              </div>
              <div className="p-4 border border-gray-100 rounded-lg">
                <p className="text-lg font-bold text-gray-900">{metrics.oldStock}</p>
                <p className="text-xs text-gray-400">Stock &gt;30 días</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6">
            {/* Add button + filters */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex gap-2">
                {[
                  { key: "all", label: "Activos" },
                  { key: "stored", label: "Almacenados" },
                  { key: "scheduled_return", label: "Retorno prog." },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilterStatus(f.key)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                      filterStatus === f.key
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Nuevo Bulto
              </button>
            </div>

            {showForm && (
              <form onSubmit={handleAdd} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <select
                    required
                    value={form.client_id}
                    onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Cliente *</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Descripción"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Código de barras"
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="date"
                    placeholder="Fecha retorno"
                    value={form.scheduled_return_date}
                    onChange={(e) => setForm({ ...form, scheduled_return_date: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                    Agregar
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50">
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {/* Bultos table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-bold text-gray-500 uppercase pb-2 pr-4">Cliente</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase pb-2 pr-4">Descripción</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase pb-2 pr-4">Código</th>
                    <th className="text-left text-xs font-bold text-gray-500 uppercase pb-2 pr-4">Ingreso</th>
                    <th className="text-center text-xs font-bold text-gray-500 uppercase pb-2 pr-4">Estado</th>
                    <th className="text-center text-xs font-bold text-gray-500 uppercase pb-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBultos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-sm text-gray-400">
                        No hay bultos
                      </td>
                    </tr>
                  ) : (
                    filteredBultos.slice(0, 20).map((bulto) => (
                      <tr key={bulto.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 pr-4 text-sm font-medium text-gray-900">
                          {bulto.clients?.name || "-"}
                        </td>
                        <td className="py-3 pr-4 text-sm text-gray-600">
                          {bulto.description || "-"}
                        </td>
                        <td className="py-3 pr-4 text-sm text-gray-600 font-mono">
                          {bulto.barcode || "-"}
                        </td>
                        <td className="py-3 pr-4 text-sm text-gray-600">
                          {formatDate(bulto.entry_date)}
                        </td>
                        <td className="py-3 pr-4 text-center">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                            bulto.status === "stored"
                              ? "bg-green-50 text-green-700"
                              : "bg-amber-50 text-amber-700"
                          }`}>
                            {bulto.status === "stored" ? "Almacenado" : "Retorno prog."}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => handleMarkReturned(bulto.id)} className="px-2 py-1 text-[10px] bg-green-50 text-green-700 rounded hover:bg-green-100 font-medium">
                              Devolver
                            </button>
                            {bulto.status === "stored" && (
                              <button onClick={() => handleScheduleReturn(bulto.id)} className="p-1 text-gray-400 hover:text-blue-600">
                                <Calendar className="w-3 h-3" />
                              </button>
                            )}
                            <button onClick={() => handleDelete(bulto.id)} className="p-1 text-gray-400 hover:text-red-600">
                              <Trash2 className="w-3 h-3" />
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
        )}
      </div>
    </div>
  );
}
