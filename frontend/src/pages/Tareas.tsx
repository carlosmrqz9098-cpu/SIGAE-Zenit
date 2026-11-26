import { useMemo, useState } from "react";
import { CajaError, Cargando, Encabezado, Insignia, Paginacion, usePaginas, Vacio } from "../components/ui";
import { fechaHora } from "../lib/formato";
import { useCarga } from "../lib/useCarga";

interface Ejecucion { id_ejecucion: number; tarea: string; inicio: string; fin: string | null; resultado: string; detalle: Record<string, unknown> | null; error: string | null }

const NOMBRES: Record<string, string> = {
  abrir_cerrar_periodos: "Abrir y cerrar periodos (cada minuto)",
  cerrar_actividades: "Cerrar actividades (diario, 00:05)",
  respaldo: "Respaldo",
  prueba_restauracion: "Prueba de restauración",
};

export function Tareas() {
  const { datos, error, cargando, recargar } = useCarga<Ejecucion[]>("/api/tareas");
  const [tarea, setTarea] = useState("");
  const [resultado, setResultado] = useState("");
  const lista = useMemo(() => (datos ?? []).filter((e) => (!tarea || e.tarea === tarea) && (!resultado || e.resultado === resultado)), [datos, tarea, resultado]);
  const pag = usePaginas(lista, 15);
  const fallas = (datos ?? []).filter((e) => e.resultado === "Fallida").length;
  return (
    <>
      <Encabezado titulo="Tareas automáticas" texto="Las corre Supabase por su cuenta. Aquí se ve cuándo se ejecutaron y si algo falló." />
      {datos && datos.length > 0 && (
        <div className="filtros">
          <select value={tarea} onChange={(e) => setTarea(e.target.value)} aria-label="Filtrar por tarea">
            <option value="">Todas las tareas</option>
            {[...new Set(datos.map((e) => e.tarea))].map((t) => <option key={t} value={t}>{NOMBRES[t] ?? t}</option>)}
          </select>
          <select value={resultado} onChange={(e) => setResultado(e.target.value)} aria-label="Filtrar por resultado">
            <option value="">Todos los resultados</option>
            {[...new Set(datos.map((e) => e.resultado))].map((r) => <option key={r}>{r}</option>)}
          </select>
          {fallas > 0 && <button type="button" className="enlace-boton peligro" onClick={() => setResultado("Fallida")}>Ver {fallas} fallidas</button>}
        </div>
      )}
      {cargando && !datos && <Cargando />}
      {error && <CajaError mensaje={error} reintentar={recargar} />}
      {datos && datos.length === 0 && <Vacio titulo="Todavía no hay ejecuciones registradas" />}
      {datos && datos.length > 0 && lista.length === 0 && <Vacio titulo="Ninguna ejecución con ese filtro" />}
      {lista.length > 0 && (
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead><tr><th scope="col">Tarea</th><th scope="col">Inicio</th><th scope="col">Resultado</th><th scope="col">Detalle</th></tr></thead>
            <tbody>
              {pag.visibles.map((e) => (
                <tr key={e.id_ejecucion}>
                  <td data-col="Tarea"><strong>{NOMBRES[e.tarea] ?? e.tarea}</strong></td>
                  <td data-col="Inicio">{fechaHora(e.inicio)}</td>
                  <td data-col="Resultado"><Insignia valor={e.resultado} /></td>
                  <td data-col="Detalle" className="detalle-tarea">{e.error ?? (e.detalle ? Object.entries(e.detalle).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ") : "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lista.length > 0 && <Paginacion {...pag} />}
    </>
  );
}
