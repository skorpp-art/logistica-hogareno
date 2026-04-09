"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ScanLine, Search, Package } from "lucide-react";
import type { Bulto, Client } from "@/lib/types/database";

type BultoResult = Bulto & { clients: Pick<Client, "name"> };

export default function EscanerPage() {
  const [barcode, setBarcode] = useState("");
  const [result, setResult] = useState<BultoResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return;

    setLoading(true);
    setNotFound(false);
    setResult(null);

    const supabase = createClient();
    const { data } = await supabase
      .from("bultos")
      .select("*, clients(name)")
      .eq("barcode", barcode.trim())
      .is("deleted_at", null)
      .single();

    if (data) {
      setResult(data as BultoResult);
    } else {
      setNotFound(true);
    }
    setLoading(false);
  };

  const handleMarkReturned = async () => {
    if (!result) return;
    const supabase = createClient();
    await supabase
      .from("bultos")
      .update({
        status: "returned",
        actual_return_date: new Date().toISOString().split("T")[0],
      })
      .eq("id", result.id);
    setResult(null);
    setBarcode("");
    alert("Bulto marcado como devuelto.");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Escáner</h1>

      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <ScanLine className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">
            Buscar bulto por código
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Ingresá el código de barras para buscar un bulto
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="text"
            placeholder="Código de barras..."
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-lg"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>
        </form>
      </div>

      {loading && <p className="text-center text-gray-400">Buscando...</p>}

      {notFound && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium">
            No se encontró ningún bulto con ese código
          </p>
        </div>
      )}

      {result && (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-bold text-gray-900">Bulto encontrado</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Cliente</p>
              <p className="font-medium text-gray-900">{result.clients?.name}</p>
            </div>
            <div>
              <p className="text-gray-500">Código</p>
              <p className="font-medium text-gray-900 font-mono">
                {result.barcode}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Descripción</p>
              <p className="font-medium text-gray-900">
                {result.description || "-"}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Estado</p>
              <span
                className={`text-xs font-bold px-2 py-1 rounded-full ${
                  result.status === "stored"
                    ? "bg-green-50 text-green-700"
                    : result.status === "scheduled_return"
                    ? "bg-amber-50 text-amber-700"
                    : result.status === "returned"
                    ? "bg-gray-100 text-gray-600"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {result.status === "stored"
                  ? "Almacenado"
                  : result.status === "scheduled_return"
                  ? "Retorno programado"
                  : result.status === "returned"
                  ? "Devuelto"
                  : result.status}
              </span>
            </div>
            <div>
              <p className="text-gray-500">Fecha ingreso</p>
              <p className="font-medium text-gray-900">{result.entry_date}</p>
            </div>
            <div>
              <p className="text-gray-500">Devolución programada</p>
              <p className="font-medium text-gray-900">
                {result.scheduled_return_date || "-"}
              </p>
            </div>
          </div>

          {result.status !== "returned" && (
            <button
              onClick={handleMarkReturned}
              className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              Marcar como devuelto
            </button>
          )}
        </div>
      )}
    </div>
  );
}
