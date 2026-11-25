import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";

/** Carga datos de la API con estado de carga y error. `recargar()` vuelve a pedirlos. */
export function useCarga<T>(ruta: string | null) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!ruta) return;
    let vivo = true;
    setCargando(true);
    setError(null);
    api<T>(ruta)
      .then((d) => vivo && setDatos(d))
      .catch((e: ApiError) => vivo && setError(e.message))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [ruta, n]);

  const recargar = useCallback(() => setN((x) => x + 1), []);
  return { datos, error, cargando, recargar, setDatos };
}
