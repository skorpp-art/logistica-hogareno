"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ScanLine,
  Package,
  User,
  Calendar,
  MapPin,
  AlertTriangle,
  Camera,
  CameraOff,
  Search,
  Phone,
  Truck,
  Hash,
  ShieldCheck,
  Save,
  CheckCircle,
  Copy,
  Check,
  RotateCcw,
  ImagePlus,
  X,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================

interface BultoResult {
  id: string;
  description: string | null;
  barcode: string | null;
  tracking_id: string | null;
  status: string;
  entry_date: string;
  scheduled_return_date: string | null;
  clients: {
    id: string;
    name: string;
    nombre_fantasia: string | null;
    address: string | null;
    phone: string | null;
  } | null;
}

interface ScannedData {
  raw: string;
  isJSON: boolean;
  fields: { label: string; value: string; icon: string }[];
  trackingId: string | null;
}

interface LabelPhoto {
  id: string;
  file: File;
  preview: string;
  status: "pending" | "processing" | "done" | "error";
  ocrText?: string;
  extracted?: ExtractedLabel;
  error?: string;
}

interface ExtractedLabel {
  destinatario: string;
  direccion: string;
  localidad: string;
  codigoPostal: string;
  packId: string;
  envioId: string;
  telefono: string;
  otrosTextos: string;
}

// ============================================================
// QR PARSE UTILS
// ============================================================

function parseScannedCode(code: string): ScannedData {
  try {
    const parsed = JSON.parse(code);
    if (parsed && typeof parsed === "object") {
      const fields: { label: string; value: string; icon: string }[] = [];
      if (parsed.id) fields.push({ label: "ID Envío / Tracking", value: String(parsed.id), icon: "hash" });
      if (parsed.sender_id) fields.push({ label: "ID Vendedor", value: String(parsed.sender_id), icon: "user" });
      if (parsed.hash_code) fields.push({ label: "Código Hash", value: String(parsed.hash_code), icon: "shield" });
      if (parsed.security_digit !== undefined) fields.push({ label: "Dígito Seguridad", value: String(parsed.security_digit), icon: "shield" });
      if (parsed.address || parsed.direccion) fields.push({ label: "Dirección", value: String(parsed.address || parsed.direccion), icon: "map" });
      if (parsed.recipient || parsed.destinatario || parsed.name) fields.push({ label: "Destinatario", value: String(parsed.recipient || parsed.destinatario || parsed.name), icon: "user" });

      const knownKeys = new Set(["id", "sender_id", "hash_code", "security_digit", "address", "direccion", "recipient", "destinatario", "name"]);
      for (const [key, val] of Object.entries(parsed)) {
        if (!knownKeys.has(key) && val !== null && val !== undefined && val !== "") {
          fields.push({ label: key, value: String(val), icon: "hash" });
        }
      }

      return { raw: code, isJSON: true, fields, trackingId: parsed.id ? String(parsed.id) : null };
    }
  } catch { /* not JSON */ }

  return { raw: code, isJSON: false, fields: [{ label: "Código", value: code, icon: "hash" }], trackingId: code };
}

// ============================================================
// OCR LABEL PARSER
// ============================================================

