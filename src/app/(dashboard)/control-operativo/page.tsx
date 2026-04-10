"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Package,
  TrendingUp,
  Calendar,
  AlertTriangle,
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

  const [allBultos, setAllBultos] = useState<BultoRow[]>([]);
  const [clients, setClients] = useState<Pick<Client, "id" | "name">[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    client_id: "",
    description: "",
    barcode: "",
    scheduled_return_date: "",
  });

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

  const metrics = useMemo(() => {
    const inRange = allBultos.filter((b) => {
      const returnDate = b.actual_return_date || b.scheduled_return_date;
      if (!returnDate) return false;
      return returnDate >= rangeFrom && returnDate <= rangeTo;
    });

    const returned = inRange.filter(
      (b) => b.status === "returned" && b.actual_return_date
    );

    const totalReturns = returned.length;

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

    const activityDates: DateActivity[] = Object.entries(returnsByDate)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 7)
      .map(([date, count]) => ({ date, count }));

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

    const criticalClients = Object.values(byClient).filter(
      (c) => c.count > 10
    );

    const today = new Date();
    const oldStock = activeBultos.filter((b) => {
      const entry = new Date(b.entry_date);
      const diffDays = Math.floor(
        (today.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24)
      );
      return diffDays > 7;
    });

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

  const filteredBultos = allBultos.filter((b) => {
    if (b.deleted_at !== null) return false;
    if (filterStatus === "all") return b.status !== "returned";
    return b.status === filterStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          <p className="text-muted text-sm font-medium">Cargando métricas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/15">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
              Control Operativo
            </h1>
            <p className="text-xs text-muted font-medium tracking-wide">
              Métricas de rendimiento y alertas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 card-base px-3 sm:px-4 py-2.5 !rounded-xl overflow-x-auto">
          <Calendar className="w-4 h-4 text-accent shrink-0" />
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider shrink-0 hidden sm:inline">Rango:</span>
          <input
            type="date"
            value={rangeFrom}
            onChange={(e) => setRangeFrom(e.target.value)}
            className="text-[12px] sm:text-[13px] border-0 bg-transparent focus:outline-none text-foreground font-semibold min-w-0"
          />
          <span className="text-muted/40 shrink-0">—</span>
          <input
            type="date"
            value={rangeTo}
            onChange={(e) => setRangeTo(e.target.value)}
            className="text-[12px] sm:text-[13px] border-0 bg-transparent focus:outline-none text-foreground font-semibold min-w-0"
          />
        </div>
      </div>

      {/* Top stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 stagger-children">
        {[
          { icon: Package, label: "Total período", value: metrics.totalReturns, sub: "Documentos Generados", gradient: "stat-blue", iconColor: "text-blue-400", iconBg: "bg-blue-500/10" },
          { icon: TrendingUp, label: "Promedio / Salida", value: metrics.avgPerDay, sub: "Por Día Laboral", gradient: "stat-green", iconColor: "text-emerald-400", iconBg: "bg-emerald-500/10" },
          { icon: Calendar, label: "Día pico", value: formatDate(metrics.peakDate), sub: `${metrics.peakCount} devoluciones`, gradient: "stat-purple", iconColor: "text-purple-400", iconBg: "bg-purple-500/10" },
          { icon: Clock, label: "Tiempo promedio", value: metrics.avgStorageDays, sub: "Días almacenamiento", gradient: "stat-amber", iconColor: "text-amber-400", iconBg: "bg-amber-500/10" },
          { icon: AlertTriangle, label: "Stock antiguo", value: metrics.oldStock, sub: "Bultos >7 días", gradient: "stat-red", iconColor: "text-red-400", iconBg: "bg-red-500/10" },
        ].map((stat) => (
          <div key={stat.label} className={`card-base p-5 animate-fade-in ${stat.gradient}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 ${stat.iconBg} rounded-xl flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>
              <span className="text-[9px] font-bold text-muted uppercase tracking-[0.1em]">
                {stat.label}
              </span>
            </div>
            <p className="text-3xl font-extrabold text-foreground tracking-tight">{stat.value}</p>
            <p className="text-[11px] text-muted mt-1 font-medium">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fechas con mayor actividad */}
        <div className="card-base p-6 animate-fade-in">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-blue-400" />
            </div>
            <h2 className="text-[13px] font-bold text-foreground">
              Fechas con Mayor Actividad
            </h2>
          </div>
          {metrics.activityDates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted">
              <BarChart3 className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm font-medium">Sin datos en este período</p>
            </div>
          ) : (
            <div className="space-y-3">
              {metrics.activityDates.map((item, i) => (
                <div key={item.date} className="flex items-center gap-3 group">
                  <span className="text-[11px] text-muted w-20 font-mono font-medium">
                    {formatDate(item.date)}
                  </span>
                  <div className="flex-1 h-8 bg-accent/[0.06] rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-lg flex items-center justify-end pr-3 animate-bar-grow"
                      style={{
                        width: `${Math.max((item.count / maxActivity) * 100, 12)}%`,
                        animationDelay: `${i * 100}ms`,
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
        <div className="card-base p-6 animate-fade-in">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <h2 className="text-[13px] font-bold text-foreground">
              Stock Crítico (&gt;10 Paquetes)
            </h2>
          </div>
          {metrics.criticalClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-3">
                <Package className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">Todo bajo control</p>
              <p className="text-[11px] text-muted mt-1">
                Ningún cliente supera el límite de alerta
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {metrics.criticalClients
                .sort((a, b) => b.count - a.count)
                .map((client) => (
                  <div
                    key={client.name}
                    className="flex items-center justify-between p-3.5 bg-red-500/[0.06] rounded-xl border border-red-500/10"
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span className="text-[13px] font-semibold text-foreground">
                        {client.name}
                      </span>
                    </div>
                    <span className="text-[13px] font-bold text-red-400">
                      {client.count}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Distribution + Efficiency row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-base p-6 animate-fade-in">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <h2 className="text-[13px] font-bold text-foreground">
              Distribución por Cliente
            </h2>
          </div>
          {metrics.clientDistribution.length === 0 ? (
            <p className="text-sm text-muted text-center py-10 font-medium">
              Sin stock almacenado
            </p>
          ) : (
            <div className="space-y-3">
              {metrics.clientDistribution.map((client, i) => (
                <div key={client.name} className="flex items-center gap-3">
                  <span className="text-[11px] text-muted w-28 truncate font-semibold">
                    {client.name}
                  </span>
                  <div className="flex-1 h-7 bg-accent/[0.06] rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-lg flex items-center justify-end pr-2.5 animate-bar-grow"
                      style={{
                        width: `${Math.max((client.count / maxClient) * 100, 12)}%`,
                        animationDelay: `${i * 80}ms`,
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

        <div className="card-base p-6 animate-fade-in">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <h2 className="text-[13px] font-bold text-foreground">
              Resumen de Operaciones
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: metrics.activeBultos, label: "Almacenados", color: "blue" },
              { value: metrics.totalReturns, label: "Devueltos", color: "emerald" },
              { value: metrics.onTime, label: "A tiempo", color: "amber" },
              { value: metrics.late, label: "Con demora", color: "red" },
            ].map((item) => (
              <div key={item.label} className={`bg-${item.color}-500/[0.06] rounded-xl p-4 text-center`}>
                <p className={`text-2xl font-extrabold text-${item.color}-400 tracking-tight`}>
                  {item.value}
                </p>
                <p className={`text-[10px] text-${item.color}-400/70 mt-1 font-semibold uppercase tracking-wider`}>
                  {item.label}
                </p>
              </div>
            ))}
          </div>
          {metrics.totalReturns > 0 && (
            <div className="mt-5">
              <div className="flex justify-between text-[11px] text-muted mb-2 font-semibold">
                <span>Tasa de puntualidad</span>
                <span className="text-foreground">
                  {Math.round(
                    (metrics.onTime / Math.max(metrics.totalReturns, 1)) * 100
                  )}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-accent/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full animate-bar-grow"
                  style={{
                    width: `${(metrics.onTime / Math.max(metrics.totalReturns, 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="card-base overflow-hidden animate-fade-in">
        <div className="flex border-b border-card-border">
          {["metrics", "bultos"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as "metrics" | "bultos")}
              className={`px-6 py-3.5 text-[13px] font-semibold transition-all duration-200 relative ${
                activeTab === tab
                  ? "text-accent"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {tab === "metrics" ? "Métricas" : "Gestión de Bultos"}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-accent to-accent-light" />
              )}
            </button>
          ))}
        </div>

        {activeTab === "metrics" ? (
          <div className="p-6">
            <h3 className="text-[13px] font-bold text-foreground mb-4">
              Indicadores clave — {formatDate(rangeFrom)} a {formatDate(rangeTo)}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              {[
                { value: metrics.totalBultos, label: "Total activos" },
                { value: metrics.activeBultos, label: "Almacenados" },
                { value: `${metrics.avgStorageDays}d`, label: "Promedio" },
                { value: metrics.oldStock, label: "Stock >7d" },
              ].map((item) => (
                <div key={item.label} className="p-4 border border-card-border rounded-xl">
                  <p className="text-xl font-extrabold text-foreground tracking-tight">{item.value}</p>
                  <p className="text-[10px] text-muted font-semibold uppercase tracking-wider mt-1">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-6">
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
                    className={`px-4 py-2 text-[11px] rounded-lg font-bold transition-all duration-200 tracking-wide ${
                      filterStatus === f.key
                        ? "bg-accent text-white shadow-md shadow-accent/20"
                        : "bg-accent/[0.06] text-muted hover:bg-accent/10"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-[11px] font-bold hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-200"
              >
                <Plus className="w-3.5 h-3.5" />
                Nuevo Bulto
              </button>
            </div>

            {showForm && (
              <form onSubmit={handleAdd} className="mb-5 p-5 bg-background/50 rounded-xl border border-card-border space-y-3 animate-scale-in">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <select
                    required
                    value={form.client_id}
                    onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                    className="px-3 py-2.5 border border-card-border rounded-xl text-[13px] bg-card text-foreground font-medium"
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
                    className="px-3 py-2.5 border border-card-border rounded-xl text-[13px] bg-card text-foreground"
                  />
                  <input
                    type="text"
                    placeholder="Código de barras"
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    className="px-3 py-2.5 border border-card-border rounded-xl text-[13px] bg-card text-foreground"
                  />
                  <input
                    type="date"
                    value={form.scheduled_return_date}
                    onChange={(e) => setForm({ ...form, scheduled_return_date: e.target.value })}
                    className="px-3 py-2.5 border border-card-border rounded-xl text-[13px] bg-card text-foreground"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="px-5 py-2 bg-accent text-white rounded-xl text-[11px] font-bold hover:bg-accent/90">
                    Agregar
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 text-muted rounded-xl text-[11px] font-semibold hover:bg-accent/5">
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-card-border">
                    {["Cliente", "Descripción", "Código", "Ingreso", "Estado", "Acciones"].map((h) => (
                      <th key={h} className={`text-${h === "Estado" || h === "Acciones" ? "center" : "left"} text-[10px] font-bold text-muted uppercase tracking-wider pb-3 pr-4`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredBultos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-sm text-muted font-medium">
                        No hay bultos
                      </td>
                    </tr>
                  ) : (
                    filteredBultos.slice(0, 20).map((bulto) => (
                      <tr key={bulto.id} className="border-b border-card-border/30 hover:bg-accent/[0.03] transition-colors duration-200">
                        <td className="py-3.5 pr-4 text-[13px] font-semibold text-foreground">
                          {bulto.clients?.name || "-"}
                        </td>
                        <td className="py-3.5 pr-4 text-[13px] text-muted">
                          {bulto.description || "-"}
                        </td>
                        <td className="py-3.5 pr-4 text-[13px] text-muted font-mono">
                          {bulto.barcode || "-"}
                        </td>
                        <td className="py-3.5 pr-4 text-[13px] text-muted">
                          {formatDate(bulto.entry_date)}
                        </td>
                        <td className="py-3.5 pr-4 text-center">
                          <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full ${
                            bulto.status === "stored"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-amber-500/10 text-amber-400"
                          }`}>
                            {bulto.status === "stored" ? "Almacenado" : "Retorno prog."}
                          </span>
                        </td>
                        <td className="py-3.5">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => handleMarkReturned(bulto.id)} className="px-2.5 py-1.5 text-[10px] bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 font-bold transition-colors">
                              Devolver
                            </button>
                            {bulto.status === "stored" && (
                              <button onClick={() => handleScheduleReturn(bulto.id)} className="p-1.5 text-muted hover:text-accent rounded-lg hover:bg-accent/10 transition-all">
                                <Calendar className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button onClick={() => handleDelete(bulto.id)} className="p-1.5 text-muted hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all">
                              <Trash2 className="w-3.5 h-3.5" />
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
