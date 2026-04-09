import { Bell } from "lucide-react";
import Link from "next/link";

interface AlertBannerProps {
  clientNames: string[];
}

export default function AlertBanner({ clientNames }: AlertBannerProps) {
  if (clientNames.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
          <Bell className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <p className="text-xs font-bold tracking-wider text-amber-600 uppercase">
            Recordatorio de salida (mañana)
          </p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">
            Hay devoluciones programadas para mañana:{" "}
            <span className="text-blue-600">
              {clientNames.join(", ")}
            </span>
          </p>
        </div>
      </div>
      <Link
        href="/agenda"
        className="px-4 py-2 text-sm font-bold border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
      >
        VER AGENDA
      </Link>
    </div>
  );
}
