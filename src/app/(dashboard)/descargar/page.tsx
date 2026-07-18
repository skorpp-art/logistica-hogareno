"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Download,
  Upload,
  Smartphone,
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

const BUCKET = "app";
const FILE = "logistica.apk";

interface ApkInfo {
  exists: boolean;
  size?: number;
  updatedAt?: string;
}

function formatSize(bytes?: number) {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export default function DescargarPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [info, setInfo] = useState<ApkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${FILE}`;

  const fetchInfo = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.storage.from(BUCKET).list("", {
      search: FILE,
    });
    if (error) {
      setInfo({ exists: false });
      setLoading(false);
      return;
    }
    const found = data?.find((f) => f.name === FILE);
    if (found) {
      setInfo({
        exists: true,
        size: (found.metadata as { size?: number } | null)?.size,
        updatedAt: found.updated_at ?? undefined,
      });
    } else {
      setInfo({ exists: false });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInfo();
  }, []);

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".apk")) {
      setMsg({ type: "err", text: "El archivo debe ser un .apk" });
      return;
    }
    setUploading(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.storage.from(BUCKET).upload(FILE, file, {
      upsert: true,
      contentType: "application/vnd.android.package-archive",
    });
    if (error) {
      setMsg({
        type: "err",
        text:
          "Error al subir: " +
          error.message +
          ". Revisá que el bucket 'app' exista en Supabase.",
      });
    } else {
      setMsg({ type: "ok", text: "APK subido correctamente" });
      await fetchInfo();
    }
    setUploading(false);
  };

  const handleDownload = () => {
    // Cache-buster para bajar siempre la última versión
    const url = `${publicUrl}?t=${Date.now()}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = FILE;
    a.click();
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
          App para celular
        </h1>
        <p className="text-[13px] text-muted font-medium mt-1">
          Descargá la app o actualizá el archivo de instalación (APK)
        </p>
      </div>

      {/* Download card */}
      <div className="card-base p-6 animate-fade-in">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Smartphone className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-foreground">Logística Hogareño</p>
            {loading ? (
              <p className="text-[12px] text-muted flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Verificando...
              </p>
            ) : info?.exists ? (
              <p className="text-[12px] text-emerald-500 font-medium">
                Disponible {info.size ? `· ${formatSize(info.size)}` : ""}
              </p>
            ) : (
              <p className="text-[12px] text-amber-500 font-medium">
                Todavía no hay ningún APK subido
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleDownload}
          disabled={!info?.exists}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[14px] font-bold shadow-lg shadow-blue-500/20 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <Download className="w-5 h-5" />
          Descargar app (APK)
        </button>

        <p className="text-[11px] text-muted mt-3 leading-relaxed">
          Al abrir el archivo en el celular, Android te va a pedir permitir la
          instalación desde esta fuente. Aceptá y listo.
        </p>
      </div>

      {/* Upload card */}
      <div className="card-base p-6 animate-fade-in">
        <p className="text-[13px] font-bold text-foreground mb-1">
          Subir / actualizar el APK
        </p>
        <p className="text-[12px] text-muted mb-4">
          Elegí el archivo <span className="font-mono">.apk</span> desde tu
          compu. Reemplaza al anterior y queda disponible para descargar.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".apk,application/vnd.android.package-archive"
          className="hidden"
          onChange={(e) => {
            handleUpload(e.target.files?.[0] || null);
            e.target.value = "";
          }}
        />

        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-dashed border-card-border text-foreground text-[13px] font-bold hover:border-accent/40 hover:bg-accent/[0.03] active:scale-[0.98] disabled:opacity-50 transition-all"
        >
          {uploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Subiendo...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" /> Elegir archivo APK
            </>
          )}
        </button>

        {info?.exists && !uploading && (
          <button
            onClick={fetchInfo}
            className="mt-3 flex items-center gap-1.5 text-[11px] text-muted hover:text-foreground transition-colors mx-auto"
          >
            <RefreshCw className="w-3 h-3" /> Actualizar estado
          </button>
        )}

        {msg && (
          <div
            className={`mt-4 flex items-center gap-2 p-3 rounded-xl text-[12px] font-medium ${
              msg.type === "ok"
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-red-500/10 text-red-500"
            }`}
          >
            {msg.type === "ok" ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            {msg.text}
          </div>
        )}
      </div>
    </div>
  );
}
