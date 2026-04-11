"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import StatsCard from "@/components/dashboard/StatsCard";
import AlertBanner from "@/components/dashboard/AlertBanner";
import TopClientsTable from "@/components/dashboard/TopClientsTable";
import OldestStock from "@/components/dashboard/OldestStock";
import {
  Package,
  Users,
  AlertTriangle,
  Trash2,
  Clock,
  CalendarCheck,
  TrendingUp,
  ArrowRight,
  Search,
  MapPin,
  Timer,
} from "lucide-react";
import type { TopClient, OldestStockItem } from "@/lib/types/database";
import Link from "next/link";

interface TodayTask {
  type: "return" | "old_stock" | "alert";
  title: string;
  subtitle: string;
  clientName?: string;
  link?: string;
  urgency: "high" | "medium" | "low";
}

interface RecentActivity {
  id: string;
  action: string;
  description: string;
  date: string;
  status: string;
}

export default function ControlGeneralPage() {
  const [stats, setStats] = useState({
    totalStock: 0,
    totalClients: 0,
    stockAlerts: 0,
    papeleraCount: 0,
  });
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [oldestStock, setOldestStock] = useState<OldestStockItem[]>([]);
  const [returnClientNames, setReturnClientNames] = useState<string[]>([]);
  const [todayTasks, setTodayTasks] = useState<TodayTask[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [oldStockCount, setOldStockCount] = useState(0);
  const [todayReturnsCount, setTodayReturnsCount] = useState(0);
  const [avgDaysInDepot, setAvgDaysInDepot] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    const supabase = createClient();
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const [
      { count: totalStock },
      { count: totalClients },
      { count: stockAlerts },
      { count: papeleraCount },
    ] = await Promise.all([
      supabase
        .from("bultos")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null),
      supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null),
      supabase
        .from("stock_alerts")
        .select("*", { count: "exact", head: true })
        .eq("resolved", false),
      supabase
        .from("bultos")
        .select("*", { count: "exact", head: true })
        .not("deleted_at", "is", null),
    ]);

    setStats({
      totalStock: totalStock || 0,
      totalClients: totalClients || 0,
      stockAlerts: stockAlerts || 0,
      papeleraCount: papeleraCount || 0,
    });

    // Top clients & oldest stock
    const { data: topClientsData } = await supabase.rpc("get_top_clients", { limit_count: 5 });
    setTopClients(topClientsData || []);

    const { data: oldestStockData } = await supabase.rpc("get_oldest_stock", { limit_count: 5 });
    setOldestStock(oldestStockData || []);

    // Tomorrow returns (weekly schedules)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDayIndex = tomorrow.getDay();
    const dayKeys = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];
    const tomorrowKey = dayKeys[tomorrowDayIndex];

    const { data: weeklySchedules } = await supabase
      .from("weekly_schedules")
      .select("*, clients(name)")
      .eq("active", true)
      .eq(tomorrowKey, true);

    const weeklyNames = (weeklySchedules || [])
      .map((s: Record<string, unknown>) => {
        const c = s.clients;
        if (Array.isArray(c) && c[0]) return (c[0] as { name: string }).name;
        if (c && typeof c === "object" && c !== null && "name" in c) return (c as { name: string }).name;
        return undefined;
      })
      .filter(Boolean) as string[];

    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    const { data: tomorrowReturns } = await supabase
      .from("bultos")
      .select("id, clients(name)")
      .eq("scheduled_return_date", tomorrowStr)
      .eq("status", "scheduled_return")
      .is("deleted_at", null);

    const bultoNames = (tomorrowReturns || [])
      .map((b: Record<string, unknown>) => {
        const c = b.clients;
        if (Array.isArray(c) && c[0]) return (c[0] as { name: string }).name;
        if (c && typeof c === "object" && c !== null && "name" in c) return (c as { name: string }).name;
        return undefined;
      })
      .filter(Boolean) as string[];

    const names = [...new Set([...weeklyNames, ...bultoNames])];
    setReturnClientNames(names);

    // === NEW: Today's tasks ===
    const tasks: TodayTask[] = [];

    // Today's scheduled returns
    const todayDayIndex = today.getDay();
    const todayKey = dayKeys[todayDayIndex];

    const { data: todaySchedules } = await supabase
      .from("weekly_schedules")
      .select("*, clients(id, name)")
      .eq("active", true)
      .eq(todayKey, true);

    const todayClientNames = (todaySchedules || [])
      .map((s: Record<string, unknown>) => {
        const c = s.clients;
        if (Array.isArray(c) && c[0]) return c[0] as { id: string; name: string };
        if (c && typeof c === "object" && c !== null && "name" in c) return c as { id: string; name: string };
        return null;
      })
      .filter(Boolean) as { id: string; name: string }[];

    const { count: todayRetCount } = await supabase
      .from("bultos")
      .select("*", { count: "exact", head: true })
      .eq("scheduled_return_date", todayStr)
      .eq("status", "scheduled_return")
      .is("deleted_at", null);

    setTodayReturnsCount((todayRetCount || 0) + todayClientNames.length);

    todayClientNames.forEach((c) => {
      tasks.push({
        type: "return",
        title: `Devolución: ${c.name}`,
        subtitle: "Programada por agenda semanal",
        clientName: c.name,
        link: `/clientes/${c.id}`,
        urgency: "high",
      });
    });

    // Old stock alerts (>15 days)
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    const fifteenStr = fifteenDaysAgo.toISOString().split("T")[0];

    const { data: oldBultos, count: oldCount } = await supabase
      .from("bultos")
      .select("id, entry_date, tracking_id, clients(name)", { count: "exact" })
      .eq("status", "stored")
      .is("deleted_at", null)
      .lte("entry_date", fifteenStr)
      .order("entry_date")
      .limit(5);

    setOldStockCount(oldCount || 0);

    (oldBultos || []).forEach((b: Record<string, unknown>) => {
      const c = b.clients;
      const clientName = c && typeof c === "object" && c !== null && "name" in c ? (c as { name: string }).name : "Sin cliente";
      const days = Math.floor((today.getTime() - new Date(b.entry_date as string).getTime()) / 86400000);
      tasks.push({
        type: "old_stock",
        title: `${b.tracking_id || "Bulto"} — ${days} días`,
        subtitle: clientName,
        urgency: days > 30 ? "high" : "medium",
      });
    });

    setTodayTasks(tasks);

    // Average days in depot
    const { data: storedBultos } = await supabase
      .from("bultos")
      .select("entry_date")
      .eq("status", "stored")
      .is("deleted_at", null);

    if (storedBultos && storedBultos.length > 0) {
      const totalDays = storedBultos.reduce((acc, b) => {
        return acc + Math.floor((today.getTime() - new Date(b.entry_date).getTime()) / 86400000);
      }, 0);
      setAvgDaysInDepot(Math.round(totalDays / storedBultos.length));
    }

    // Recent activity (last 10 returns)
    const { data: recentData } = await supabase
      .from("bultos")
      .select("id, tracking_id, description, status, actual_return_date, entry_date, updated_at")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(8);

    setRecentActivity(
      (recentData || []).map((b) => ({
        id: b.id,
        action: b.status === "returned" ? "Devuelto" : b.status === "stored" ? "Ingresado" : "Programado",
        description: b.tracking_id || b.description || "Sin ID",
        date: b.actual_return_date || b.entry_date,
        status: b.status,
      }))
    );

    setLoading(false);
  };

  const formatDate = (d: string) => {
    const parts = d.split("-");
    return `${parts[2]}/${parts[1]}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          <p className="text-muted text-sm font-medium">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Control General</h1>
        <p className="text-sm text-muted mt-1 font-medium">Resumen operativo del depósito</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 stagger-children">
        <StatsCard label="Total Stock" value={stats.totalStock} icon={Package} iconColor="text-blue-400" iconBg="bg-blue-500/10" gradient="stat-blue" />
        <StatsCard label="Clientes" value={stats.totalClients} icon={Users} iconColor="text-emerald-400" iconBg="bg-emerald-500/10" gradient="stat-green" />
        <StatsCard label="Alertas Stock" value={stats.stockAlerts} icon={AlertTriangle} iconColor="text-amber-400" iconBg="bg-amber-500/10" gradient="stat-amber" />
        <StatsCard label="En Papelera" value={stats.papeleraCount} icon={Trash2} iconColor="text-red-400" iconBg="bg-red-500/10" gradient="stat-red" />
      </div>

      {/* ===== TODAY SECTION ===== */}
      <div className="card-base p-5 sm:p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
              <CalendarCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-foreground">Hoy</h2>
              <p className="text-[11px] text-muted">
                {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {todayReturnsCount > 0 && (
              <span className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400">
                {todayReturnsCount} devoluciones
              </span>
            )}
            {oldStockCount > 0 && (
              <span className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-red-500/10 text-red-400">
                {oldStockCount} stock viejo
              </span>
            )}
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-background rounded-xl p-3 text-center">
            <CalendarCheck className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <p className="text-[18px] font-extrabold text-foreground">{todayReturnsCount}</p>
            <p className="text-[10px] text-muted font-bold uppercase">Devoluciones hoy</p>
          </div>
          <div className="bg-background rounded-xl p-3 text-center">
            <Timer className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <p className="text-[18px] font-extrabold text-foreground">{avgDaysInDepot}</p>
            <p className="text-[10px] text-muted font-bold uppercase">Días prom.</p>
          </div>
          <div className="bg-background rounded-xl p-3 text-center">
            <AlertTriangle className="w-5 h-5 text-red-400 mx-auto mb-1" />
            <p className="text-[18px] font-extrabold text-foreground">{oldStockCount}</p>
            <p className="text-[10px] text-muted font-bold uppercase">+15 días</p>
          </div>
        </div>

        {/* Today's tasks */}
        {todayTasks.length > 0 ? (
          <div className="space-y-2">
            {todayTasks.map((task, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                task.urgency === "high" ? "bg-red-500/[0.06] border border-red-500/15" :
                task.urgency === "medium" ? "bg-amber-500/[0.06] border border-amber-500/15" :
                "bg-background"
              }`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  task.type === "return" ? "bg-blue-500/10" : "bg-amber-500/10"
                }`}>
                  {task.type === "return" ? (
                    <Package className="w-4 h-4 text-blue-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-foreground truncate">{task.title}</p>
                  <p className="text-[10px] text-muted">{task.subtitle}</p>
                </div>
                {task.link && (
                  <Link href={task.link} className="p-1.5 text-muted hover:text-accent transition-colors">
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-[13px] text-muted">No hay tareas pendientes para hoy</p>
          </div>
        )}
      </div>

      {/* Tomorrow's returns banner */}
      <AlertBanner clientNames={returnClientNames} />

      {/* Old stock warning (enhanced) */}
      {oldStockCount > 0 && (
        <div className="card-base p-4 sm:p-5 border-red-500/20 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-[14px] font-bold text-red-400">Stock Viejo — {oldStockCount} paquetes con más de 15 días</h3>
              <p className="text-[12px] text-muted mt-1">
                Estos paquetes llevan demasiado tiempo en el depósito. Contactá a los clientes para coordinar la devolución.
              </p>
            </div>
            <Link href="/control-operativo" className="px-3 py-2 rounded-xl bg-red-500/10 text-red-400 text-[11px] font-bold hover:bg-red-500/20 transition-all shrink-0">
              Ver detalle
            </Link>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TopClientsTable clients={topClients} />
        </div>
        <div>
          <OldestStock items={oldestStock} />
        </div>
      </div>

      {/* Recent activity */}
      {recentActivity.length > 0 && (
        <div className="card-base p-5 sm:p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-foreground">Actividad Reciente</h2>
              <p className="text-[11px] text-muted">Últimos movimientos en el sistema</p>
            </div>
          </div>
          <div className="space-y-2">
            {recentActivity.map((act) => (
              <div key={act.id} className="flex items-center gap-3 p-3 bg-background rounded-xl">
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  act.status === "returned" ? "bg-emerald-400" :
                  act.status === "stored" ? "bg-blue-400" :
                  "bg-amber-400"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-foreground truncate">{act.description}</p>
                  <p className="text-[10px] text-muted">{act.action}</p>
                </div>
                <p className="text-[10px] text-muted font-mono shrink-0">{formatDate(act.date)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
