import { useMemo, useState, type ReactNode } from "react";

// ------------------------------------------------------------------ Ordenar tablas
// Clic en el título de una columna: primero A→Z (↑), otro clic Z→A (↓).
// Ordena la lista que ya viene filtrada, así que respeta el buscador y los filtros.

export type Direccion = "asc" | "desc";
export interface Orden<C extends string> { columna: C; direccion: Direccion }

// Compara números como números y textos sin importar mayúsculas ni acentos ("Ángel" junto a "Ana").
function comparar(a: unknown, b: unknown) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "es", { sensitivity: "base", numeric: true });
}

export function useOrden<T, C extends string>(lista: T[], valor: (fila: T, columna: C) => string | number | null | undefined) {
  const [orden, setOrden] = useState<Orden<C> | null>(null);

  const ordenada = useMemo(() => {
    if (!orden) return lista;
    const signo = orden.direccion === "asc" ? 1 : -1;
    return [...lista].sort((x, y) => {
      const a = valor(x, orden.columna);
      const b = valor(y, orden.columna);
      // Los vacíos siempre al final, sin importar la dirección
      if (a == null || a === "") return b == null || b === "" ? 0 : 1;
      if (b == null || b === "") return -1;
      return signo * comparar(a, b);
    });
  }, [lista, orden, valor]);

  const alternar = (columna: C) =>
    setOrden((o) => (o?.columna === columna && o.direccion === "asc" ? { columna, direccion: "desc" } : { columna, direccion: "asc" }));

  return { ordenada, orden, alternar };
}

export function ThOrdenable<C extends string>({ columna, orden, alternar, children }: {
  columna: C; orden: Orden<C> | null; alternar: (c: C) => void; children: ReactNode;
}) {
  const activa = orden?.columna === columna;
  const direccion = activa ? orden.direccion : null;
  return (
    <th scope="col" aria-sort={direccion === "asc" ? "ascending" : direccion === "desc" ? "descending" : "none"}>
      <button type="button" className="th-orden" onClick={() => alternar(columna)}>
        <span>{children}</span>
        <span className="th-flecha" aria-hidden>{direccion === "asc" ? "↑" : direccion === "desc" ? "↓" : "↕"}</span>
      </button>
    </th>
  );
}