import { useEffect, useMemo, useState } from "react";
import { TiraDias } from "../components/Horario";
import { Boton, CajaError, Cargando, Encabezado, EstadoCredito, Insignia, useAvisos, Vacio } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { fechaHora } from "../lib/formato";
import { Enlace } from "../lib/router";
import { useSesion } from "../lib/sesion";
import { useCarga } from "../lib/useCarga";
import { SeccionMateriales } from "./Materiales";

interface Alumno {
  id_inscripcion: number;
  matricula: string;
  nombre: string;
  estado_inscripcion: string;
  porcentaje_asistencia: number | null;
  evidencia_cumplida: boolean | null;
  estatus_credito: string | null;
  fecha_evaluacion: string | null;
}
interface Respuesta {
  actividad: {
    nombre: string; descripcion: string | null; dias: string; hora_inicio: string; hora_fin: string;
    cupo_maximo: number; estado: string; aula: string; periodo: string; responsable: string | null;
    asistencia_minima: string | null;
  };
  lista: Alumno[];
}
type Captura = { asistencia: string; evidencia: boolean };

export function Grupo({ params }: { params: Record<string, string> }) {
  const id = Number(params.id);
  const { usuario } = useSesion();
  const { datos, error, cargando, recargar } = useCarga<Respuesta>(`/api/actividades/${id}/grupo`);
  const [captura, setCaptura] = useState<Record<number, Captura>>({});
  const [errores, setErrores] = useState<Record<number, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [clases, setClases] = useState("");
  const [asistio, setAsistio] = useState<Record<number, string>>({});
  const avisar = useAvisos();

  useEffect(() => {
    if (!datos) return;
    const inicial: Record<number, Captura> = {};
    datos.lista.forEach((a) => {
      inicial[a.id_inscripcion] = {
        asistencia: a.porcentaje_asistencia === null ? "" : String(Number(a.porcentaje_asistencia)),
        evidencia: !!a.evidencia_cumplida,
      };
    });
    setCaptura(inicial);
    setErrores({});
  }, [datos]);

  const editables = useMemo(() => (datos?.lista ?? []).filter((a) => a.estado_inscripcion !== "Cancelada"), [datos]);
  const cambios = editables.filter((a) => {
    const c = captura[a.id_inscripcion];
    if (!c) return false;
    const antes = a.porcentaje_asistencia === null ? "" : String(Number(a.porcentaje_asistencia));
    return c.asistencia !== antes || c.evidencia !== !!a.evidencia_cumplida;
  });

  const totalClases = Number(clases) > 0 ? Math.floor(Number(clases)) : 0;
  /** El docente escribe cuántas clases vino el alumno y el sistema saca el porcentaje. */
  function contarClases(id: number, v: string) {
    setAsistio((x) => ({ ...x, [id]: v }));
    const n = Number(v);
    if (totalClases && v !== "" && Number.isFinite(n) && n >= 0) {
      poner(id, { asistencia: String(Math.min(100, Math.round((Math.min(n, totalClases) / totalClases) * 100))) });
    }
  }
  const poner = (id: number, cambio: Partial<Captura>) =>
    setCaptura((x) => ({ ...x, [id]: { ...x[id], ...cambio } }));
  const todos = (cambio: Partial<Captura>) =>
    setCaptura((x) => {
      const n = { ...x };
      editables.filter((a) => a.estado_inscripcion === "Activa").forEach((a) => { if (n[a.id_inscripcion]) n[a.id_inscripcion] = { ...n[a.id_inscripcion], ...cambio }; });
      return n;
    });

  function valida(v: string) {
    if (v === "") return "Escribe un porcentaje";
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? null : "De 0 a 100";
  }

  async function guardar() {
    const malos: Record<number, string> = {};
    cambios.forEach((a) => {
      const m = valida(captura[a.id_inscripcion].asistencia);
      if (m) malos[a.id_inscripcion] = m;
    });
    setErrores(malos);
    if (Object.keys(malos).length) {
      avisar("Revisa los porcentajes marcados en rojo.", "error");
      return;
    }
    setGuardando(true);
    try {
      const r = await api<{ guardados: number; con_error: number; resultados: { id_inscripcion: number; guardado: boolean; mensaje: string | null }[] }>(
        `/api/actividades/${id}/metricas`,
        {
          method: "PUT",
          body: {
            capturas: cambios.map((a) => ({
              id_inscripcion: a.id_inscripcion,
              porcentaje_asistencia: Number(captura[a.id_inscripcion].asistencia),
              evidencia_cumplida: captura[a.id_inscripcion].evidencia,
            })),
          },
        },
      );
      const fallos: Record<number, string> = {};
      r.resultados.filter((x) => !x.guardado).forEach((x) => (fallos[x.id_inscripcion] = x.mensaje ?? "No se guardó"));
      if (r.con_error) avisar(`Se guardaron ${r.guardados}; ${r.con_error} no se pudieron guardar.`, "error");
      else avisar(`Se guardaron ${r.guardados} ${r.guardados === 1 ? "captura" : "capturas"}`);
      recargar();
      setTimeout(() => setErrores(fallos), 0);
    } catch (e) {
      avisar((e as ApiError).message, "error");
    } finally {
      setGuardando(false);
    }
  }

  const volver = usuario?.rol === "Administrador" || usuario?.rol === "Personal" ? "/actividades" : "/grupos";

  return (
    <>
      <Enlace a={volver} className="regresar">← {volver === "/grupos" ? "Mis grupos" : "Actividades"}</Enlace>
      {cargando && !datos && <Cargando />}
      {error && <CajaError mensaje={error} reintentar={recargar} />}
      {datos && (
        <>
          <Encabezado titulo={datos.actividad.nombre} texto={`${datos.actividad.periodo} · ${datos.actividad.aula}${datos.actividad.responsable ? ` · ${datos.actividad.responsable}` : ""}`}
            acciones={<Insignia valor={datos.actividad.estado} />} />
          <div className="ficha">
            <TiraDias dias={datos.actividad.dias} inicio={datos.actividad.hora_inicio} fin={datos.actividad.hora_fin} />
            <p>Para acreditar: <strong>{datos.actividad.asistencia_minima ?? "80"}%</strong> de asistencia y evidencia entregada. El estatus lo calcula el sistema: si cumple queda <strong>Acreditado</strong> y si no, <strong>No acreditado</strong>.</p>
          </div>

          <section className="bloque">
            <div className="bloque-cabeza">
              <h2>Lista del grupo <span className="contador">{editables.length}</span></h2>
              <Boton onClick={guardar} cargando={guardando} disabled={cambios.length === 0}>
                {cambios.length ? `Guardar ${cambios.length} ${cambios.length === 1 ? "cambio" : "cambios"}` : "Sin cambios"}
              </Boton>
            </div>
            {editables.length > 0 && (
              <div className="barra-grupo">
                <Boton variante="secundario" className="btn-chico" onClick={() => todos({ asistencia: "100" })}>Todos con 100 % de asistencia</Boton>
                <Boton variante="secundario" className="btn-chico" onClick={() => todos({ evidencia: true })}>Todos entregaron evidencia</Boton>
                <span className="texto-suave">Después ajusta solo a quien le falte y da clic en Guardar.</span>
              </div>
            )}
            {editables.length > 0 && (
              <div className="calc-clases">
                <label>
                  <span>¿Cuántas clases has dado?</span>
                  <input type="number" min={1} inputMode="numeric" value={clases} onChange={(e) => setClases(e.target.value)} placeholder="Ej. 20" />
                </label>
                <span className="texto-suave">
                  {totalClases ? `Escribe cuántas vino cada alumno y el porcentaje se calcula solo (de ${totalClases} clases).` : "Opcional: si lo llenas, en cada alumno escribes cuántas clases vino y el % se calcula solo."}
                </span>
              </div>
            )}
            {datos.lista.length === 0 ? (
              <Vacio titulo="Nadie se ha inscrito todavía" texto="Cuando los alumnos se inscriban, aparecerán aquí." />
            ) : (
              <div className="tabla-envoltura">
                <table className="tabla tabla-captura">
                  <thead>
                    <tr>
                      <th scope="col">Alumno</th>
                      <th scope="col">Asistencia (%)</th>
                      <th scope="col">Evidencia</th>
                      <th scope="col">Crédito</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.lista.map((a) => {
                      const c = captura[a.id_inscripcion];
                      const cancelada = a.estado_inscripcion === "Cancelada";
                      return (
                        <tr key={a.id_inscripcion} className={cancelada ? "apagada" : ""}>
                          <td data-col="Alumno">
                            <strong>{a.nombre}</strong>
                            <span className="texto-suave">{a.matricula}{cancelada ? " · dado de baja" : ""}</span>
                          </td>
                          <td data-col="Asistencia (%)">
                            <div className="asist">
                              <div className="asist-fila">
                                <input className={`num ${errores[a.id_inscripcion] ? "con-error" : ""}`} type="number" min={0} max={100} step={1}
                                  inputMode="numeric" disabled={cancelada || !c} value={c?.asistencia ?? ""}
                                  aria-label={`Asistencia de ${a.nombre}`}
                                  onChange={(e) => poner(a.id_inscripcion, { asistencia: e.target.value })} />
                                <span className="texto-suave">%</span>
                              </div>
                              {!cancelada && c && totalClases > 0 && (
                                <label className="asist-clases">
                                  <span>Vino a</span>
                                  <input type="number" min={0} max={totalClases} inputMode="numeric" value={asistio[a.id_inscripcion] ?? ""}
                                    aria-label={`Clases a las que vino ${a.nombre}`} onChange={(e) => contarClases(a.id_inscripcion, e.target.value)} />
                                  <span>de {totalClases}</span>
                                </label>
                              )}
                              {!cancelada && c && (
                                <div className="asist-rapida" role="group" aria-label={`Asistencia rápida de ${a.nombre}`}>
                                  {["100", "90", "80", "70", "50", "0"].map((v) => (
                                    <button type="button" key={v} className={`${c.asistencia === v ? "on" : ""} ${v === "0" ? "cero" : ""}`}
                                      onClick={() => poner(a.id_inscripcion, { asistencia: v })}>{v}</button>
                                  ))}
                                </div>
                              )}
                            </div>
                            {errores[a.id_inscripcion] && <span className="campo-msg">{errores[a.id_inscripcion]}</span>}
                          </td>
                          <td data-col="Evidencia">
                            <label className="interruptor">
                              <input type="checkbox" disabled={cancelada || !c} checked={c?.evidencia ?? false}
                                onChange={(e) => poner(a.id_inscripcion, { evidencia: e.target.checked })} />
                              <span>{c?.evidencia ? "Entregada" : "No entregada"}</span>
                            </label>
                          </td>
                          <td data-col="Crédito">
                            <EstadoCredito chico valor={cancelada ? "Cancelada" : a.estatus_credito} />
                            {a.fecha_evaluacion && <span className="texto-suave mini">{fechaHora(a.fecha_evaluacion)}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <SeccionMateriales idActividad={id} compacta />
        </>
      )}
    </>
  );
}
