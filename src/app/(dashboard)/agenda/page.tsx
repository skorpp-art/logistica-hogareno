"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Calendar, Plus, Check } from "lucide-react";
import type { Client } from "@/lib/types/database";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface AgendaEventRow {
  id: string;
  client_id: string;
  event_type: string;
  scheduled_date: string;
  notes: string | null;
  completed: boolean;
  clients: { name: string };
}

export default function AgendaPage() {
  const [events, setEvents] = useState<AgendaEventRow[]>([]);
  const [clients, setClients] = useState<Pick<Client, "id" | "name">[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    client_id: "",
    event_type: "return",
    scheduled_date: "",
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const supabase = createClient();
    const { data: eventsData } = await supabase
      .from("agenda_events")
      .select("*, clients(name)")
      .eq("completed", false)
      .order("scheduled_date");

    setEvents((eventsData as AgendaEventRow[]) || []);

    const { data: clientsData } = await supabase
      .from("clients")
      .select("id, name")
      .is("deleted_at", null)
      .order("name");

    setClients(clientsData || []);
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    await supabase.from("agenda_events").insert({
      client_id: form.client_id,
      event_type: form.event_type,
      scheduled_date: form.scheduled_date,
      notes: form.notes || null,
    });
    setForm({ client_id: "", event_type: "return", scheduled_date: "", notes: "" });
    setShowForm(false);
    fetchData();
  };

  const handleComplete = async (id: string) => {
    const supabase = createClient();
    await supabase.from("agenda_events").update({ completed: true }).eq("id", id);
    fetchData();
  };

  const eventTypeLabel = (type: string) => {
    switch (type) {
      case "return":
        return "Devolución";
      case "pickup":
        return "Retiro";
      default:
        return "Otro";
    }
  };

  // Group events by date
  const grouped = events.reduce<Record<string, AgendaEventRow[]>>((acc, ev) => {
    if (!acc[ev.scheduled_date]) acc[ev.scheduled_date] = [];
    acc[ev.scheduled_date].push(ev);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Evento
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-white rounded-xl shadow-sm p-6 space-y-4"
        >
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cliente *
              </label>
              <select
                required
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seleccionar...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo
              </label>
              <select
                value={form.event_type}
                onChange={(e) => setForm({ ...form, event_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="return">Devolución</option>
                <option value="pickup">Retiro</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha *
              </label>
              <input
                type="date"
                required
                value={form.scheduled_date}
                onChange={(e) =>
                  setForm({ ...form, scheduled_date: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas
            </label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Agregar
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-400">Cargando...</p>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay eventos programados</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, evts]) => (
              <div key={date} className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-sm font-bold text-gray-700 mb-3">
                  {format(new Date(date + "T12:00:00"), "EEEE d 'de' MMMM, yyyy", {
                    locale: es,
                  })}
                </h3>
                <div className="space-y-2">
                  {evts.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {ev.clients?.name} —{" "}
                          <span className="text-blue-600">
                            {eventTypeLabel(ev.event_type)}
                          </span>
                        </p>
                        {ev.notes && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {ev.notes}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleComplete(ev.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors font-medium"
                      >
                        <Check className="w-3 h-3" />
                        Completar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
