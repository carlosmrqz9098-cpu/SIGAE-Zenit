import { CajaError, Cargando, Encabezado, Insignia, Vacio } from "../components/ui";
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
  return (
    <>
      <Encabezado titulo="Tareas automáticas" texto="Las corre Supabase por su cuenta. Aquí se ve cuándo se ejecutaron y si algo falló." />
      {cargando && !datos && <Cargando />}
      {error && <CajaError mensaje={error} reintentar={recargar} />}
      {datos && datos.length === 0 && <Vacio titulo="Todavía no hay ejecuciones registradas" />}
      {datos && datos.length > 0 && (
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead><tr><th scope="col">Tarea</th><th scope="col">Inicio</th><th scope="col">Resultado</th><th scope="col">Detalle</th></tr></thead>
            <tbody>
              {datos.map((e) => (
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
    </>
  );
}
