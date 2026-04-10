"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Settings2,
  Users,
  Calendar,
  BookUser,
  Trash2,
  MessageSquare,
  LogOut,
  Package,
  ScanLine,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/control-general", label: "Control General", icon: LayoutDashboard },
  { href: "/control-operativo", label: "Control Operativo", icon: Settings2 },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/directorio", label: "Directorio", icon: BookUser },
  { href: "/escaner", label: "Escáner", icon: ScanLine },
  { href: "/papelera", label: "Papelera", icon: Trash2 },
  { href: "/asistente", label: "Asistente", icon: MessageSquare },
];

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const handleNavClick = () => {
    // Close sidebar on mobile after navigation
    onClose?.();
  };

  return (
    <aside className="w-[260px] min-h-screen bg-sidebar-bg flex flex-col relative overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-600/[0.03] via-transparent to-purple-600/[0.02] pointer-events-none" />

      {/* Logo */}
      <div className="relative z-10 px-6 pt-7 pb-5 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-extrabold text-[15px] tracking-wide">LOGISTICA</p>
            <p className="text-blue-400 text-[11px] font-bold tracking-[0.15em]">HOGARENO</p>
          </div>
        </div>
        {/* Close button - only on mobile */}
        <button
          onClick={onClose}
          className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Separator */}
      <div className="mx-6 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      {/* Navigation */}
      <nav className="relative z-10 flex-1 mt-5 px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavClick}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-medium transition-all duration-200 group relative ${
                isActive
                  ? "text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
              }`}
            >
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/90 to-blue-700/80 rounded-xl shadow-lg shadow-blue-600/20" />
              )}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-300 rounded-r-full" />
              )}
              <item.icon className={`w-[18px] h-[18px] relative z-10 transition-all duration-200 ${
                isActive ? "text-white" : "group-hover:scale-110 group-hover:text-blue-400"
              }`} />
              <span className="relative z-10">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="relative z-10 p-4 pb-5">
        <div className="mx-3 mb-3 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-slate-500 hover:text-red-400 hover:bg-red-500/[0.08] rounded-xl w-full transition-all duration-200 font-medium"
        >
          <LogOut className="w-[18px] h-[18px]" />
          Cerrar sesion
        </button>
      </div>
    </aside>
  );
}