function extractLabelData(text: string): ExtractedLabel {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let destinatario = "";
  let direccion = "";
  let localidad = "";
  let codigoPostal = "";
  let packId = "";
  let envioId = "";
  let telefono = "";
  const extras: string[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Pack ID
    const packMatch = line.match(/pack[:\s#]*(\d{5,})/i);
    if (packMatch) { packId = packMatch[1]; continue; }

    // Envío ID
    const envioMatch = line.match(/env[ií]o[:\s#]*(\d[\d\s]{4,})/i);
    if (envioMatch) { envioId = envioMatch[1].replace(/\s/g, ""); continue; }

    // Código postal
    const cpMatch = line.match(/\b(CP|C\.P\.?)\s*(\d{4})\b/i) || line.match(/\b(\d{4})\b/);
    if (cpMatch && !codigoPostal) {
      const candidate = cpMatch[2] || cpMatch[1];
      if (candidate && candidate.length === 4 && parseInt(candidate) >= 1000 && parseInt(candidate) <= 9999) {
        codigoPostal = candidate;
      }
    }

    // Teléfono
    const telMatch = line.match(/(?:tel|cel|phone|whatsapp)[:\s]*([\d\s\-+()]{7,})/i);
    if (telMatch) { telefono = telMatch[1].trim(); continue; }
    if (!telefono) {
      const phonePattern = line.match(/(\+?\d[\d\s\-]{9,})/);
      if (phonePattern && !packId.includes(phonePattern[1].replace(/\s/g, ""))) {
        telefono = phonePattern[1].trim();
        continue;
      }
    }

    // Dirección (calle + número)
    const dirMatch = line.match(/^(calle|av\.?|avda\.?|avenida|bv\.?|boulevard|pasaje|pje\.?)\s+.+\d+/i)
      || line.match(/^[A-ZÁÉÍÓÚÜÑa-záéíóúüñ\s]+\d{1,5}\b/);
    if (dirMatch && !direccion) {
      direccion = line;
      continue;
    }

    // Skip known headers
    if (lower.includes("mercado libre") || lower.includes("mercado envios") || lower.includes("flex") || lower.includes("full")) continue;
    if (lower.includes("remitente") || lower.includes("sender")) continue;
    if (line.length < 3) continue;

    // Localidad (after we have address, or contains common keywords)
    if (direccion && !localidad) {
      if (/[A-ZÁÉÍÓÚÜÑa-z]/.test(line) && !line.match(/^\d+$/)) {
        localidad = line;
        continue;
      }
    }

    // Destinatario — a name-like line (mostly letters, not too long)
    if (!destinatario && /^[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+(\s+[A-ZÁÉÍÓÚÜÑa-záéíóúüñ]+){1,4}$/.test(line)) {
      destinatario = line;
      continue;
    }

    extras.push(line);
  }

  // Fallbacks: if no destinatario found, use first line that looks like a name
  if (!destinatario) {
    for (const line of lines) {
      if (/^[A-ZÁÉÍÓÚÜÑ\s]{4,}$/.test(line) && !line.match(/MERCADO|ENVIO|FLEX|PACK|REMIT/i)) {
        destinatario = line;
        break;
      }
    }
  }

  return {
    destinatario,
    direccion,
    localidad,
    codigoPostal,
    packId,
    envioId,
    telefono,
    otrosTextos: extras.join(" | "),
  };
}

// ============================================================
// ICON COMPONENT
// ============================================================

const FieldIcon = ({ icon }: { icon: string }) => {
  const cls = "w-4 h-4 text-muted";
  switch (icon) {
    case "hash": return <Hash className={cls} />;
    case "user": return <User className={cls} />;
    case "shield": return <ShieldCheck className={cls} />;
    case "map": return <MapPin className={cls} />;
    case "calendar": return <Calendar className={cls} />;
    case "package": return <Package className={cls} />;
    case "truck": return <Truck className={cls} />;
    case "phone": return <Phone className={cls} />;
    default: return <Hash className={cls} />;
  }
};

// ============================================================
// MAIN COMPONENT
// ============================================================

type TabMode = "qr" | "foto";

export default function EscanerPage() {
  const [tab, setTab] = useState<TabMode>("foto");

  return (
    <div className="space-y-4 sm:space-y-6 max-w-3xl mx-auto pb-8">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
          Escáner
        </h1>
        <p className="text-[13px] text-muted font-medium mt-1">
          Escaneá códigos QR o sacá fotos de etiquetas para registrar bultos
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex bg-card border border-card-border rounded-2xl p-1 animate-fade-in">
        <button
          onClick={() => setTab("foto")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-bold transition-all ${
            tab === "foto"
              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/20"
              : "text-muted hover:text-foreground"
          }`}
        >
          <ImagePlus className="w-4 h-4" />
          Foto Etiqueta
        </button>
        <button
          onClick={() => setTab("qr")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-bold transition-all ${
            tab === "qr"
              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/20"
              : "text-muted hover:text-foreground"
          }`}
        >
          <ScanLine className="w-4 h-4" />
          Escáner QR
        </button>
      </div>

      {tab === "foto" ? <FotoEtiquetaTab /> : <QRScannerTab />}
    </div>
  );
}

// ============================================================
// TAB: FOTO ETIQUETA
// ============================================================

function FotoEtiquetaTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<LabelPhoto[]>([]);
  const [processing, setProcessing] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const processPhotos = async () => {
    const pending = photos.filter((p) => p.status === "pending" || p.status === "error");
    if (pending.length === 0) return;

    setProcessing(true);

    const Tesseract = await import("tesseract.js");

    for (const photo of pending) {
      setPhotos((prev) =>
        prev.map((p) => (p.id === photo.id ? { ...p, status: "processing" as const } : p))
      );

      try {
        const result = await Tesseract.recognize(photo.file, "spa", {
          logger: () => {},
        });

        const ocrText = result.data.text;
        const extracted = extractLabelData(ocrText);

        setPhotos((prev) =>
          prev.map((p) =>
            p.id === photo.id ? { ...p, status: "done" as const, ocrText, extracted } : p
          )
        );
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
        p.id === photoId && p.extracted
          ? { ...p, extracted: { ...p.extracted, [field]: value } }
          : p
      )
    );
  };

  const saveBulto = async (photo: LabelPhoto) => {
    if (!photo.extracted) return;
    const ext = photo.extracted;
    const trackingId = ext.packId || ext.envioId || `FOTO-${Date.now()}`;

    setSavingIds((prev) => new Set(prev).add(photo.id));

    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    const descParts = [];
    if (ext.destinatario) descParts.push(ext.destinatario);
    if (ext.direccion) descParts.push(ext.direccion);
    if (ext.localidad) descParts.push(ext.localidad);

    const { error } = await supabase.from("bultos").insert({
      tracking_id: trackingId,
      description: descParts.join(" - ") || `Paquete ${trackingId}`,
      barcode: trackingId,
      status: "stored",
      entry_date: today,
    });

    if (error) {
      alert("Error al guardar: " + error.message);
    } else {
      setSavedIds((prev) => new Set(prev).add(photo.id));
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
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
            <ImagePlus className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-[14px] font-bold text-foreground">Lector de Etiquetas</h2>
            <p className="text-[11px] text-muted">Sacá fotos de etiquetas ML Flex para extraer los datos</p>
          </div>
        </div>

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
          {/* Take photo */}
          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.setAttribute("capture", "environment");
                fileInputRef.current.removeAttribute("multiple");
                fileInputRef.current.click();
              }
            }}
            className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 border-dashed border-card-border hover:border-accent/40 hover:bg-accent/[0.03] transition-all active:scale-[0.97] group"
          >
            <Camera className="w-8 h-8 text-muted group-hover:text-accent transition-colors" />
            <span className="text-[12px] font-bold text-muted group-hover:text-foreground transition-colors">
              Sacar Foto
            </span>
          </button>

          {/* Upload images */}
          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.removeAttribute("capture");
                fileInputRef.current.setAttribute("multiple", "");
                fileInputRef.current.click();
              }
            }}
            className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 border-dashed border-card-border hover:border-accent/40 hover:bg-accent/[0.03] transition-all active:scale-[0.97] group"
          >
            <ImagePlus className="w-8 h-8 text-muted group-hover:text-accent transition-colors" />
            <span className="text-[12px] font-bold text-muted group-hover:text-foreground transition-colors">
              Subir Imágenes
            </span>
          </button>
        </div>

        {/* Photo count & actions */}
        {photos.length > 0 && (
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <span className="text-[12px] text-muted font-semibold">
              {photos.length} foto{photos.length !== 1 ? "s" : ""}
              {savedCount > 0 && <span className="text-emerald-400 ml-1">({savedCount} guardadas)</span>}
            </span>
            <div className="ml-auto flex gap-2">
              <button
                onClick={clearAll}
                className="text-[11px] font-bold text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10"
              >
                Limpiar todo
              </button>
              {pendingCount > 0 && (
                <button
                  onClick={processPhotos}
                  disabled={processing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-[12px] font-bold shadow-lg shadow-purple-500/20 active:scale-[0.97] disabled:opacity-50 transition-all"
                >
                  {processing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Analizando...</>
                  ) : (
                    <><ScanLine className="w-4 h-4" /> Analizar ({pendingCount})</>
                  )}
                </button>
              )}
              {doneCount > 0 && (
                <button
                  onClick={saveAll}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white text-[12px] font-bold shadow-lg shadow-emerald-500/20 active:scale-[0.97] transition-all"
                >
                  <Save className="w-4 h-4" /> Guardar todo ({doneCount})
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Photo results */}
      {photos.map((photo) => (
        <div key={photo.id} className="card-base overflow-hidden animate-scale-in">
          {/* Photo header row */}
          <div className="flex items-center gap-3 p-4">
            {/* Thumbnail */}
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-background shrink-0">
              <img src={photo.preview} alt="Etiqueta" className="w-full h-full object-cover" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {photo.status === "pending" && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-blue-500/10 text-blue-400">Pendiente</span>
                )}
                {photo.status === "processing" && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-violet-500/10 text-violet-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Analizando
                  </span>
                )}
                {photo.status === "done" && !savedIds.has(photo.id) && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400">Listo</span>
                )}
                {photo.status === "done" && savedIds.has(photo.id) && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Guardado
                  </span>
                )}
                {photo.status === "error" && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-red-500/10 text-red-400">Error</span>
                )}
              </div>

              {photo.extracted && (
                <p className="text-[13px] font-bold text-foreground truncate">
                  {photo.extracted.destinatario || photo.extracted.direccion || "Sin datos"}
                </p>
              )}
              {photo.extracted?.packId && (
                <p className="text-[11px] text-muted font-mono">Pack: {photo.extracted.packId}</p>
              )}
              {photo.error && (
                <p className="text-[11px] text-red-400">{photo.error}</p>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {photo.status === "done" && (
                <button
                  onClick={() => setExpandedId(expandedId === photo.id ? null : photo.id)}
                  className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-background transition-all"
                >
                  {expandedId === photo.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              )}
              <button
                onClick={() => removePhoto(photo.id)}
                className="p-2 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Expanded detail */}
          {expandedId === photo.id && photo.extracted && (
            <div className="border-t border-card-border p-4 space-y-3">
              {/* Editable extracted fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <EditableField
                  label="Destinatario"
                  icon={<User className="w-3.5 h-3.5 text-muted" />}
                  value={photo.extracted.destinatario}
                  onChange={(v) => updateExtracted(photo.id, "destinatario", v)}
                />
                <EditableField
                  label="Dirección"
                  icon={<MapPin className="w-3.5 h-3.5 text-muted" />}
                  value={photo.extracted.direccion}
                  onChange={(v) => updateExtracted(photo.id, "direccion", v)}
                />
                <EditableField
                  label="Localidad"
                  icon={<MapPin className="w-3.5 h-3.5 text-muted" />}
                  value={photo.extracted.localidad}
                  onChange={(v) => updateExtracted(photo.id, "localidad", v)}
                />
                <EditableField
                  label="Código Postal"
                  icon={<Hash className="w-3.5 h-3.5 text-muted" />}
                  value={photo.extracted.codigoPostal}
                  onChange={(v) => updateExtracted(photo.id, "codigoPostal", v)}
                />
                <EditableField
                  label="Pack ID"
                  icon={<Package className="w-3.5 h-3.5 text-muted" />}
                  value={photo.extracted.packId}
                  onChange={(v) => updateExtracted(photo.id, "packId", v)}
                />
                <EditableField
                  label="ID Envío"
                  icon={<Truck className="w-3.5 h-3.5 text-muted" />}
                  value={photo.extracted.envioId}
                  onChange={(v) => updateExtracted(photo.id, "envioId", v)}
                />
                <EditableField
                  label="Teléfono"
                  icon={<Phone className="w-3.5 h-3.5 text-muted" />}
                  value={photo.extracted.telefono}
                  onChange={(v) => updateExtracted(photo.id, "telefono", v)}
                />
              </div>

              {/* OCR raw text */}
              {photo.ocrText && (
                <details className="mt-2">
                  <summary className="text-[11px] text-muted font-semibold cursor-pointer hover:text-foreground transition-colors py-1">
                    Ver texto OCR completo
                  </summary>
                  <pre className="mt-1 p-3 bg-background rounded-xl text-[11px] text-muted font-mono whitespace-pre-wrap break-all leading-relaxed max-h-40 overflow-y-auto">
                    {photo.ocrText}
                  </pre>
                </details>
              )}

              {/* Save button */}
              {!savedIds.has(photo.id) && (
                <button
                  onClick={() => saveBulto(photo)}
                  disabled={savingIds.has(photo.id)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white text-[13px] font-bold shadow-lg shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50 transition-all"
                >
                  {savingIds.has(photo.id) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <><Save className="w-4 h-4" /> Guardar como bulto</>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Empty state */}
      {photos.length === 0 && (
        <div className="card-base p-8 sm:p-12 text-center animate-fade-in">
          <div className="w-16 h-16 bg-violet-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Camera className="w-8 h-8 text-violet-400" />
          </div>
          <p className="text-[15px] font-bold text-foreground mb-1">Sacá fotos de las etiquetas</p>
          <p className="text-[13px] text-muted max-w-xs mx-auto">
            Podés sacar fotos una por una o subir varias imágenes. El sistema lee el texto y extrae los datos automáticamente.
          </p>
        </div>
      )}
    </>
  );
}

// ============================================================
// EDITABLE FIELD COMPONENT
// ============================================================

function EditableField({
  label,
  icon,
  value,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="bg-background rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <p className="text-[10px] font-bold text-muted uppercase tracking-wider">{label}</p>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Sin ${label.toLowerCase()}`}
        className="w-full text-[13px] font-semibold text-foreground bg-transparent border-none outline-none placeholder:text-muted/30 focus:ring-0"
      />
    </div>
  );
}

// ============================================================
// TAB: QR SCANNER
// ============================================================

function QRScannerTab() {
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<unknown>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannedData, setScannedData] = useState<ScannedData | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<BultoResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  const playBeep = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      for (let i = 0; i < 2; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(1400, ctx.currentTime + i * 0.12);
        gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.12 + 0.08);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.08);
      }
    } catch { /* */ }
  };

  const startScanner = async () => {
    if (scanning) return;
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader", {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.CODE_128,
        ],
        verbose: false,
      });
      html5QrCodeRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 15, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          playBeep();
          if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
          handleCodeScanned(decodedText);
          scanner.stop().catch(() => {});
          setScanning(false);
        },
        () => {}
      );
      setScanning(true);
    } catch {
      alert("No se pudo acceder a la cámara. Verificá los permisos del navegador.");
    }
  };

  const stopScanner = async () => {
    try {
      const scanner = html5QrCodeRef.current as { stop: () => Promise<void> } | null;
      if (scanner) await scanner.stop();
    } catch { /* */ }
    html5QrCodeRef.current = null;
    setScanning(false);
  };

  const handleCodeScanned = async (code: string) => {
    const data = parseScannedCode(code);
    setScannedData(data);
    setManualCode(data.trackingId || code);
    setSaved(false);
    setResult(null);
    setNotFound(false);
    if (data.trackingId) await searchBulto(data.trackingId);
  };

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const code = manualCode.trim();
    const data = parseScannedCode(code);
    setScannedData(data);
    setSaved(false);
    await searchBulto(data.trackingId || code);
  };

  const searchBulto = async (code: string) => {
    setLoading(true);
    setResult(null);
    setNotFound(false);
    const supabase = createClient();
    const { data } = await supabase
      .from("bultos")
      .select("id, description, barcode, tracking_id, status, entry_date, scheduled_return_date, clients(id, name, nombre_fantasia, address, phone)")
      .or(`barcode.eq.${code},tracking_id.eq.${code}`)
      .is("deleted_at", null)
      .limit(1);

    if (data && data.length > 0) {
      const row = data[0] as unknown as BultoResult;
      if (Array.isArray(row.clients) && row.clients.length > 0) {
        row.clients = row.clients[0] as unknown as BultoResult["clients"];
      }
      setResult(row);
    } else {
      setNotFound(true);
    }
    setLoading(false);
  };

  const registerBulto = async () => {
    if (!scannedData?.trackingId) return;
    setSaving(true);
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("bultos").insert({
      tracking_id: scannedData.trackingId,
      description: scannedData.isJSON ? `Paquete ML Flex #${scannedData.trackingId}` : `Bulto #${scannedData.trackingId}`,
      barcode: scannedData.trackingId,
      status: "stored",
      entry_date: today,
    });

    if (error) {
      alert("Error: " + error.message);
    } else {
      setSaved(true);
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
      await searchBulto(scannedData.trackingId);
    }
    setSaving(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const resetScanner = () => {
    setScannedData(null);
    setResult(null);
    setNotFound(false);
    setManualCode("");
    setSaved(false);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "stored": return { text: "Almacenado", cls: "bg-emerald-500/10 text-emerald-400" };
      case "scheduled_return": return { text: "Retorno prog.", cls: "bg-amber-500/10 text-amber-400" };
      case "returned": return { text: "Devuelto", cls: "bg-blue-500/10 text-blue-400" };
      default: return { text: status, cls: "bg-accent/10 text-muted" };
    }
  };

  const formatDate = (d: string) => {
    const parts = d.split("-");
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  return (
    <>
      {/* Buttons mobile */}
      <div className="sm:hidden flex gap-2">
        <button
          onClick={scanning ? stopScanner : startScanner}
          className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl text-[14px] font-bold transition-all ${
            scanning
              ? "bg-red-500/10 text-red-400 border border-red-500/20"
              : "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/20 active:scale-[0.98]"
          }`}
        >
          {scanning ? <><CameraOff className="w-5 h-5" /> Detener</> : <><Camera className="w-5 h-5" /> Escanear</>}
        </button>
        {scannedData && (
          <button onClick={resetScanner} className="px-4 py-4 rounded-2xl bg-card border border-card-border text-muted active:scale-[0.98]">
            <RotateCcw className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Scanner card */}
      <div className="card-base p-3 sm:p-6 animate-fade-in">
        {/* Desktop header */}
        <div className="hidden sm:flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <ScanLine className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-[13px] font-bold text-foreground">Cámara QR</h2>
            <p className="text-[11px] text-muted">Apuntá al código QR</p>
          </div>
          <div className="ml-auto flex gap-2">
            {scannedData && (
              <button onClick={resetScanner} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-bold bg-card border border-card-border text-muted hover:text-foreground transition-all">
                <RotateCcw className="w-3.5 h-3.5" /> Limpiar
              </button>
            )}
            <button
              onClick={scanning ? stopScanner : startScanner}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold transition-all ${
                scanning ? "bg-red-500/10 text-red-400" : "bg-gradient-to-r from-blue-600 to-blue-700 text-white"
              }`}
            >
              {scanning ? <><CameraOff className="w-4 h-4" /> Detener</> : <><Camera className="w-4 h-4" /> Iniciar</>}
            </button>
          </div>
        </div>

        {/* QR reader — SQUARE */}
        <div
          className={`relative mx-auto overflow-hidden rounded-2xl bg-black ${scanning ? "" : "hidden"}`}
          style={{ width: "100%", maxWidth: 400, aspectRatio: "1 / 1" }}
        >
          <div id="qr-reader" ref={scannerRef} className="absolute inset-0 w-full h-full" />
          <div className="absolute inset-0 pointer-events-none z-10">
            <div className="absolute top-4 left-4 w-10 h-10 border-t-3 border-l-3 border-blue-400 rounded-tl-lg" />
            <div className="absolute top-4 right-4 w-10 h-10 border-t-3 border-r-3 border-blue-400 rounded-tr-lg" />
            <div className="absolute bottom-4 left-4 w-10 h-10 border-b-3 border-l-3 border-blue-400 rounded-bl-lg" />
            <div className="absolute bottom-4 right-4 w-10 h-10 border-b-3 border-r-3 border-blue-400 rounded-br-lg" />
          </div>
        </div>

        {/* Manual search (when not scanning) */}
        {!scanning && (
          <>
            <div className="relative my-4 sm:my-5">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-card-border" /></div>
              <div className="relative flex justify-center text-[11px]"><span className="bg-card px-3 text-muted font-semibold">o buscá manualmente</span></div>
            </div>
            <form onSubmit={handleManualSearch} className="flex gap-2 sm:gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input type="text" placeholder="Código o tracking..." value={manualCode} onChange={(e) => setManualCode(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-[13px] bg-background border border-card-border rounded-xl text-foreground placeholder:text-muted/50 focus:ring-2 focus:ring-accent/30 focus:border-accent/30" />
              </div>
              <button type="submit" disabled={loading || !manualCode.trim()}
                className="px-4 py-3 bg-accent text-white rounded-xl text-[12px] font-bold disabled:opacity-50 transition-all shrink-0">
                Buscar
              </button>
            </form>
          </>
        )}
      </div>

      {loading && (
        <div className="card-base p-8 flex items-center justify-center animate-fade-in">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      )}

      {/* Scanned data */}
      {scannedData && !loading && (
        <div className="card-base p-4 sm:p-6 animate-scale-in">
          <div className="flex items-start gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${scannedData.isJSON ? "bg-yellow-500/10" : "bg-blue-500/10"}`}>
              {scannedData.isJSON ? <Truck className="w-5 h-5 text-yellow-500" /> : <Package className="w-5 h-5 text-blue-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[15px] font-bold text-foreground">{scannedData.isJSON ? "Paquete ML Flex" : "Código Escaneado"}</h3>
              <p className="text-[11px] text-muted">{scannedData.fields.length} campos</p>
            </div>
            {result && (() => { const s = getStatusLabel(result.status); return <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full shrink-0 ${s.cls}`}>{s.text}</span>; })()}
            {notFound && <span className="text-[10px] font-bold px-3 py-1.5 rounded-full shrink-0 bg-amber-500/10 text-amber-400">No registrado</span>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {scannedData.fields.map((field, i) => (
              <button key={i} onClick={() => copyToClipboard(field.value)}
                className="bg-background rounded-xl p-3.5 text-left group hover:bg-background/80 active:scale-[0.98] transition-all">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <FieldIcon icon={field.icon} />
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider">{field.label}</p>
                  <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                    {copied === field.value ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-muted" />}
                  </div>
                </div>
                <p className="text-[13px] font-bold text-foreground font-mono break-all">{field.value}</p>
              </button>
            ))}
          </div>

          {scannedData.isJSON && (
            <details className="mt-3">
              <summary className="text-[11px] text-muted font-semibold cursor-pointer hover:text-foreground py-2">Ver JSON original</summary>
              <pre className="mt-1 p-3 bg-background rounded-xl text-[11px] text-muted font-mono overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(JSON.parse(scannedData.raw), null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Registered bulto */}
      {result && !loading && (
        <div className="card-base p-4 sm:p-6 animate-scale-in">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div><h3 className="text-[15px] font-bold text-foreground">En el sistema</h3><p className="text-[11px] text-muted">Bulto registrado</p></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="bg-background rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 mb-1"><User className="w-3.5 h-3.5 text-muted" /><p className="text-[10px] font-bold text-muted uppercase tracking-wider">Cliente</p></div>
              <p className="text-[13px] font-bold text-foreground">{result.clients?.name || "Sin cliente"}</p>
            </div>
            <div className="bg-background rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 mb-1"><Package className="w-3.5 h-3.5 text-muted" /><p className="text-[10px] font-bold text-muted uppercase tracking-wider">Descripción</p></div>
              <p className="text-[13px] font-semibold text-foreground">{result.description || "-"}</p>
            </div>
            <div className="bg-background rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 mb-1"><Calendar className="w-3.5 h-3.5 text-muted" /><p className="text-[10px] font-bold text-muted uppercase tracking-wider">Ingreso</p></div>
              <p className="text-[13px] font-semibold text-foreground">{formatDate(result.entry_date)}</p>
            </div>
            <div className="bg-background rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 mb-1"><MapPin className="w-3.5 h-3.5 text-muted" /><p className="text-[10px] font-bold text-muted uppercase tracking-wider">{result.scheduled_return_date ? "Retorno" : "Dirección"}</p></div>
              <p className="text-[13px] font-semibold text-foreground">{result.scheduled_return_date ? formatDate(result.scheduled_return_date) : result.clients?.address || "-"}</p>
            </div>
          </div>
          {result.clients?.phone && (
            <a href={`tel:${result.clients.phone}`} className="mt-3 flex items-center gap-2.5 p-3 bg-accent/[0.06] rounded-xl text-[13px] text-foreground hover:bg-accent/10 active:scale-[0.98]">
              <Phone className="w-4 h-4 text-accent" /><span className="font-semibold">{result.clients.phone}</span><span className="text-[11px] text-muted ml-auto">Llamar</span>
            </a>
          )}
        </div>
      )}

      {/* Not found — register */}
      {notFound && !loading && scannedData && (
        <div className="card-base p-4 sm:p-6 animate-scale-in">
          {saved ? (
            <div className="flex items-center justify-center gap-2 py-4 text-emerald-400">
              <CheckCircle className="w-5 h-5" /><span className="text-[14px] font-bold">Registrado</span>
            </div>
          ) : (
            <button onClick={registerBulto} disabled={saving || !scannedData.trackingId}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white text-[14px] font-bold shadow-lg shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50 transition-all">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Registrar como bulto</>}
            </button>
          )}
        </div>
      )}

      {notFound && !loading && !scannedData && (
        <div className="card-base p-6 text-center animate-scale-in">
          <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-7 h-7 text-amber-400" />
          </div>
          <p className="text-[15px] font-bold text-foreground mb-1">No encontrado</p>
        </div>
      )}
    </>
  );
}
