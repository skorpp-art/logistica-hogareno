"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import StatsCard from "@/components/dashboard/StatsCard";
import AlertBanner from "@/components/dashboard/AlertBanner";
import TopClientsTable from "@/components/dashboard/TopClientsTable";
import OldestStock from "@/components/dashboard/OldestStock";
import { Package, Users, AlertTriangle, Trash2 } from "lucide-react";
import type { TopClient, OldestStockItem } from "@/lib/types/database";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    const supabase = createClient();

    const [
      { count: totalStock },
      { count: totalClients },
      { count: stockAlerts },
      { count: papeleraCount },
    ] = await Promise.all([
      supabase
        .from("bultos")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .in("status", ["stored", "scheduled_return"]),
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

    const { data: topClientsData } = await supabase.rpc("get_top_clients", {
      limit_count: 5,
    });
    setTopClients(topClientsData || []);

    const { data: oldestStockData } = await supabase.rpc("get_oldest_stock", {
      limit_count: 5,
    });
    setOldestStock(oldestStockData || []);

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
        if (c && typeof c === "object" && c !== null && "name" in c)
          return (c as { name: string }).name;
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
        if (c && typeof c === "object" && c !== null && "name" in c)
          return (c as { name: string }).name;
        return undefined;
      })
      .filter(Boolean) as string[];

    const names = [...new Set([...weeklyNames, ...bultoNames])];
    setReturnClientNames(names);

    setLoading(false);
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
        <p className="text-sm text-muted mt-1 font-medium">Resumen operativo del deposito</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        <StatsCard
          label="Total Stock"
          value={stats.totalStock}
          icon={Package}
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10"
          gradient="stat-blue"
        />
        <StatsCard
          label="Clientes"
          value={stats.totalClients}
          icon={Users}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
          gradient="stat-green"
        />
        <StatsCard
          label="Alertas Stock"
          value={stats.stockAlerts}
          icon={AlertTriangle}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10"
          gradient="stat-amber"
        />
        <StatsCard
          label="En Papelera"
          value={stats.papeleraCount}
          icon={Trash2}
          iconColor="text-red-400"
          iconBg="bg-red-500/10"
          gradient="stat-red"
        />
      </div>

      <AlertBanner clientNames={returnClientNames} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TopClientsTable clients={topClients} />
        </div>
        <div>
          <OldestStock items={oldestStock} />
        </div>
      </div>
    </div>
  );
}
