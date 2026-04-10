"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Search,
  BookUser,
  MapPin,
  Phone,
  Mail,
  Package,
  Calendar,
  ArrowRight,
  CheckCircle2,
  XCircle,
  X,
  Upload,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import type { Client, WeeklySchedule } from "@/lib/types/database";

interface ClientWithStats extends Client {
  bultos_count: number;
  returns_last_month: number;
}

interface ScheduleInfo extends WeeklySchedule {
  client_id: string;
}

interface ImportRow {
  name: string;
  nombre_fantasia?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

interface ImportResult {
  total: number;
  success: number;
  errors: string[];
}

const DAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];
const DAY_KEYS: (keyof Pick<WeeklySchedule, "dom" | "lun" | "mar" | "mie" | "jue" | "vie" | "sab">)[] = [
  "dom", "lun", "mar", "mie", "jue", "vie", "sab",
];

export default function DirectorioPage() {
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [schedules, setSchedules] = useState<ScheduleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientWithStats | null>(null);
  const [returnHistory, setReturnHistory] = useState<
    { id: string; entry_date: string; actual_return_date: string | null; tracking_id: string | null; description: string | null }[]
  >([]);

  // Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const supabase = createClient();

    const { data: clientsData } = await supabase
      .from("clients")
      .select("*, bultos(count)")
      .is("deleted_at", null)
      .order("name");

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const oneMonthAgoStr = oneMonthAgo.toISOString().split("T")[0];

    const { data: returnsData } = await supabase
      .from("bultos")
      .select("client_id")
      .eq("status", "returned")
      .gte("actual_return_date", oneMonthAgoStr);

    const returnCounts: Record<string, number> = {};
    (returnsData || []).forEach((r: { client_id: string }) => {
      returnCounts[r.client_id] = (returnCounts[r.client_id] || 0) + 1;
    });

    const mapped = (clientsData || []).map((c: Record<string, unknown>) => ({
      ...c,
      bultos_count:
        Array.isArray(c.bultos) && c.bultos[0]
          ? (c.bultos[0] as { count: number }).count
          : 0,
      returns_last_month: returnCounts[c.id as string] || 0,
    })) as ClientWithStats[];

    setClients(mapped);

    const { data: schedulesData } = await supabase
      .from("weekly_schedules")
      .select("*");

    setSchedules((schedulesData || []) as ScheduleInfo[]);
    setLoading(false);
  };

  const openClientDetail = async (client: ClientWithStats) => {
    setSelectedClient(client);

    const supabase = createClient();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const oneMonthAgoStr = oneMonthAgo.toISOString().split("T")[0];

    const { data } = await supabase
      .from("bultos")
      .select("id, entry_date, actual_return_date, tracking_id, description")
      .eq("client_id", client.id)
      .eq("status", "returned")
      .gte("actual_return_date", oneMonthAgoStr)
      .order("actual_return_date", { ascending: false });

    setReturnHistory(data || []);
  };

  const getSchedule = (clientId: string) => {
    return schedules.find((s) => s.client_id === clientId);
  };

  const formatDate = (d: string) => {
    const parts = d.split("-");
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // ============ EXPORT ============
  const handleExport = async () => {
    const XLSX = await import("xlsx");

    const exportData = clients.map((c, i) => ({
      "N°": i + 1,
      "Nombre Fantasía": c.nombre_fantasia || "",
      "NOMBRE PRINCIPAL": c.name,
      "Dirección / Localidad": c.address || "",
      Teléfono: c.phone || "",
      Email: c.email || "",
      Notas: c.notes || "",
      "Stock Actual": c.bultos_count,
      "Devoluciones (30d)": c.returns_last_month,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);

    // Column widths
    ws["!cols"] = [
      { wch: 25 }, { wch: 25 }, { wch: 18 }, { wch: 28 },
      { wch: 35 }, { wch: 20 }, { wch: 14 }, { wch: 18 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, `clientes_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // ============ IMPORT ============
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const XLSX = await import("xlsx");
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

    // Map Excel columns to our fields (flexible mapping)
    // Supports: "NOMBRE PRINCIPAL", "Nombre Fantasía", "Dirección / Localidad", etc.
    const rows: ImportRow[] = jsonData
      .map((row) => {
        // Find the name - try many possible column names
        const name =
          (row["NOMBRE PRINCIPAL"] as string) ||
          (row["Nombre Principal"] as string) ||
          (row["nombre principal"] as string) ||
          (row["Nombre"] as string) ||
          (row["nombre"] as string) ||
          (row["Name"] as string) ||
          (row["name"] as string) ||
          (row["NOMBRE"] as string) ||
          (row["Razon Social"] as string) ||
          (row["RAZON SOCIAL"] as string) ||
          (row["razon_social"] as string) ||
          (row["Cliente"] as string) ||
          (row["CLIENTE"] as string) ||
          "";

        if (!name.trim()) return null;

        // Skip header rows that got parsed as data
        const nameLower = name.toLowerCase();
        if (nameLower === "nombre principal" || nameLower === "nombre" || nameLower === "cliente") return null;

        return {
          name: name.trim(),
          nombre_fantasia:
            ((row["Nombre Fantasía"] as string) ||
            (row["Nombre Fantasia"] as string) ||
            (row["NOMBRE FANTASIA"] as string) ||
            (row["nombre_fantasia"] as string) ||
            (row["Nombre fantasía"] as string) ||
            (row["Fantasia"] as string) ||
            (row["fantasia"] as string) ||
            (row["FANTASIA"] as string) ||
            "") || undefined,
          phone:
            String(
              row["Teléfono"] || row["Telefono"] || row["TELEFONO"] ||
              row["telefono"] || row["Phone"] || row["phone"] ||
              row["Tel"] || row["TEL"] || row["Cel"] || row["cel"] ||
              row["Celular"] || row["CELULAR"] || ""
            ).trim() || undefined,
          email:
            ((row["Email"] as string) ||
            (row["email"] as string) ||
            (row["EMAIL"] as string) ||
            (row["E-mail"] as string) ||
            (row["e-mail"] as string) ||
            (row["Correo"] as string) ||
            (row["correo"] as string) ||
            "") || undefined,
          address:
            ((row["Dirección / Localidad"] as string) ||
            (row["Direccion / Localidad"] as string) ||
            (row["DIRECCION / LOCALIDAD"] as string) ||
            (row["Dirección"] as string) ||
            (row["Direccion"] as string) ||
            (row["direccion"] as string) ||
            (row["DIRECCION"] as string) ||
            (row["Address"] as string) ||
            (row["Domicilio"] as string) ||
            (row["DOMICILIO"] as string) ||
            (row["Localidad"] as string) ||
            (row["LOCALIDAD"] as string) ||
            "") || undefined,
          notes:
            ((row["Notas"] as string) ||
            (row["notas"] as string) ||
            (row["NOTAS"] as string) ||
            (row["Observaciones"] as string) ||
            (row["OBSERVACIONES"] as string) ||
            "") || undefined,
        };
      })
      .filter(Boolean) as ImportRow[];

    setImportPreview(rows);
    setImportResult(null);
    setShowImportModal(true);

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImportConfirm = async () => {
    if (importPreview.length === 0) return;

    setImporting(true);
    const supabase = createClient();
    const errors: string[] = [];
    let success = 0;

    for (const row of importPreview) {
      const { error } = await supabase.from("clients").insert({
        name: row.name,
        nombre_fantasia: row.nombre_fantasia || null,
        phone: row.phone || null,
        email: row.email || null,
        address: row.address || null,
        notes: row.notes || null,
      });

      if (error) {
        errors.push(`${row.name}: ${error.message}`);
      } else {
        success++;
      }
    }

    setImportResult({ total: importPreview.length, success, errors });
    setImporting(false);

    if (success > 0) {
      fetchData();
    }
  };

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.nombre_fantasia &&
        c.nombre_fantasia.toLowerCase().includes(search.toLowerCase())) ||
      (c.address && c.address.toLowerCase().includes(search.toLowerCase())) ||
      (c.phone && c.phone.toLowerCase().includes(search.toLowerCase())) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
            Directorio de Clientes
          </h1>
          <p className="text-sm text-muted font-medium">
            Consulta de datos, historial de devoluciones y agenda
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Import button */}
          <label className="flex items-center gap-2 px-3 sm:px-4 py-2.5 card-base !rounded-xl cursor-pointer hover:border-accent/30 text-[12px] font-bold text-foreground">
            <Upload className="w-4 h-4 text-accent" />
            <span className="hidden sm:inline">Importar Excel</span>
            <span className="sm:hidden">Importar</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
          {/* Export button */}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-[12px] font-bold hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-200"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar Excel</span>
            <span className="sm:hidden">Exportar</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          type="text"
          placeholder="Buscar por nombre, fantasia, direccion, telefono o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 pr-4 py-3 text-[13px] border border-card-border rounded-xl w-full bg-card text-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent/30 placeholder:text-muted/50"
        />
      </div>

      {/* Client List */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-base p-12 text-center">
          <BookUser className="w-12 h-12 text-muted mx-auto mb-3" />
          <p className="text-muted font-medium">No se encontraron clientes</p>
        </div>
      ) : (
        <div className="card-base overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-card-border">
                {["Cliente", "Contacto", "Stock Actual", "Devoluciones (30d)", "Agenda", "Detalle"].map((h, i) => (
                  <th key={h} className={`${i < 2 ? "text-left" : "text-center"} text-[10px] font-bold text-muted uppercase tracking-wider px-6 py-3.5`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => {
                const schedule = getSchedule(client.id);
                return (
                  <tr
                    key={client.id}
                    className="border-b border-card-border/30 hover:bg-accent/[0.03] cursor-pointer transition-colors duration-200"
                    onClick={() => openClientDetail(client)}
                  >
                    <td className="px-6 py-4">
                      <p className="text-[13px] font-bold text-foreground uppercase">
                        {client.name}
                      </p>
                      {client.nombre_fantasia && (
                        <p className="text-[11px] text-muted uppercase">
                          {client.nombre_fantasia}
                        </p>
                      )}
                      {client.address && (
                        <div className="flex items-center gap-1 mt-1 text-[11px] text-muted">
                          <MapPin className="w-3 h-3" />
                          {client.address}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {client.phone && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted mb-1">
                          <Phone className="w-3 h-3" />
                          {client.phone}
                        </div>
                      )}
                      {client.email && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted">
                          <Mail className="w-3 h-3" />
                          {client.email}
                        </div>
                      )}
                      {!client.phone && !client.email && (
                        <span className="text-[11px] text-muted">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-block text-[11px] font-bold px-3 py-1.5 rounded-full ${
                          client.bultos_count > 0
                            ? "bg-blue-600 text-white"
                            : "bg-accent/[0.06] text-muted"
                        }`}
                      >
                        {client.bultos_count}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-block text-[11px] font-bold px-3 py-1.5 rounded-full ${
                          client.returns_last_month > 0
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-accent/[0.06] text-muted"
                        }`}
                      >
                        {client.returns_last_month}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {schedule ? (
                        <div className="flex items-center justify-center gap-0.5">
                          {DAY_LABELS.map((label, i) => {
                            const key = DAY_KEYS[i];
                            const isActive = schedule[key];
                            return (
                              <div
                                key={i}
                                className={`w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center ${
                                  isActive
                                    ? "bg-blue-600 text-white"
                                    : "bg-accent/[0.06] text-muted"
                                }`}
                              >
                                {label}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted">Sin agenda</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <ArrowRight className="w-4 h-4 text-muted mx-auto" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-card-border shadow-xl w-full max-w-3xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden animate-scale-in flex flex-col mx-2">
            {/* Modal header */}
            <div className="flex items-center justify-between p-6 border-b border-card-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-[15px] font-bold text-foreground">Importar Clientes</h2>
                  <p className="text-[11px] text-muted">
                    {importResult
                      ? `Importación completada`
                      : `${importPreview.length} clientes detectados en el archivo`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowImportModal(false); setImportPreview([]); setImportResult(null); }}
                className="p-1.5 text-muted hover:text-foreground rounded-lg hover:bg-accent/10 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Import result */}
            {importResult ? (
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                    <CheckCircle className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xl font-extrabold text-foreground">{importResult.success} de {importResult.total}</p>
                    <p className="text-[13px] text-muted">clientes importados correctamente</p>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="bg-red-500/[0.06] border border-red-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <p className="text-[12px] font-bold text-red-400">Errores ({importResult.errors.length})</p>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {importResult.errors.map((err, i) => (
                        <p key={i} className="text-[11px] text-red-400/80">{err}</p>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => { setShowImportModal(false); setImportPreview([]); setImportResult(null); }}
                  className="w-full py-3 bg-accent text-white rounded-xl text-[13px] font-bold hover:bg-accent/90 transition-all"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <>
                {/* Preview table */}
                <div className="flex-1 overflow-auto p-6">
                  {importPreview.length === 0 ? (
                    <div className="text-center py-10">
                      <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                      <p className="text-[13px] text-muted font-medium">
                        No se encontraron clientes en el archivo.
                      </p>
                      <p className="text-[11px] text-muted mt-1">
                        Asegurate de que el Excel tenga una columna &quot;Nombre&quot; o &quot;Name&quot;.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="border-b border-card-border">
                            <th className="text-left font-bold text-muted uppercase tracking-wider pb-2 pr-3">#</th>
                            <th className="text-left font-bold text-muted uppercase tracking-wider pb-2 pr-3">Nombre</th>
                            <th className="text-left font-bold text-muted uppercase tracking-wider pb-2 pr-3">Fantasía</th>
                            <th className="text-left font-bold text-muted uppercase tracking-wider pb-2 pr-3">Teléfono</th>
                            <th className="text-left font-bold text-muted uppercase tracking-wider pb-2 pr-3">Email</th>
                            <th className="text-left font-bold text-muted uppercase tracking-wider pb-2">Dirección</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.map((row, i) => (
                            <tr key={i} className="border-b border-card-border/30">
                              <td className="py-2.5 pr-3 text-muted font-mono">{i + 1}</td>
                              <td className="py-2.5 pr-3 font-semibold text-foreground">{row.name}</td>
                              <td className="py-2.5 pr-3 text-muted">{row.nombre_fantasia || "-"}</td>
                              <td className="py-2.5 pr-3 text-muted">{row.phone || "-"}</td>
                              <td className="py-2.5 pr-3 text-muted">{row.email || "-"}</td>
                              <td className="py-2.5 text-muted truncate max-w-[200px]">{row.address || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Modal footer */}
                {importPreview.length > 0 && (
                  <div className="flex items-center justify-between p-6 border-t border-card-border">
                    <p className="text-[12px] text-muted">
                      Se importarán <span className="font-bold text-foreground">{importPreview.length}</span> clientes
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => { setShowImportModal(false); setImportPreview([]); }}
                        className="px-5 py-2.5 text-[12px] font-semibold text-muted hover:text-foreground transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleImportConfirm}
                        disabled={importing}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-[12px] font-bold hover:shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50 transition-all"
                      >
                        {importing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Importando...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            Confirmar Importación
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Client Detail Modal */}
      {selectedClient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-card-border shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-[15px] font-bold text-foreground uppercase">
                    {selectedClient.name}
                  </h2>
                  {selectedClient.nombre_fantasia && (
                    <p className="text-[11px] text-muted uppercase">
                      {selectedClient.nombre_fantasia}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                className="p-1.5 text-muted hover:text-foreground rounded-lg hover:bg-accent/10 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Client Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {[
                { icon: MapPin, label: "Dirección", value: selectedClient.address || "No registrada" },
                { icon: Phone, label: "Teléfono", value: selectedClient.phone || "No registrado" },
                { icon: Mail, label: "Email", value: selectedClient.email || "No registrado" },
                { icon: Package, label: "Stock Actual", value: `${selectedClient.bultos_count} bultos en deposito`, highlight: true },
              ].map((item) => (
                <div key={item.label} className="bg-background rounded-xl p-4">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                    {item.label}
                  </p>
                  <div className="flex items-center gap-1.5 text-[13px] text-foreground">
                    <item.icon className={`w-3.5 h-3.5 ${item.highlight ? 'text-blue-500' : 'text-muted'}`} />
                    {item.highlight ? (
                      <span><span className="font-extrabold">{selectedClient.bultos_count}</span> bultos en deposito</span>
                    ) : (
                      <span className="font-medium">{item.value}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Agenda */}
            {(() => {
              const schedule = getSchedule(selectedClient.id);
              if (!schedule) return (
                <div className="bg-background rounded-xl p-4 mb-6">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
                    Agenda Semanal
                  </p>
                  <p className="text-[13px] text-muted">No tiene agenda de devoluciones configurada</p>
                </div>
              );

              const todayIndex = new Date().getDay();
              const todayKey = DAY_KEYS[todayIndex];
              const isTodayScheduled = schedule[todayKey];

              return (
                <div className="bg-background rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
                      Agenda Semanal
                    </p>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${schedule.active ? "bg-emerald-500/15 text-emerald-400" : "bg-accent/[0.06] text-muted"}`}>
                      {schedule.active ? "ACTIVO" : "PAUSADO"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    {DAY_LABELS.map((label, i) => {
                      const key = DAY_KEYS[i];
                      const isActive = schedule[key];
                      return (
                        <div
                          key={i}
                          className={`w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold ${
                            isActive
                              ? "bg-blue-600 text-white"
                              : "bg-accent/[0.06] text-muted"
                          }`}
                        >
                          {label}
                        </div>
                      );
                    })}
                  </div>
                  {isTodayScheduled && (
                    <div className="flex items-center gap-2 text-[13px]">
                      <Calendar className="w-4 h-4 text-amber-500" />
                      <span className="font-semibold text-amber-500">Hoy es dia de devolucion programada</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Returns last month */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
                  Devoluciones ultimo mes ({returnHistory.length})
                </p>
              </div>
              {returnHistory.length === 0 ? (
                <p className="text-[13px] text-muted py-4 text-center">
                  No se registraron devoluciones en los ultimos 30 dias
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {returnHistory.map((r) => {
                    const schedule = getSchedule(selectedClient.id);
                    let onSchedule: boolean | null = null;
                    if (schedule && r.actual_return_date) {
                      const returnDate = new Date(r.actual_return_date + "T12:00:00");
                      const dayIndex = returnDate.getDay();
                      const dayKey = DAY_KEYS[dayIndex];
                      onSchedule = schedule[dayKey];
                    }

                    return (
                      <div
                        key={r.id}
                        className="flex items-center justify-between p-3 bg-background rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <Package className="w-4 h-4 text-muted" />
                          <div>
                            <p className="text-[12px] font-bold text-foreground">
                              {r.tracking_id || r.description || "Sin ID"}
                            </p>
                            <p className="text-[10px] text-muted">
                              Devuelto: {r.actual_return_date ? formatDate(r.actual_return_date) : "-"}
                            </p>
                          </div>
                        </div>
                        {onSchedule !== null && (
                          <div className="flex items-center gap-1">
                            {onSchedule ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                EN AGENDA
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500">
                                <XCircle className="w-3.5 h-3.5" />
                                FUERA DE AGENDA
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
