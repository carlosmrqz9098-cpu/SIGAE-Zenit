const ZONA = "America/Mexico_City";

export function fecha(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { timeZone: ZONA, day: "numeric", month: "short", year: "numeric" });
}

export function fechaHora(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-MX", {
    timeZone: ZONA, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function hora(h?: string | null) {
  return h ? h.slice(0, 5) : "—";
}

export function tamano(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** ISO de la base → valor para <input type="datetime-local"> en hora de Pachuca. */
export function aInputLocal(iso: string) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? "00";
  return `${v("year")}-${v("month")}-${v("day")}T${v("hour") === "24" ? "00" : v("hour")}:${v("minute")}`;
}

/** Valor de <input type="datetime-local"> (hora de Pachuca, UTC-6) → ISO con zona. */
export function deInputLocal(valor: string) {
  return `${valor}:00-06:00`;
}

const DIAS = [
  { corto: "L", largo: "Lunes", claves: ["lun", "lunes"] },
  { corto: "M", largo: "Martes", claves: ["mar", "martes"] },
  { corto: "X", largo: "Miércoles", claves: ["mie", "mié", "miercoles", "miércoles"] },
  { corto: "J", largo: "Jueves", claves: ["jue", "jueves"] },
  { corto: "V", largo: "Viernes", claves: ["vie", "viernes"] },
  { corto: "S", largo: "Sábado", claves: ["sab", "sáb", "sabado", "sábado"] },
];

/** Convierte "Lunes y Miércoles", "Lun-Mie-Vie", etc. en los 6 días de la semana marcados. */
export function diasMarcados(texto: string) {
  const palabras = texto
    .toLowerCase()
    .split(/[^a-záéíóúñ]+/)
    .filter(Boolean);
  return DIAS.map((d) => ({ ...d, activo: palabras.some((p) => d.claves.includes(p)) }));
}
