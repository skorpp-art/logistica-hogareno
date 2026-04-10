"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ScanLine,
  Package,
  User,
  MapPin,
  Camera,
  Phone,
  Truck,
  Hash,
  Save,
  CheckCircle,
  ImagePlus,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Eye,
  MapPinned,
  Building2,
  Calendar,
  Scale,
  FileText,
  Search,
  QrCode,
  Users,
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================

interface LabelPhoto {
  id: string;
  file: File;
  preview: string;
  status: "pending" | "processing" | "done" | "error";
  extracted?: ExtractedLabel;
  error?: string;
  clientId?: string;
}

interface ExtractedLabel {
  destinatario: string;
  direccion_completa: string;
  calle: string;
  localidad: string;
  partido: string;
  provincia: string;
  codigo_postal: string;
  numero_envio: string;
  pack_id: string;
  fecha: string;
  telefono: string;
  remitente: string;
  peso: string;
  notas: string;
}

interface ClientOption {
  id: string;
  name: string;
  nombre_fantasia: string | null;
}

interface QrResult {
  raw: string;
  tracking: string;
  fields: Record<string, string>;
  existing?: { id: string; description: string | null; status: string } | null;
  searching?: boolean;
}

// ============================================================
// UTILS
// ============================================================

async function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX = 1200;
      let w = img.width;
      let h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("No canvas")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      const base64 = dataUrl.split(",")[1];
      resolve({ base64, mediaType: "image/jpeg" });
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function playDoubleBeep() {
  try {
    const ctx = new AudioContext();
    const playBeep = (time: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 1400;
      osc.type = "square";
      gain.gain.value = 0.3;
      osc.start(time);
      osc.stop(time + 0.1);
    };
    playBeep(ctx.currentTime);
    playBeep(ctx.currentTime + 0.15);
  } catch {
    // Web Audio not available
  }
}

function parseQrCode(raw: string): { tracking: string; fields: Record<string, string> } {
  // Try parsing as JSON (ML Flex format)
  try {
    const json = JSON.parse(raw);
    if (typeof json === "object" && json !== null) {
      const tracking = json.id || json.tracking_id || json.barcode || json.code || "";
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(json)) {
        if (typeof v === "string" || typeof v === "number") {
          fields[k] = String(v);
        }
      }
      return { tracking: String(tracking), fields };
    }
  } catch {
    // Not JSON
  }
  // Fallback: use raw as tracking
  return { tracking: raw.trim(), fields: { codigo: raw.trim() } };
}

// ============================================================
// PAGE
// ============================================================

export default function EscanerPage() {
  const [activeTab, setActiveTab] = useState<"foto" | "qr">("foto");

  return (
    <div className="space-y-4 sm:space-y-6 max-w-3xl mx-auto pb-8">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
          Escáner de Paquetes
        </h1>
        <p className="text-[13px] text-muted font-medium mt-1">
          Escaneá etiquetas con IA o usá el lector de códigos QR
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="card-base p-1.5 flex gap-1 animate-fade-in">
        <button
          onClick={() => setActiveTab("foto")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-bold transition-all ${
            activeTab === "foto"
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20"
              : "text-muted hover:text-foreground hover:bg-background"
          }`}
        >
          <Camera className="w-4 h-4" />
          Foto Etiqueta
        </button>
        <button
          onClick={() => setActiveTab("qr")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-bold transition-all ${
            activeTab === "qr"
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20"
              : "text-muted hover:text-foreground hover:bg-background"
          }`}
        >
          <QrCode className="w-4 h-4" />
          Escáner QR
        </button>
      </div>

      {activeTab === "foto" ? <FotoEtiquetaTab /> : <QrScannerTab />}
    </div>
  );
}

// ============================================================
// FOTO ETIQUETA TAB
// ============================================================

function FotoEtiquetaTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<LabelPhoto[]>([]);
  const [processing, setProcessing] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);

  // Fetch clients on mount
  useEffect(() => {
    const fetchClients = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("clients")
        .select("id, name, nombre_fantasia")
        .is("deleted_at", null)
        .order("name");
      if (data) setClients(data);
    };
    fetchClients();
  }, []);

  const addPhotos = useCallback((files: FileList | null) => {
    if (!files) return;
    const newPhotos: LabelPhoto[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      newPhotos.push({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        preview: URL.createObjectURL(file),
        status: "pending",
      });
    }
    setPhotos((prev) => [...prev, ...newPhotos]);
  }, []);

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === id);
      if (photo) URL.revokeObjectURL(photo.preview);
      return prev.filter((p) => p.id !== id);
    });
  };

  const clearAll = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    setPhotos([]);
    setSavedIds(new Set());
  };

  // ---- PROCESS WITH GEMINI VISION ----
  const processPhotos = async () => {
    const pending = photos.filter((p) => p.status === "pending" || p.status === "error");
    if (pending.length === 0) return;
    setProcessing(true);

    for (const photo of pending) {
      setPhotos((prev) =>
        prev.map((p) => (p.id === photo.id ? { ...p, status: "processing" as const } : p))
      );

      try {
        const { base64, mediaType } = await fileToBase64(photo.file);

        const res = await fetch("/api/read-label", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, mediaType }),
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error || "Error al analizar la imagen");
        }

        const d = json.data;
        const extracted: ExtractedLabel = {
          destinatario: d.destinatario || "",
          direccion_completa: d.direccion_completa || "",
          calle: d.calle || "",
          localidad: d.localidad || "",
          partido: d.partido || "",
          provincia: d.provincia || "",
          codigo_postal: d.codigo_postal || d.codigoPostal || "",
          numero_envio: d.numero_envio || d.envioId || "",
          pack_id: d.pack_id || d.packId || "",
          fecha: d.fecha || "",
          telefono: d.telefono || "",
          remitente: d.remitente || "",
          peso: d.peso || "",
          notas: d.notas || d.observaciones || "",
        };

        setPhotos((prev) =>
          prev.map((p) =>
            p.id === photo.id ? { ...p, status: "done" as const, extracted } : p
          )
        );
        setExpandedId(photo.id);
        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
      } catch (err) {
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === photo.id
              ? { ...p, status: "error" as const, error: err instanceof Error ? err.message : "Error desconocido" }
              : p
          )
        );
      }
    }
    setProcessing(false);
  };

  const updateExtracted = (photoId: string, field: keyof ExtractedLabel, value: string) => {
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === photoId && p.extracted ? { ...p, extracted: { ...p.extracted, [field]: value } } : p
      )
    );
  };

  const updateClientId = (photoId: string, clientId: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, clientId: clientId || undefined } : p))
    );
  };

  const saveBulto = async (photo: LabelPhoto) => {
    if (!photo.extracted) return;
    const ext = photo.extracted;
    const trackingId = ext.numero_envio || ext.pack_id || `FOTO-${Date.now()}`;

    setSavingIds((prev) => new Set(prev).add(photo.id));

    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    const descParts: string[] = [];
    if (ext.destinatario) descParts.push(ext.destinatario);
    if (ext.direccion_completa) {
      descParts.push(ext.direccion_completa);
    } else {
      if (ext.calle) descParts.push(ext.calle);
      if (ext.localidad) descParts.push(ext.localidad);
      if (ext.partido) descParts.push(ext.partido);
    }

    const insertData: Record<string, string> = {
      tracking_id: trackingId,
      description: descParts.join(" - ") || `Paquete ${trackingId}`,
      barcode: trackingId,
      status: "stored",
      entry_date: ext.fecha || today,
    };

    if (photo.clientId) {
      insertData.client_id = photo.clientId;
    }

    const { error } = await supabase.from("bultos").insert(insertData);

    if (error) {
      alert("Error al guardar: " + error.message);
    } else {
      setSavedIds((prev) => new Set(prev).add(photo.id));
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
    }

    setSavingIds((prev) => {
      const next = new Set(prev);
      next.delete(photo.id);
      return next;
    });
  };

  const saveAll = async () => {
    const toSave = photos.filter((p) => p.status === "done" && p.extracted && !savedIds.has(p.id));
    for (const photo of toSave) {
      await saveBulto(photo);
    }
  };

  const pendingCount = photos.filter((p) => p.status === "pending" || p.status === "error").length;
  const doneCount = photos.filter((p) => p.status === "done" && !savedIds.has(p.id)).length;
  const savedCount = photos.filter((p) => savedIds.has(p.id)).length;

  return (
    <>
      {/* Camera / Upload area */}
      <div className="card-base p-4 sm:p-6 animate-fade-in">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => {
            addPhotos(e.target.files);
            e.target.value = "";
          }}
        />

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.setAttribute("capture", "environment");
                fileInputRef.current.removeAttribute("multiple");
                fileInputRef.current.click();
              }
            }}
            className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-dashed border-card-border hover:border-accent/40 hover:bg-accent/[0.03] transition-all active:scale-[0.97] group"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/30 transition-all">
              <Camera className="w-7 h-7 text-white" />
            </div>
            <span className="text-[13px] font-bold text-muted group-hover:text-foreground transition-colors">Sacar Foto</span>
          </button>

          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.removeAttribute("capture");
                fileInputRef.current.setAttribute("multiple", "");
                fileInputRef.current.click();
              }
            }}
            className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-dashed border-card-border hover:border-accent/40 hover:bg-accent/[0.03] transition-all active:scale-[0.97] group"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:shadow-purple-500/30 transition-all">
              <ImagePlus className="w-7 h-7 text-white" />
            </div>
            <span className="text-[13px] font-bold text-muted group-hover:text-foreground transition-colors">Subir Imagenes</span>
          </button>
        </div>

        {/* Actions bar */}
        {photos.length > 0 && (
          <div className="flex items-center gap-2 mt-5 pt-4 border-t border-card-border flex-wrap">
            <span className="text-[12px] text-muted font-semibold">
              {photos.length} foto{photos.length !== 1 ? "s" : ""}
              {savedCount > 0 && <span className="text-emerald-400 ml-1">· {savedCount} guardada{savedCount !== 1 ? "s" : ""}</span>}
            </span>
            <div className="ml-auto flex gap-2 flex-wrap">
              <button onClick={clearAll} className="text-[11px] font-bold text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors">
                Limpiar
              </button>
              {pendingCount > 0 && (
                <button
                  onClick={processPhotos}
                  disabled={processing}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white text-[12px] font-bold shadow-lg shadow-blue-500/20 active:scale-[0.97] disabled:opacity-50 transition-all"
                >
                  {processing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Leyendo...</>
                  ) : (
                    <><Eye className="w-4 h-4" /> Leer etiqueta{pendingCount > 1 ? "s" : ""} ({pendingCount})</>
                  )}
                </button>
              )}
              {doneCount > 1 && (
                <button onClick={saveAll} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white text-[12px] font-bold shadow-lg shadow-emerald-500/20 active:scale-[0.97] transition-all">
                  <Save className="w-4 h-4" /> Guardar todo ({doneCount})
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Photo cards */}
      {photos.map((photo) => (
        <PhotoCard
          key={photo.id}
          photo={photo}
          expanded={expandedId === photo.id}
          saved={savedIds.has(photo.id)}
          saving={savingIds.has(photo.id)}
          clients={clients}
          onToggle={() => setExpandedId(expandedId === photo.id ? null : photo.id)}
          onRemove={() => removePhoto(photo.id)}
          onUpdate={(field, value) => updateExtracted(photo.id, field, value)}
          onClientChange={(clientId) => updateClientId(photo.id, clientId)}
          onSave={() => saveBulto(photo)}
        />
      ))}

      {/* Empty state */}
      {photos.length === 0 && (
        <div className="card-base p-10 sm:p-14 text-center animate-fade-in">
          <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center mx-auto mb-5">
            <ScanLine className="w-10 h-10 text-blue-400" />
          </div>
          <p className="text-[16px] font-bold text-foreground mb-2">Lector inteligente de etiquetas</p>
          <p className="text-[13px] text-muted max-w-sm mx-auto leading-relaxed">
            Saca una foto a la etiqueta del paquete (ML Flex, Correo Argentino, etc.) y la IA extrae automaticamente: destinatario, direccion completa, localidad, numero de envio, fecha y mas.
          </p>
        </div>
      )}
    </>
  );
}

