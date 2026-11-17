import { useRef, useState, type ChangeEvent } from "react";
import { Icono } from "../components/Icono";
import { Boton, CajaError, Cargando, Confirmar, Encabezado, useAvisos, Vacio } from "../components/ui";
import { api, ApiError, subirArchivo } from "../lib/api";
import { fechaHora, tamano } from "../lib/formato";
import { useCarga } from "../lib/useCarga";

interface Material {
  id_material: number;
  nombre_original: string;
  tipo_mime: string;
  tamano_bytes: number;
  fecha_carga: string;
  cargado_por: string | null;
}
interface Respuesta {
  actividad: string | null;
  puede_gestionar: boolean;
  limite_bytes: number;
  materiales: Material[];
}

const TIPOS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "image/jpeg": "JPG",
  "image/png": "PNG",
};

export function SeccionMateriales({ idActividad, compacta }: { idActividad: number; compacta?: boolean }) {
  const { datos, error, cargando, recargar } = useCarga<Respuesta>(`/api/actividades/${idActividad}/materiales`);
  const [subiendo, setSubiendo] = useState(false);
  const [borrar, setBorrar] = useState<Material | null>(null);
  const [borrando, setBorrando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const avisar = useAvisos();

  async function elegir(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo || !datos) return;
    if (!TIPOS[archivo.type]) {
      avisar("Formato no permitido. Solo PDF, Word (.docx), JPG y PNG.", "error");
      return;
    }
    if (archivo.size > datos.limite_bytes) {
      avisar(`El archivo pesa ${tamano(archivo.size)}. El máximo es ${tamano(datos.limite_bytes)}.`, "error");
      return;
    }
    setSubiendo(true);
    try {
      const prep = await api<{ ruta: string; url_subida: string }>(`/api/actividades/${idActividad}/materiales/subida`, {
        method: "POST", body: { nombre: archivo.name, tipo_mime: archivo.type, tamano_bytes: archivo.size },
      });
      await subirArchivo(prep.url_subida, archivo);
      await api(`/api/actividades/${idActividad}/materiales`, {
        method: "POST", body: { ruta: prep.ruta, nombre: archivo.name, tipo_mime: archivo.type },
      });
      avisar(`Se subió ${archivo.name}`);
      recargar();
    } catch (err) {
      avisar((err as ApiError).message, "error");
    } finally {
      setSubiendo(false);
    }
  }

  async function descargar(m: Material) {
    try {
      const { url } = await api<{ url: string }>(`/api/materiales/${m.id_material}/descarga`);
      window.location.assign(url);
    } catch (err) {
      avisar((err as ApiError).message, "error");
    }
  }

  async function eliminar() {
    if (!borrar) return;
    setBorrando(true);
    try {
      await api(`/api/materiales/${borrar.id_material}`, { method: "DELETE" });
      avisar(`Se eliminó ${borrar.nombre_original}`);
      recargar();
    } catch (err) {
      avisar((err as ApiError).message, "error");
    } finally {
      setBorrando(false);
      setBorrar(null);
    }
  }

  if (cargando && !datos) return <Cargando texto="Cargando materiales…" />;
  if (error) return <CajaError mensaje={error} reintentar={recargar} />;
  if (!datos) return null;

  return (
    <section className={compacta ? "bloque" : ""}>
      <div className="bloque-cabeza">
        {compacta ? <h2>Materiales</h2> : <span />}
        {datos.puede_gestionar && (
          <>
            <input ref={entrada} type="file" hidden onChange={elegir}
              accept=".pdf,.docx,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
            <Boton icono="subir" cargando={subiendo} onClick={() => entrada.current?.click()}>
              {subiendo ? "Subiendo…" : "Subir material"}
            </Boton>
          </>
        )}
      </div>
      {datos.puede_gestionar && (
        <p className="texto-suave">PDF, Word (.docx), JPG o PNG de hasta {tamano(datos.limite_bytes)}.</p>
      )}
      {datos.materiales.length === 0 ? (
        <Vacio titulo="Sin materiales todavía" texto={datos.puede_gestionar ? "Sube el primer archivo para tu grupo." : "Cuando el responsable suba archivos, aparecerán aquí."} />
      ) : (
        <ul className="archivos">
          {datos.materiales.map((m) => (
            <li key={m.id_material}>
              <span className={`archivo-tipo tipo-${TIPOS[m.tipo_mime] ?? "x"}`}>{TIPOS[m.tipo_mime] ?? "Archivo"}</span>
              <div className="archivo-datos">
                <strong>{m.nombre_original}</strong>
                <span>{tamano(m.tamano_bytes)} · {fechaHora(m.fecha_carga)}{m.cargado_por ? ` · ${m.cargado_por}` : ""}</span>
              </div>
              <button className="icono-btn" onClick={() => descargar(m)} aria-label={`Descargar ${m.nombre_original}`} title="Descargar">
                <Icono nombre="descargar" />
              </button>
              {datos.puede_gestionar && (
                <button className="icono-btn peligro" onClick={() => setBorrar(m)} aria-label={`Eliminar ${m.nombre_original}`} title="Eliminar">
                  <Icono nombre="borrar" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Confirmar abierto={!!borrar} titulo="Eliminar material" peligro accion="Sí, eliminar" cargando={borrando}
        alCerrar={() => setBorrar(null)} alConfirmar={eliminar}
        texto={borrar && <p>Se eliminará <strong>{borrar.nombre_original}</strong> y ya no se podrá descargar.</p>} />
    </section>
  );
}

export function Materiales({ params }: { params: Record<string, string> }) {
  const id = Number(params.id);
  const { datos } = useCarga<Respuesta>(`/api/actividades/${id}/materiales`);
  return (
    <>
      <Encabezado titulo="Materiales" texto={datos?.actividad ?? undefined} />
      <SeccionMateriales idActividad={id} />
    </>
  );
}
