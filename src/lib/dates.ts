// Fecha local en formato YYYY-MM-DD.
// OJO: no usar new Date().toISOString() para fechas — devuelve UTC,
// y en Argentina (UTC-3) después de las 21:00 da el día siguiente.
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Normaliza texto para búsquedas: minúsculas, sin tildes/acentos y sin
// espacios de más. Así "Morón" coincide con "moron", "Perú" con "peru", etc.
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
