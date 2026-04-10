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
        .eq("status", "stored"),
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

    // Tomorrow's returns
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const { data: tomorrowReturns } = await supabase
      .from("bultos")
      .select("id, clients(name)")
      .eq("scheduled_return_date", tomorrowStr)
      .eq("status", "scheduled_return")
      .is("deleted_at", null);

    const names = [
      ...new Set(
        (tomorrowReturns || [])
          .map((b: Record<string, unknown>) => {
            const c = b.clients;
            if (Array.isArray(c) && c[0]) return c[0].name as string;
            if (c && typeof c === "object" && c !== null && "name" in c)
              return (c as { name: string }).name;
            return undefined;
          })
          .filter(Boolean) as string[]
      ),
    ];
    setReturnClientNames(names);

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">Cargando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Total Stock"
          value={stats.totalStock}
          icon={Package}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatsCard
          label="Clientes"
          value={stats.totalClients}
          icon={Users}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
        <StatsCard
          label="Alertas Stock"
          value={stats.stockAlerts}
          icon={AlertTriangle}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <StatsCard
          label="En Papelera"
          value={stats.papeleraCount}
          icon={Trash2}
          iconColor="text-red-600"
          iconBg="bg-red-50"
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
