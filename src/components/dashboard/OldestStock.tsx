import { Clock, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { OldestStockItem } from "@/lib/types/database";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface OldestStockProps {
  items: OldestStockItem[];
}

export default function OldestStock({ items }: OldestStockProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-red-500" />
        <h2 className="text-xs font-bold tracking-wider text-gray-700 uppercase">
          Stock Más Antiguo
        </h2>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                  index === 0
                    ? "bg-red-500"
                    : index === 1
                    ? "bg-orange-500"
                    : index === 2
                    ? "bg-yellow-500"
                    : "bg-gray-400"
                }`}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {item.client_name}
                </p>
                <p className="text-xs text-red-500">
                  Desde: {format(new Date(item.entry_date), "dd/MM/yyyy", { locale: es })}
                </p>
              </div>
            </div>
            <Link
              href={`/clientes`}
              className="text-gray-400 hover:text-blue-600 transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-center py-4 text-sm text-gray-400">
            No hay stock registrado
          </p>
        )}
      </div>
    </div>
  );
}
