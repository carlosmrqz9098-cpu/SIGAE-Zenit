// Navegación sencilla con la URL del navegador (sin librerías extra).
import { createContext, useContext, useEffect, useState, type ReactNode, type MouseEvent } from "react";

const Ctx = createContext<{ ruta: string; ir: (r: string) => void }>({ ruta: "/", ir: () => {} });

export function Enrutador({ children }: { children: ReactNode }) {
  const [ruta, setRuta] = useState(window.location.pathname);
  useEffect(() => {
    const f = () => setRuta(window.location.pathname);
    window.addEventListener("popstate", f);
    return () => window.removeEventListener("popstate", f);
  }, []);
  const ir = (r: string) => {
    if (r !== window.location.pathname) window.history.pushState({}, "", r);
    setRuta(r);
    window.scrollTo(0, 0);
  };
  return <Ctx.Provider value={{ ruta, ir }}>{children}</Ctx.Provider>;
}

export const useRuta = () => useContext(Ctx);

/** Compara "/grupos/:id" con "/grupos/7" → { id: "7" } */
export function coincide(patron: string, ruta: string): Record<string, string> | null {
  const a = patron.split("/").filter(Boolean);
  const b = ruta.split("/").filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(":")) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

export function Enlace({ a, children, className, ...resto }: { a: string; children: ReactNode; className?: string; "aria-current"?: "page" }) {
  const { ir } = useRuta();
  const click = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    ir(a);
  };
  return (
    <a href={a} onClick={click} className={className} {...resto}>
      {children}
    </a>
  );
}
