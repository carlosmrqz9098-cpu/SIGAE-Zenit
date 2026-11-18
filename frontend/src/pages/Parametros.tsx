import { useState } from "react";
import { Boton, CajaError, Cargando, Encabezado, useAvisos } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { fechaHora } from "../lib/formato";
import { useSesion } from "../lib/sesion";
import { useCarga } from "../lib/useCarga";

interface Parametro { clave: string; valor: string | null; descripcion: string | null; actualizado_en: string | null; actualizado_por: string | null }

const INFO: Record<string, { titulo: string; unidad?: string; tipo: "numero" | "fecha"; ayuda: string }> = {
  asistencia_minima: { titulo: "Asistencia mínima para acreditar", unidad: "%", tipo: "numero", ayuda: "Porcentaje de 1 a 100. Se aplica en las siguientes evaluaciones." },
  tamano_maximo_mb: { titulo: "Tamaño máximo de archivos", unidad: "MB", tipo: "numero", ayuda: "Límite para cada material que se sube. Entero de 1 a 20." },
  fecha_cierre_evaluaciones: { titulo: "Cierre de evaluaciones", tipo: "fecha", ayuda: "Fecha global para cerrar evaluaciones. Déjalo vacío si no hay fecha." },
};

function Fila({ p, editable, alGuardar }: { p: Parametro; editable: boolean; alGuardar: () => void }) {
  const info = INFO[p.clave] ?? { titulo: p.clave, tipo: "numero" as const, ayuda: p.descripcion ?? "" };
  const inicial = p.valor ?? "";
  const [valor, setValor] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const avisar = useAvisos();

  async function guardar() {
    setGuardando(true);
    try {
      await api(`/api/parametros/${p.clave}`, { method: "PUT", body: { valor } });
      avisar(`${info.titulo}: guardado`);
      alGuardar();
    } catch (e) {
      avisar((e as ApiError).message, "error");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <article className="parametro">
      <div className="parametro-texto">
        <h2>{info.titulo}</h2>
        <p className="texto-suave">{info.ayuda}</p>
        {p.actualizado_en && <p className="texto-suave mini">Último cambio: {fechaHora(p.actualizado_en)}{p.actualizado_por ? ` por ${p.actualizado_por}` : ""}</p>}
      </div>
      <div className="parametro-valor">
        {editable ? (
          <>
            <span className="con-unidad">
              <input type={info.tipo === "fecha" ? "date" : "number"} value={valor} onChange={(e) => setValor(e.target.value)}
                aria-label={info.titulo} min={info.tipo === "numero" ? 1 : undefined} />
              {info.unidad && <span>{info.unidad}</span>}
            </span>
            <Boton variante="secundario" onClick={guardar} cargando={guardando} disabled={valor === inicial}>Guardar</Boton>
          </>
        ) : (
          <strong className="valor-grande">{p.valor ? (info.tipo === "fecha" ? p.valor.split("-").reverse().join("/") : `${p.valor}${info.unidad ? ` ${info.unidad}` : ""}`) : "Sin definir"}</strong>
        )}
      </div>
    </article>
  );
}

export function Parametros() {
  const { usuario } = useSesion();
  const { datos, error, cargando, recargar } = useCarga<Parametro[]>("/api/parametros");
  return (
    <>
      <Encabezado titulo="Parámetros del sistema" texto="Valores que usa SIGAE para acreditar y para aceptar archivos." />
      {cargando && !datos && <Cargando />}
      {error && <CajaError mensaje={error} reintentar={recargar} />}
      <div className="parametros">
        {datos?.map((p) => <Fila key={`${p.clave}-${p.valor}`} p={p} editable={usuario?.rol === "Administrador"} alGuardar={recargar} />)}
      </div>
    </>
  );
}
