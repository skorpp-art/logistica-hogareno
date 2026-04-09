import { createClient } from "@/lib/supabase/server";
import StatsCard from "@/components/dashboard/StatsCard";
import AlertBanner from "@/components/dashboard/AlertBanner";
import TopClientsTable from "@/components/dashboard/TopClientsTable";
import OldestStock from "@/components/dashboard/OldestStock";
import { Package, Users, AlertTriangle, Trash2 } from "lucide-react";

export default async function ControlGeneralPage() {
  const supabase = await createClient();

  // Fetch dashboard stats
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

  // Fetch top clients
  const { data: topClients } = await supabase
    .rpc("get_top_clients", { limit_count: 5 });

  // Fetch oldest stock
  const { data: oldestStock } = await supabase
    .rpc("get_oldest_stock", { limit_count: 5 });

  // Fetch tomorrow's returns
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const { data: tomorrowReturns } = await supabase
    .from("bultos")
    .select("id, clients(name)")
    .eq("scheduled_return_date", tomorrowStr)
    .eq("status", "scheduled_return")
    .is("deleted_at", null);

  const returnClientNames = [
    ...new Set(
      (tomorrowReturns || [])
        .map((b: Record<string, unknown>) => {
          const c = b.clients;
          if (Array.isArray(c) && c[0]) return c[0].name as string;
          if (c && typeof c === "object" && "name" in c) return (c as { name: string }).name;
          return undefined;
        })
        .filter(Boolean) as string[]
    ),
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Total Stock"
          value={totalStock || 0}
          icon={Package}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatsCard
          label="Clientes"
          value={totalClients || 0}
          icon={Users}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
        <StatsCard
          label="Alertas Stock"
          value={stockAlerts || 0}
          icon={AlertTriangle}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <StatsCard
          label="En Papelera"
          value={papeleraCount || 0}
          icon={Trash2}
          iconColor="text-red-600"
          iconBg="bg-red-50"
        />
      </div>

      {/* Alert Banner */}
      <AlertBanner clientNames={returnClientNames} />

      {/* Bottom section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TopClientsTable clients={topClients || []} />
        </div>
        <div>
          <OldestStock items={oldestStock || []} />
        </div>
      </div>
    </div>
  );
}
