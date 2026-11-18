import { TiraDias } from "../components/Horario";
import { CajaError, Cargando, Encabezado, Insignia } from "../components/ui";
import { fecha } from "../lib/formato";
import { Enlace } from "../lib/router";
import { useSesion } from "../lib/sesion";
import type { Grupo, MiInscripcion } from "../lib/tipos";
import { useCarga } from "../lib/useCarga";

interface Panel {
  periodo: { nombre: string; estado: string; fecha_hora_inicio: string; fecha_hora_fin: string } | null;
  indicadores?: Record<string, number>;
  proximas?: MiInscripcion[];
  grupos?: Grupo[];
  indicadores_docente?: { grupos: number; alumnos: number; sin_captura: number };
  actividades?: { id_actividad: number; nombre: string; estado: string; cupo_maximo: number; inscritos: number }[];
}

function Cifra({ valor, texto, destacar }: { valor: number | undefined; texto: string; destacar?: boolean }) {
  return (
    <div className={`cifra ${destacar ? "cifra-destacada" : ""}`}>
      <strong>{valor ?? 0}</strong>
      <span>{texto}</span>
    </div>
  );
}

function saludo() {
  const h = Number(new Date().toLocaleString("es-MX", { hour: "numeric", hour12: false, timeZone: "America/Mexico_City" }));
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

export function Inicio() {
  const { usuario } = useSesion();
  const { datos, error, cargando, recargar } = useCarga<Panel>("/api/panel");
  if (!usuario) return null;
  const nombre = usuario.nombre.split(" ")[0];

  return (
    <>
      <Encabezado titulo={`${saludo()}, ${nombre}`} texto={usuario.rol === "Alumno"
        ? "Aquí ves tus actividades y cómo va tu crédito."
        : usuario.rol === "Docente" ? "Aquí ves tus grupos y lo que falta capturar."
        : "Así va el área de Actividades Extra-Escolares."} />

      {cargando && <Cargando />}
      {error && <CajaError mensaje={error} reintentar={recargar} />}
      {datos && (
        <>
          <section className="periodo-banda">
            {datos.periodo ? (
              <>
                <div>
                  <span className="periodo-nombre">{datos.periodo.nombre}</span>
                  <span className="periodo-fechas">{fecha(datos.periodo.fecha_hora_inicio)} al {fecha(datos.periodo.fecha_hora_fin)}</span>
                </div>
                <Insignia valor={datos.periodo.estado} />
              </>
            ) : (
              <span className="periodo-nombre">Todavía no hay un periodo registrado</span>
            )}
          </section>

          {usuario.rol === "Alumno" && datos.indicadores && (
            <>
              <section className="cifras">
                <Cifra valor={datos.indicadores.inscripciones_activas} texto="inscripciones activas" />
                <Cifra valor={datos.indicadores.acreditadas} texto="créditos acreditados" destacar />
                <Cifra valor={datos.indicadores.pendientes} texto="en espera de evaluación" />
                <Cifra valor={datos.indicadores.actividades_disponibles} texto="actividades con lugar" />
              </section>
              <section className="bloque">
                <div className="bloque-cabeza">
                  <h2>Mis actividades</h2>
                  <Enlace a="/mis-inscripciones" className="enlace">Ver todas</Enlace>
                </div>
                {datos.proximas && datos.proximas.length > 0 ? (
                  <ul className="lista-filas">
                    {datos.proximas.map((i) => (
                      <li key={i.id_inscripcion}>
                        <div className="fila-principal">
                          <strong>{i.actividad}</strong>
                          <span>{i.aula}</span>
                        </div>
                        <TiraDias dias={i.dias} inicio={i.hora_inicio} fin={i.hora_fin} />
                        <Insignia valor={i.estatus_credito} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="aviso-suave">
                    <p>Aún no te inscribes a ninguna actividad.</p>
                    <Enlace a="/catalogo" className="btn btn-principal">Ver el catálogo</Enlace>
                  </div>
                )}
              </section>
            </>
          )}

          {datos.indicadores_docente && (
            <>
              <section className="cifras">
                <Cifra valor={datos.indicadores_docente.grupos} texto="grupos a mi cargo" />
                <Cifra valor={datos.indicadores_docente.alumnos} texto="alumnos inscritos" />
                <Cifra valor={datos.indicadores_docente.sin_captura} texto="alumnos sin captura" destacar />
              </section>
              <section className="bloque">
                <div className="bloque-cabeza">
                  <h2>Mis grupos</h2>
                  <Enlace a="/grupos" className="enlace">Ver todos</Enlace>
                </div>
                {datos.grupos && datos.grupos.length > 0 ? (
                  <ul className="lista-filas">
                    {datos.grupos.map((g) => (
                      <li key={g.id_actividad}>
                        <div className="fila-principal">
                          <Enlace a={`/grupos/${g.id_actividad}`} className="enlace-fuerte">{g.nombre}</Enlace>
                          <span>{g.aula} · {g.inscritos} de {g.cupo_maximo} alumnos</span>
                        </div>
                        <TiraDias dias={g.dias} inicio={g.hora_inicio} fin={g.hora_fin} />
                        <Insignia valor={g.estado} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="texto-suave">No tienes actividades asignadas en este momento.</p>
                )}
              </section>
            </>
          )}

          {(usuario.rol === "Administrador" || usuario.rol === "Personal") && datos.indicadores && (
            <>
              <section className="cifras">
                <Cifra valor={datos.indicadores.inscripciones_activas} texto="inscripciones activas" destacar />
                <Cifra valor={datos.indicadores.actividades_abiertas} texto="actividades abiertas" />
                <Cifra valor={datos.indicadores.borradores} texto="actividades en borrador" />
                <Cifra valor={datos.indicadores.alumnos} texto="alumnos activos" />
                <Cifra valor={datos.indicadores.docentes} texto="docentes activos" />
                <Cifra valor={datos.indicadores.acreditados} texto="créditos acreditados" />
              </section>
              <section className="bloque">
                <div className="bloque-cabeza">
                  <h2>Ocupación de actividades</h2>
                  <Enlace a="/actividades" className="enlace">Administrar</Enlace>
                </div>
                {datos.actividades && datos.actividades.length > 0 ? (
                  <ul className="ocupacion">
                    {datos.actividades.map((a) => {
                      const pct = a.cupo_maximo ? Math.round((a.inscritos / a.cupo_maximo) * 100) : 0;
                      return (
                        <li key={a.id_actividad}>
                          <span className="ocupacion-nombre">{a.nombre}</span>
                          <span className="ocupacion-barra"><span style={{ width: `${Math.min(pct, 100)}%` }} /></span>
                          <span className="ocupacion-num">{a.inscritos}/{a.cupo_maximo}</span>
                          <Insignia valor={a.estado} />
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="texto-suave">No hay actividades registradas.</p>
                )}
              </section>
            </>
          )}
        </>
      )}
    </>
  );
}
