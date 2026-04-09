import { ArrowRight, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { TopClient } from "@/lib/types/database";

interface TopClientsTableProps {
  clients: TopClient[];
}

export default function TopClientsTable({ clients }: TopClientsTableProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-blue-500" />
        <h2 className="text-xs font-bold tracking-wider text-gray-700 uppercase">
          Top 5 Clientes (Mayor Volumen)
        </h2>
      </div>

      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left text-xs font-bold text-gray-500 pb-3 uppercase tracking-wider">
              Cliente
            </th>
            <th className="text-center text-xs font-bold text-gray-500 pb-3 uppercase tracking-wider">
              Bultos
            </th>
            <th className="text-center text-xs font-bold text-gray-500 pb-3 uppercase tracking-wider">
              Acción
            </th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client, index) => (
            <tr key={client.id} className="border-b border-gray-50">
              <td className="py-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-6">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {client.name}
                    </p>
                    {client.notes && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {client.notes}
                      </p>
                    )}
                  </div>
                </div>
              </td>
              <td className="text-center">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-50 text-blue-700 rounded-full text-sm font-bold">
                  {client.bultos_count}
                </span>
              </td>
              <td className="text-center">
                <Link
                  href={`/clientes/${client.id}`}
                  className="inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </td>
            </tr>
          ))}
          {clients.length === 0 && (
            <tr>
              <td colSpan={3} className="text-center py-8 text-sm text-gray-400">
                No hay clientes con bultos almacenados
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
