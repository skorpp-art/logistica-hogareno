"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Settings2,
  Users,
  Calendar,
  ScanLine,
  Trash2,
  MessageSquare,
  LogOut,
  Package,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/control-general", label: "Control General", icon: LayoutDashboard },
  { href: "/control-operativo", label: "Control Operativo", icon: Settings2 },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/escaner", label: "Escáner", icon: ScanLine },
  { href: "/papelera", label: "Papelera", icon: Trash2 },
  { href: "/asistente", label: "Asistente", icon: MessageSquare },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <aside className="w-60 min-h-screen bg-gray-900 text-gray-300 flex flex-col">
      <div className="p-5 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <Package className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-sm tracking-wide">LOGÍSTICA</p>
          <p className="text-blue-400 font-bold text-xs tracking-wide">HOGAREÑO</p>
        </div>
      </div>

      <nav className="flex-1 mt-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white border-l-4 border-blue-400"
                  : "hover:bg-gray-800 hover:text-white border-l-4 border-transparent"
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg w-full transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
