import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, cuandoExpire, guardarSesion, leerSesion, type Sesion } from "./api";
import type { Usuario } from "./tipos";

interface Ctx {
  usuario: Usuario | null;
  cargando: boolean;
  aviso: string | null;
  entrar: (correo: string, contrasena: string) => Promise<void>;
  salir: () => Promise<void>;
}

const SesionCtx = createContext<Ctx>(null as unknown as Ctx);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    cuandoExpire(() => {
      setUsuario(null);
      setAviso("Tu sesión expiró. Vuelve a iniciar sesión.");
    });
    if (!leerSesion()) {
      setCargando(false);
      return;
    }
    api<Usuario>("/api/auth/me")
      .then(setUsuario)
      .catch(() => guardarSesion(null))
      .finally(() => setCargando(false));
  }, []);

  const entrar = useCallback(async (correo: string, contrasena: string) => {
    const r = await api<{ sesion: Sesion; usuario: Usuario }>("/api/auth/login", {
      method: "POST",
      body: { correo, contrasena },
      sinSesion: true,
    });
    guardarSesion(r.sesion);
    setAviso(null);
    setUsuario(r.usuario);
  }, []);

  const salir = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* aunque falle, se borra la sesión local */
    }
    guardarSesion(null);
    setUsuario(null);
  }, []);

  return <SesionCtx.Provider value={{ usuario, cargando, aviso, entrar, salir }}>{children}</SesionCtx.Provider>;
}

export const useSesion = () => useContext(SesionCtx);
