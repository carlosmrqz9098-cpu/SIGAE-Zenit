import { Marcador, TiraDias } from "../components/Horario";
import { CajaError, Cargando, Encabezado, Insignia, Vacio } from "../components/ui";
import { Enlace } from "../lib/router";
import type { Grupo } from "../lib/tipos";
import { useCarga } from "../lib/useCarga";

export function MisGrupos() {
  const { datos, error, cargando, recargar } = useCarga<Grupo[]>("/api/grupos");
  return (
    <>
      <Encabezado titulo="Mis grupos" texto="Actividades de las que eres responsable. Entra a cada una para capturar asistencia y evidencia." />
      {cargando && !datos && <Cargando />}
      {error && <CajaError mensaje={error} reintentar={recargar} />}
      {datos && datos.length === 0 && <Vacio titulo="No tienes grupos asignados" texto="Cuando Servicios Extra-Escolares te asigne una actividad, aparecerá aquí." />}
      <div className="tarjetas">
        {datos?.map((g) => (
          <article key={g.id_actividad} className="tarjeta-act">
            <div className="tarjeta-act-cuerpo">
              <div className="tarjeta-act-cabeza">
                <h2>{g.nombre}</h2>
                <Insignia valor={g.estado} />
              </div>
              <TiraDias dias={g.dias} inicio={g.hora_inicio} fin={g.hora_fin} />
              <p className="texto-suave">{g.aula}</p>
            </div>
            <div className="tarjeta-act-pie">
              <Marcador inscritos={g.inscritos} cupo={g.cupo_maximo} />
              <Enlace a={`/grupos/${g.id_actividad}`} className="btn btn-principal">Abrir grupo</Enlace>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
