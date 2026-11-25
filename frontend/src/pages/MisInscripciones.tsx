import { useState } from "react";
import { TiraDias } from "../components/Horario";
import { Icono } from "../components/Icono";
import { Boton, CajaError, Cargando, Confirmar, Encabezado, EstadoCredito, useAvisos, Vacio } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { Enlace } from "../lib/router";
import type { MiInscripcion } from "../lib/tipos";
import { useCarga } from "../lib/useCarga";

/** Qué le falta al alumno, en palabras. Solo informa; el estatus lo calcula el sistema. */
function siguientePaso(i: MiInscripcion) {
  if (i.estatus_credito === "Acreditado") return "¡Listo! Tu crédito ya está acreditado.";
  if (i.estado_inscripcion === "Evaluada") return null;
  const quien = i.responsable ?? "tu responsable";
  if (i.porcentaje_asistencia === null && i.evidencia_cumplida === null)
    return `${quien} todavía no captura tu asistencia ni tu evidencia.`;
  if (!i.evidencia_cumplida) return `Entrega tu evidencia a ${quien}; se registra en el sistema cuando la recibe.`;
  return "Sigue asistiendo: tu crédito se calcula al cerrar la actividad.";
}

function Progreso({ i }: { i: MiInscripcion }) {
  if (i.estado_inscripcion === "Cancelada") return <p className="texto-suave">Te diste de baja de esta actividad.</p>;
  const asistencia = i.porcentaje_asistencia;
  const paso = siguientePaso(i);
  return (
    <>
    <div className="progreso">
      <div className="progreso-item">
        <span>Asistencia</span>
        {asistencia === null ? <em>Sin capturar</em> : (
          <>
            <span className="progreso-barra"><span style={{ width: `${Math.min(Number(asistencia), 100)}%` }} /></span>
            <strong>{Number(asistencia).toFixed(0)}%</strong>
          </>
        )}
      </div>
      <div className="progreso-item">
        <span>Evidencia</span>
        {i.evidencia_cumplida === null ? <em>Sin capturar</em> : i.evidencia_cumplida ? <strong className="ok">Entregada</strong> : <strong className="no">No entregada</strong>}
      </div>
    </div>
    {paso && <p className="progreso-ayuda">{paso}</p>}
    </>
  );
}

export function MisInscripciones() {
  const { datos, error, cargando, recargar } = useCarga<MiInscripcion[]>("/api/inscripciones");
  const [baja, setBaja] = useState<MiInscripcion | null>(null);
  const [enviando, setEnviando] = useState(false);
  const avisar = useAvisos();

  async function darBaja() {
    if (!baja) return;
    setEnviando(true);
    try {
      await api(`/api/inscripciones/${baja.id_inscripcion}`, { method: "DELETE" });
      avisar(`Te diste de baja de ${baja.actividad}`);
      recargar();
    } catch (e) {
      avisar((e as ApiError).message, "error");
    } finally {
      setEnviando(false);
      setBaja(null);
    }
  }

  const vigentes = (datos ?? []).filter((i) => i.estado_inscripcion !== "Cancelada");
  const canceladas = (datos ?? []).filter((i) => i.estado_inscripcion === "Cancelada");

  return (
    <>
      <Encabezado titulo="Mis inscripciones" texto="Tu crédito se acredita solo cuando cumples la asistencia mínima y entregas tu evidencia." />
      {cargando && !datos && <Cargando />}
      {error && <CajaError mensaje={error} reintentar={recargar} />}
      {datos && datos.length === 0 && (
        <Vacio titulo="Todavía no tienes inscripciones" texto="Revisa el catálogo y elige una actividad."
          accion={<Enlace a="/catalogo" className="btn btn-principal">Ir al catálogo</Enlace>} />
      )}

      <div className="inscripciones">
        {[...vigentes, ...canceladas].map((i) => (
          <article key={i.id_inscripcion} className={`inscripcion ${i.estado_inscripcion === "Cancelada" ? "apagada" : ""}`}>
            <div className="inscripcion-cabeza">
              <div>
                <h2>{i.actividad}</h2>
                <p className="texto-suave">{i.aula}{i.ubicacion ? `, ${i.ubicacion}` : ""}{i.responsable ? ` · ${i.responsable}` : ""}</p>
              </div>
              <div className="credito">
                <span>Mi crédito</span>
                <EstadoCredito para="alumno" valor={i.estado_inscripcion === "Cancelada" ? "Cancelada" : i.estatus_credito} />
              </div>
            </div>
            <TiraDias dias={i.dias} inicio={i.hora_inicio} fin={i.hora_fin} />
            <Progreso i={i} />
            {i.estado_inscripcion !== "Cancelada" && (
              <div className="inscripcion-acciones">
                <Enlace a={`/actividades/${i.id_actividad}/materiales`} className="btn btn-secundario">
                  <Icono nombre="materiales" tam={18} /><span>Materiales</span>
                </Enlace>
                {i.puede_darse_de_baja && (
                  <Boton variante="fantasma" className="btn-baja" icono="cerrar" onClick={() => setBaja(i)}>Darme de baja</Boton>
                )}
              </div>
            )}
          </article>
        ))}
      </div>

      <Confirmar
        abierto={!!baja}
        titulo="Darte de baja"
        peligro
        accion="Sí, darme de baja"
        cargando={enviando}
        alCerrar={() => setBaja(null)}
        alConfirmar={darBaja}
        texto={baja && <p>Vas a dejar tu lugar en <strong>{baja.actividad}</strong>. Otro alumno podrá ocuparlo.</p>}
      />
    </>
  );
}
