"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Calendar,
  Plus,
  Trash2,
  Clock,
  Bell,
  X,
  ChevronDown,
} from "lucide-react";
import type { Client, WeeklySchedule } from "@/lib/types/database";

const DAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];
const DAY_KEYS: (keyof Pick<WeeklySchedule, "dom" | "lun" | "mar" | "mie" | "jue" | "vie" | "sab">)[] = [
  "dom", "lun", "mar", "mie", "jue", "vie", "sab",
];
const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

interface ScheduleWithClient extends WeeklySchedule {
  clients: { name: string; nombre_fantasia: string | null };
}

export default function AgendaPage() {
  const [schedules, setSchedules] = useState<ScheduleWithClient[]>([]);
  const [clients, setClients] = useState<Pick<Client, "id" | "name" | "nombre_fantasia">[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedDays, setSelectedDays] = useState<boolean[]>([false, false, false, false, false, false, false]);
  const [saving, setSaving] = useState(false);
  const [tomorrowClients, setTomorrowClients] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const supabase = createClient();

    const [{ data: schedulesData }, { data: clientsData }] = await Promise.all([
      supabase
        .from("weekly_schedules")
        .select("*, clients(name, nombre_fantasia)")
        .order("created_at", { ascending: false }),
      supabase
        .from("clients")
        .select("id, name, nombre_fantasia")
        .is("deleted_at", null)
        .order("name"),
    ]);

    const mapped = (schedulesData || []) as ScheduleWithClient[];
    setSchedules(mapped);
    setClients(clientsData || []);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDayIndex = tomorrow.getDay();
    const tomorrowKey = DAY_KEYS[tomorrowDayIndex];

    const tomorrowNames = mapped
      .filter((s) => s.active && s[tomorrowKey])
      .map((s) => {
        const c = s.clients;
        if (Array.isArray(c) && c[0]) return (c[0] as { name: string }).name;
        if (c && typeof c === "object" && "name" in c) return c.name;
        return "";
      })
      .filter(Boolean);

    setTomorrowClients(tomorrowNames);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta programación?")) return;
    const supabase = createClient();
    await supabase.from("weekly_schedules").delete().eq("id", id);
    fetchData();
  };

  const handleToggleActive = async (schedule: ScheduleWithClient) => {
    const supabase = createClient();
    await supabase
      .from("weekly_schedules")
      .update({ active: !schedule.active, updated_at: new Date().toISOString() })
      .eq("id", schedule.id);
    fetchData();
  };

  const openNewModal = () => {
    setSelectedClientId("");
    setSelectedDays([false, false, false, false, false, false, false]);
    setShowModal(true);
  };

  const toggleDay = (index: number) => {
    setSelectedDays((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !selectedDays.some(Boolean)) return;

    setSaving(true);
    const supabase = createClient();

    const payload = {
      client_id: selectedClientId,
      dom: selectedDays[0],
      lun: selectedDays[1],
      mar: selectedDays[2],
      mie: selectedDays[3],
      jue: selectedDays[4],
      vie: selectedDays[5],
      sab: selectedDays[6],
      active: true,
    };

    const existing = schedules.find((s) => s.client_id === selectedClientId);
    if (existing) {
      await supabase
        .from("weekly_schedules")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase.from("weekly_schedules").insert(payload);
    }

    setSaving(false);
    setShowModal(false);
    fetchData();
  };

  const getActiveDays = (schedule: WeeklySchedule): string[] => {
    return DAY_KEYS
      .map((key, i) => (schedule[key] ? DAY_NAMES[i] : null))
      .filter(Boolean) as string[];
  };

  const availableClients = clients.filter(
    (c) => !schedules.some((s) => s.client_id === c.id)
  );

  const getClientName = (schedule: ScheduleWithClient): string => {
    const c = schedule.clients;
    if (Array.isArray(c) && c[0]) return (c[0] as { name: string }).name;
    if (c && typeof c === "object" && "name" in c) return c.name;
    return "Cliente";
  };

  const getClientFantasia = (schedule: ScheduleWithClient): string | null => {
    const c = schedule.clients;
    if (Array.isArray(c) && c[0]) return (c[0] as { nombre_fantasia: string | null }).nombre_fantasia;
    if (c && typeof c === "object" && "nombre_fantasia" in c) return c.nombre_fantasia;
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Agenda de Devoluciones
          </h1>
          <p className="text-sm text-muted uppercase tracking-wider font-medium">
            Planificacion y recordatorios de salida
          </p>
        </div>
        <button
          onClick={openNewModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all duration-200 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nueva Programacion
        </button>
      </div>

      {/* 24hr Reminder Cards */}
      {tomorrowClients.length > 0 && (
        <div className="space-y-3">
          {tomorrowClients.map((name, i) => (
            <div
              key={i}
              className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-4"
            >
              <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Bell className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold tracking-widest text-amber-500 uppercase">
                  Recordatorio 24hs
                </p>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  Manana sale devolucion para{" "}
                  <span className="text-blue-600">{name}</span>
                </p>
              </div>
              <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* Schedules Grid */}
      {loading ? (
        <p className="text-muted text-sm">Cargando...</p>
      ) : schedules.length === 0 ? (
        <div className="bg-card rounded-2xl border border-card-border p-12 text-center">
          <Calendar className="w-12 h-12 text-muted mx-auto mb-3" />
          <p className="text-muted">No hay programaciones configuradas</p>
          <p className="text-xs text-muted mt-1">
            Usa el boton &quot;Nueva Programacion&quot; para agendar devoluciones semanales
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {schedules.map((schedule) => {
            const clientName = getClientName(schedule);
            const fantasia = getClientFantasia(schedule);

            return (
              <div
                key={schedule.id}
                className="bg-card rounded-2xl border border-card-border p-5 hover:border-accent/30 transition-all duration-300 animate-fade-in"
              >
                {/* Top: Name + actions */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wide truncate">
                      {clientName}
                    </h3>
                    {fantasia && (
                      <p className="text-xs text-muted font-medium mt-0.5 uppercase truncate">
                        {fantasia}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <button
                      onClick={() => handleToggleActive(schedule)}
                      className={`text-[10px] font-bold px-3 py-1 rounded-full transition-colors ${
                        schedule.active
                          ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                          : "bg-accent/10 text-muted hover:bg-accent/20"
                      }`}
                    >
                      {schedule.active ? "ACTIVO" : "PAUSADO"}
                    </button>
                    <button
                      onClick={() => handleDelete(schedule.id)}
                      className="p-1.5 text-muted hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Day selector (read-only display) */}
                <div className="flex items-center gap-1.5">
                  {DAY_LABELS.map((label, i) => {
                    const key = DAY_KEYS[i];
                    const isActive = schedule[key];
                    return (
                      <div
                        key={i}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                          isActive
                            ? "bg-blue-600 text-white"
                            : "bg-accent/10 text-muted"
                        }`}
                      >
                        {label}
                      </div>
                    );
                  })}
                </div>

                {/* Active days summary */}
                <p className="text-[10px] text-muted mt-3 uppercase tracking-wider">
                  {getActiveDays(schedule).join(" · ")}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Nueva Programacion */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-card-border shadow-xl w-full max-w-md p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-foreground" />
                <h2 className="text-lg font-bold text-foreground">
                  Nueva Programacion
                </h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-muted hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              {/* Client selector */}
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                  Cliente
                </label>
                <div className="relative">
                  <select
                    required
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-card-border rounded-xl text-sm bg-background text-foreground focus:ring-2 focus:ring-accent/40 focus:border-transparent appearance-none pr-10"
                  >
                    <option value="">Seleccionar cliente...</option>
                    {availableClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.nombre_fantasia ? ` (${c.nombre_fantasia})` : ""}
                      </option>
                    ))}
                    {schedules.map((s) => (
                      <option key={s.client_id} value={s.client_id}>
                        {getClientName(s)} (editar)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                </div>
              </div>

              {/* Day of week selector */}
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
                  Dias de devolucion
                </label>
                <div className="flex items-center gap-2">
                  {DAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${
                        selectedDays[i]
                          ? "bg-blue-600 text-white shadow-sm scale-105"
                          : "bg-accent/10 text-muted hover:bg-accent/20"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted mt-2">
                  Selecciona los dias en que se programa la devolucion
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !selectedClientId || !selectedDays.some(Boolean)}
                  className="flex-1 py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Guardando..." : "Guardar Programacion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
