"use client";

import { useEffect, useState } from "react";
import { Download, X, Share, Plus } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWA() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    // Registrar el service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const installed =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error - standalone es propio de Safari iOS
      window.navigator.standalone === true;
    const dismissed = localStorage.getItem("pwa-dismissed");

    // Detectar iOS (Safari no dispara beforeinstallprompt)
    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    setIsIos(ios);

    if (ios && !installed && !dismissed) {
      setShow(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      if (!installed && !dismissed) setShow(true);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setShow(false));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const install = async () => {
    if (isIos) {
      setShowIosHelp(true);
      return;
    }
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setShow(false);
  };

  const dismiss = () => {
    setShow(false);
    setShowIosHelp(false);
    localStorage.setItem("pwa-dismissed", "1");
  };

  if (!show) return null;

  // Ayuda paso a paso para iPhone/iPad
  if (showIosHelp) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[70] p-4">
        <div className="bg-card border border-card-border rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-scale-in">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[15px] font-bold text-foreground">Instalar en iPhone</p>
            <button onClick={dismiss} className="p-1 text-muted hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
          <ol className="space-y-3 text-[13px] text-foreground">
            <li className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
              Tocá el botón <Share className="w-4 h-4 inline text-blue-500" /> <b>Compartir</b> (abajo en Safari)
            </li>
            <li className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
              Bajá y tocá <Plus className="w-4 h-4 inline text-blue-500" /> <b>Agregar a inicio</b>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">3</span>
              Tocá <b>Agregar</b> arriba a la derecha
            </li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[60] animate-fade-in">
      <div className="bg-card border border-card-border rounded-2xl shadow-2xl p-4 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
          <Download className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-foreground">Instalar la app</p>
          <p className="text-[11px] text-muted">Agregala a tu celular como una app</p>
        </div>
        <button
          onClick={install}
          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-[12px] font-bold hover:bg-blue-700 transition-colors shrink-0"
        >
          Instalar
        </button>
        <button onClick={dismiss} className="p-1 text-muted hover:text-foreground shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
