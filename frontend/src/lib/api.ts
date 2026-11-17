// Cliente de la API: agrega el token, renueva la sesión sola y entrega errores claros.

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const CLAVE = "sigae.sesion";

export interface Sesion {
  access_token: string;
  refresh_token: string;
  expires_at?: number | null;
}

export class ApiError extends Error {
  constructor(public estado: number, mensaje: string, public codigo?: string) {
    super(mensaje);
  }
}

let alExpirar: () => void = () => {};
export function cuandoExpire(fn: () => void) {
  alExpirar = fn;
}

export function leerSesion(): Sesion | null {
  try {
    const t = localStorage.getItem(CLAVE);
    return t ? (JSON.parse(t) as Sesion) : null;
  } catch {
    return null;
  }
}

export function guardarSesion(s: Sesion | null) {
  try {
    if (s) localStorage.setItem(CLAVE, JSON.stringify(s));
    else localStorage.removeItem(CLAVE);
  } catch {
    /* almacenamiento no disponible: la sesión dura solo esta pestaña */
  }
}

let renovando: Promise<boolean> | null = null;

async function renovar(): Promise<boolean> {
  const s = leerSesion();
  if (!s) return false;
  renovando ??= (async () => {
    try {
      const r = await fetch(`${BASE}/api/auth/renovar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: s.refresh_token }),
      });
      if (!r.ok) return false;
      guardarSesion((await r.json()).sesion);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (renovando = null), 0);
    }
  })();
  return renovando;
}

function porExpirar(s: Sesion) {
  return !!s.expires_at && s.expires_at * 1000 - Date.now() < 60_000;
}

export async function api<T = unknown>(
  ruta: string,
  opciones: { method?: string; body?: unknown; sinSesion?: boolean } = {},
  reintento = true,
): Promise<T> {
  let s = leerSesion();
  if (s && !opciones.sinSesion && porExpirar(s)) {
    await renovar();
    s = leerSesion();
  }
  let r: Response;
  try {
    r = await fetch(`${BASE}${ruta}`, {
      method: opciones.method ?? "GET",
      headers: {
        ...(opciones.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(s && !opciones.sinSesion ? { Authorization: `Bearer ${s.access_token}` } : {}),
      },
      body: opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.", "SIN_CONEXION");
  }

  if (r.status === 401 && !opciones.sinSesion && reintento && (await renovar())) {
    return api<T>(ruta, opciones, false);
  }
  if (r.status === 204) return undefined as T;

  let datos: any = null;
  try {
    datos = await r.json();
  } catch {
    /* respuesta sin cuerpo */
  }
  if (!r.ok) {
    if (r.status === 401 && !opciones.sinSesion) {
      guardarSesion(null);
      alExpirar();
    }
    throw new ApiError(r.status, datos?.detalle ?? "Ocurrió un error. Intenta de nuevo.", datos?.codigo);
  }
  return datos as T;
}

/** Sube un archivo directo a Supabase Storage usando la URL temporal que dio el backend. */
export async function subirArchivo(url: string, archivo: File) {
  const datos = new FormData();
  datos.append("cacheControl", "3600");
  datos.append("", archivo);
  const r = await fetch(url, { method: "PUT", body: datos, headers: { "x-upsert": "false" } });
  if (!r.ok) throw new ApiError(r.status, "No se pudo subir el archivo. Intenta de nuevo.", "SUBIDA");
}
