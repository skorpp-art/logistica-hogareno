"use client";

import { Search, Moon, Sun, Menu } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";

interface HeaderProps {
  onMenuToggle?: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/clientes?q=${encodeURIComponent(search.trim())}`);
    }
  };

  return (
    <header className="h-[56px] bg-card/80 glass border-b border-card-border/50 flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-30 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger menu - mobile only */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 -ml-1 text-muted hover:text-foreground hover:bg-accent/10 rounded-xl transition-all"
        >
          <Menu className="w-5 h-5" />
        </button>

        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-[11px] font-semibold tracking-[0.15em] text-muted uppercase hidden sm:inline">
          Terminal Operativa
        </span>
        <div className="w-px h-3.5 bg-card-border hidden sm:block" />
        <span className="text-[11px] font-semibold tracking-wider text-accent hidden sm:inline">
          Cloud Sync
        </span>
      </div>

      <div className="flex items-center gap-2">
        <form onSubmit={handleSearch} className="relative hidden sm:block">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition-colors duration-200 ${focused ? 'text-accent' : 'text-muted'}`} />
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className={`pl-9 pr-4 py-2 text-[13px] bg-background/60 border rounded-xl text-foreground placeholder:text-muted/60 transition-all duration-300 ${
              focused ? 'border-accent/40 shadow-[0_0_0_3px] shadow-accent/10 w-64' : 'border-card-border w-48 lg:w-56'
            }`}
          />
        </form>

        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl text-muted hover:text-foreground hover:bg-accent/10 transition-all duration-200 group"
          title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 group-hover:rotate-45 transition-transform duration-300" />
          ) : (
            <Moon className="w-4 h-4 group-hover:-rotate-12 transition-transform duration-300" />
          )}
        </button>
      </div>
    </header>
  );
}