// ============================================================
// QR SCANNER TAB
// ============================================================

function QrScannerTab() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<QrResult | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch clients on mount
  useEffect(() => {
    const fetchClients = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("clients")
        .select("id, name, nombre_fantasia")
        .is("deleted_at", null)
        .order("name");
      if (data) setClients(data);
    };
    fetchClients();
  }, []);

  const searchExisting = async (tracking: string): Promise<{ id: string; description: string | null; status: string } | null> => {
    const supabase = createClient();
    const { data } = await supabase
      .from("bultos")
      .select("id, description, status")
      .or(`barcode.eq.${tracking},tracking_id.eq.${tracking}`)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    return data;
  };

  const handleScan = useCallback(async (raw: string) => {
    playDoubleBeep();
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    const { tracking, fields } = parseQrCode(raw);
    setResult({ raw, tracking, fields, searching: true });
    setSaved(false);

    // Stop scanner
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { /* ignore */ }
      scannerRef.current = null;
    }
    setScanning(false);

    // Search for existing
    const existing = await searchExisting(tracking);
    setResult((prev) => prev ? { ...prev, existing, searching: false } : prev);
  }, []);

  const startScanner = useCallback(async () => {
    if (scanning) return;
    setResult(null);
    setSaved(false);
    setScanning(true);

    // Dynamic import html5-qrcode
    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          handleScan(decodedText);
        },
        () => {
          // ignore scan failures
        }
      );
    } catch (err) {
      console.error("Camera error:", err);
      setScanning(false);
    }
  }, [scanning, handleScan]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { /* ignore */ }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleManualSearch = async () => {
    const code = manualInput.trim();
    if (!code) return;
    const { tracking, fields } = parseQrCode(code);
    setResult({ raw: code, tracking, fields, searching: true });
    setSaved(false);
    const existing = await searchExisting(tracking);
    setResult((prev) => prev ? { ...prev, existing, searching: false } : prev);
  };

  const saveQrBulto = async () => {
    if (!result) return;
    setSaving(true);

    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    const descParts: string[] = [];
    if (result.fields.destinatario || result.fields.name) {
      descParts.push(result.fields.destinatario || result.fields.name);
    }
    if (result.fields.direccion || result.fields.address) {
      descParts.push(result.fields.direccion || result.fields.address);
    }

    const insertData: Record<string, string> = {
      tracking_id: result.tracking,
      description: descParts.join(" - ") || `Paquete ${result.tracking}`,
      barcode: result.tracking,
      status: "stored",
      entry_date: today,
    };

    if (selectedClientId) {
      insertData.client_id = selectedClientId;
    }

    const { error } = await supabase.from("bultos").insert(insertData);

    if (error) {
      alert("Error al guardar: " + error.message);
    } else {
      setSaved(true);
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
    }
    setSaving(false);
  };

  return (
    <>
      {/* Scanner area */}
      <div className="card-base p-4 sm:p-6 animate-fade-in">
        {/* Camera view */}
        <div className="flex justify-center">
          <div
            ref={containerRef}
            className="w-full relative overflow-hidden rounded-2xl bg-background border border-card-border"
            style={{ maxWidth: 400, aspectRatio: "1/1" }}
          >
            <div id="qr-reader" className="w-full h-full" />
            {!scanning && !result && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center">
                  <QrCode className="w-10 h-10 text-blue-400" />
                </div>
                <p className="text-[13px] text-muted font-medium">Presiona para escanear</p>
              </div>
            )}
          </div>
        </div>

        {/* Scanner controls */}
        <div className="flex justify-center mt-4 gap-3">
          {!scanning ? (
            <button
              onClick={startScanner}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[13px] font-bold shadow-lg shadow-blue-500/20 active:scale-[0.97] transition-all"
            >
              <Camera className="w-5 h-5" />
              {result ? "Escanear otro" : "Iniciar escáner"}
            </button>
          ) : (
            <button
              onClick={stopScanner}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-white text-[13px] font-bold shadow-lg shadow-red-500/20 active:scale-[0.97] transition-all"
            >
              <ScanLine className="w-5 h-5" />
              Detener
            </button>
          )}
        </div>

        {/* Manual input fallback */}
        <div className="mt-5 pt-4 border-t border-card-border">
          <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">Busqueda manual</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
              placeholder="Codigo de barras o tracking..."
              className="flex-1 px-4 py-3 rounded-xl bg-background border border-card-border text-[13px] text-foreground placeholder:text-muted/40 outline-none focus:border-accent/40 transition-colors"
            />
            <button
              onClick={handleManualSearch}
              className="px-4 py-3 rounded-xl bg-accent/10 text-accent text-[13px] font-bold hover:bg-accent/20 transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* QR Result */}
      {result && (
        <div className="card-base overflow-hidden animate-scale-in">
          <div className="p-4 border-b border-card-border">
            <div className="flex items-center gap-2 mb-2">
              <QrCode className="w-4 h-4 text-accent" />
              <span className="text-[12px] font-bold text-accent uppercase tracking-wider">Resultado del escaneo</span>
            </div>
            <p className="text-[11px] text-muted font-mono break-all">{result.raw}</p>
          </div>

          {/* Parsed fields */}
          <div className="p-4 space-y-2">
            <div className="rounded-xl p-3 bg-accent/[0.08] border border-accent/20">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Truck className="w-3.5 h-3.5 text-accent" />
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Tracking / ID</p>
              </div>
              <p className="text-[14px] font-bold text-accent font-mono">{result.tracking}</p>
            </div>

            {Object.entries(result.fields).filter(([k]) => k !== "id" && k !== "tracking_id" && k !== "barcode" && k !== "code").map(([key, value]) => (
              <div key={key} className="rounded-xl p-3 bg-background">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Hash className="w-3.5 h-3.5 text-muted" />
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider">{key}</p>
                </div>
                <p className="text-[13px] font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>

          {/* Existing bulto search */}
          <div className="px-4 pb-4">
            {result.searching && (
              <div className="flex items-center gap-2 py-3 text-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[12px] font-medium">Buscando en el sistema...</span>
              </div>
            )}

            {!result.searching && result.existing && (
              <div className="rounded-xl p-4 bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4 text-amber-400" />
                  <span className="text-[12px] font-bold text-amber-400">Bulto encontrado</span>
                </div>
                <p className="text-[13px] text-foreground font-medium">{result.existing.description}</p>
                <p className="text-[11px] text-muted mt-1">Estado: <span className="font-bold">{result.existing.status}</span></p>
              </div>
            )}

            {!result.searching && !result.existing && (
              <>
                {/* Client selector */}
                <div className="rounded-xl p-3 bg-background mb-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Users className="w-3.5 h-3.5 text-muted" />
                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Cliente</p>
                  </div>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full text-[13px] font-semibold bg-transparent border border-card-border rounded-lg px-3 py-2 text-foreground outline-none focus:border-accent/40 transition-colors"
                  >
                    <option value="">Sin asignar</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre_fantasia ? `${c.nombre_fantasia} (${c.name})` : c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {!saved ? (
                  <button
                    onClick={saveQrBulto}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white text-[14px] font-bold shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 transition-all"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Guardar bulto</>}
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-4 text-emerald-400">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-[14px] font-bold">Guardado en el sistema</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Empty state when no result */}
      {!result && !scanning && (
        <div className="card-base p-10 sm:p-14 text-center animate-fade-in">
          <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center mx-auto mb-5">
            <QrCode className="w-10 h-10 text-blue-400" />
          </div>
          <p className="text-[16px] font-bold text-foreground mb-2">Escaner de codigos QR</p>
          <p className="text-[13px] text-muted max-w-sm mx-auto leading-relaxed">
            Escanea codigos QR o de barras de los paquetes para buscarlos en el sistema o registrarlos rapidamente.
          </p>
        </div>
      )}
    </>
  );
}

// ============================================================
// PHOTO CARD COMPONENT
// ============================================================

function PhotoCard({
  photo,
  expanded,
  saved,
  saving,
  clients,
  onToggle,
  onRemove,
  onUpdate,
  onClientChange,
  onSave,
}: {
  photo: LabelPhoto;
  expanded: boolean;
  saved: boolean;
  saving: boolean;
  clients: ClientOption[];
  onToggle: () => void;
  onRemove: () => void;
  onUpdate: (field: keyof ExtractedLabel, value: string) => void;
  onClientChange: (clientId: string) => void;
  onSave: () => void;
}) {
  const ext = photo.extracted;

  return (
    <div className="card-base overflow-hidden animate-scale-in">
      {/* Header row */}
      <div className="flex items-center gap-3 p-4">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-background shrink-0 border border-card-border">
          <img src={photo.preview} alt="Etiqueta" className="w-full h-full object-cover" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {photo.status === "pending" && <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400">Pendiente</span>}
            {photo.status === "processing" && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-400 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Leyendo...
              </span>
            )}
            {photo.status === "done" && !saved && <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400">Datos extraidos</span>}
            {photo.status === "done" && saved && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Guardado
              </span>
            )}
            {photo.status === "error" && <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-500/10 text-red-400">Error</span>}
          </div>

          {ext && (
            <>
              <p className="text-[13px] font-bold text-foreground truncate">{ext.destinatario || "Sin destinatario"}</p>
              <p className="text-[11px] text-muted truncate">
                {ext.calle}{ext.localidad ? `, ${ext.localidad}` : ""}{ext.partido ? `, ${ext.partido}` : ""}
              </p>
              <div className="flex items-center gap-3 mt-1">
                {ext.numero_envio && (
                  <p className="text-[10px] text-accent font-mono font-bold flex items-center gap-1">
                    <Truck className="w-3 h-3" /> {ext.numero_envio}
                  </p>
                )}
                {ext.fecha && (
                  <p className="text-[10px] text-muted font-mono flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {ext.fecha}
                  </p>
                )}
              </div>
            </>
          )}
          {photo.error && <p className="text-[11px] text-red-400 mt-1">{photo.error}</p>}
        </div>

        <div className="flex flex-col items-center gap-1 shrink-0">
          {photo.status === "done" && (
            <button onClick={onToggle} className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-background transition-all">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
          <button onClick={onRemove} className="p-2 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-all">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && ext && (
        <div className="border-t border-card-border p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <EditField label="Destinatario" icon={<User className="w-3.5 h-3.5" />} value={ext.destinatario} onChange={(v) => onUpdate("destinatario", v)} />
            <EditField label="Direccion Completa" icon={<MapPin className="w-3.5 h-3.5" />} value={ext.direccion_completa} onChange={(v) => onUpdate("direccion_completa", v)} />
            <EditField label="Calle" icon={<MapPin className="w-3.5 h-3.5" />} value={ext.calle} onChange={(v) => onUpdate("calle", v)} />
            <EditField label="Localidad" icon={<MapPinned className="w-3.5 h-3.5" />} value={ext.localidad} onChange={(v) => onUpdate("localidad", v)} />
            <EditField label="Partido" icon={<Building2 className="w-3.5 h-3.5" />} value={ext.partido} onChange={(v) => onUpdate("partido", v)} />
            <EditField label="Provincia" icon={<Building2 className="w-3.5 h-3.5" />} value={ext.provincia} onChange={(v) => onUpdate("provincia", v)} />
            <EditField label="Codigo Postal" icon={<Hash className="w-3.5 h-3.5" />} value={ext.codigo_postal} onChange={(v) => onUpdate("codigo_postal", v)} />
            <EditField label="Nro. Envio / Tracking" icon={<Truck className="w-3.5 h-3.5" />} value={ext.numero_envio} onChange={(v) => onUpdate("numero_envio", v)} highlight />
            <EditField label="Pack ID" icon={<Package className="w-3.5 h-3.5" />} value={ext.pack_id} onChange={(v) => onUpdate("pack_id", v)} />
            <EditField label="Fecha" icon={<Calendar className="w-3.5 h-3.5" />} value={ext.fecha} onChange={(v) => onUpdate("fecha", v)} />
            <EditField label="Telefono" icon={<Phone className="w-3.5 h-3.5" />} value={ext.telefono} onChange={(v) => onUpdate("telefono", v)} />
            <EditField label="Remitente" icon={<User className="w-3.5 h-3.5" />} value={ext.remitente} onChange={(v) => onUpdate("remitente", v)} />
            {ext.peso && <EditField label="Peso" icon={<Scale className="w-3.5 h-3.5" />} value={ext.peso} onChange={(v) => onUpdate("peso", v)} />}
            {ext.notas && <EditField label="Notas" icon={<FileText className="w-3.5 h-3.5" />} value={ext.notas} onChange={(v) => onUpdate("notas", v)} />}
          </div>

          {/* Client selector */}
          <div className="rounded-xl p-3 bg-background">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Users className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Cliente</p>
            </div>
            <select
              value={photo.clientId || ""}
              onChange={(e) => onClientChange(e.target.value)}
              className="w-full text-[13px] font-semibold bg-transparent border border-card-border rounded-lg px-3 py-2 text-foreground outline-none focus:border-accent/40 transition-colors"
            >
              <option value="">Sin asignar</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre_fantasia ? `${c.nombre_fantasia} (${c.name})` : c.name}
                </option>
              ))}
            </select>
          </div>

          {!saved && (
            <button
              onClick={onSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white text-[14px] font-bold shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 transition-all"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Guardar bulto</>}
            </button>
          )}

          {saved && (
            <div className="flex items-center justify-center gap-2 py-4 text-emerald-400">
              <CheckCircle className="w-5 h-5" />
              <span className="text-[14px] font-bold">Guardado en el sistema</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// EDITABLE FIELD
// ============================================================

function EditField({ label, icon, value, onChange, highlight }: { label: string; icon: React.ReactNode; value: string; onChange: (v: string) => void; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${highlight && value ? "bg-accent/[0.08] border border-accent/20" : "bg-background"}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-muted">{icon}</span>
        <p className="text-[10px] font-bold text-muted uppercase tracking-wider">{label}</p>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Sin ${label.toLowerCase()}`}
        className={`w-full text-[13px] font-semibold bg-transparent border-none outline-none placeholder:text-muted/30 focus:ring-0 ${highlight && value ? "text-accent" : "text-foreground"}`}
      />
    </div>
  );
}
