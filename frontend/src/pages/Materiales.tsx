import { useRef, useState, type ChangeEvent } from "react";
import { Icono } from "../components/Icono";
import { Boton, CajaError, Cargando, Confirmar, Encabezado, Importante, useAvisos, Vacio } from "../components/ui";
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

  const [cola, setCola] = useState<{ nombre: string; estado: "esperando" | "subiendo" | "listo" | "error"; msg?: string }[]>([]);

  async function subirUno(archivo: File) {
    if (!datos) return;
    if (!TIPOS[archivo.type]) throw new Error("Formato no permitido. Solo PDF, Word (.docx), JPG y PNG.");
    if (archivo.size > datos.limite_bytes) throw new Error(`Pesa ${tamano(archivo.size)}. El máximo es ${tamano(datos.limite_bytes)}.`);
    const prep = await api<{ ruta: string; url_subida: string }>(`/api/actividades/${idActividad}/materiales/subida`, {
      method: "POST", body: { nombre: archivo.name, tipo_mime: archivo.type, tamano_bytes: archivo.size },
    });
    await subirArchivo(prep.url_subida, archivo);
    await api(`/api/actividades/${idActividad}/materiales`, {
      method: "POST", body: { ruta: prep.ruta, nombre: archivo.name, tipo_mime: archivo.type },
    });
  }

  /** Se pueden elegir varios archivos a la vez; se suben uno por uno y se ve cómo va cada uno. */
  async function elegir(e: ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!archivos.length || !datos) return;
    setCola(archivos.map((a) => ({ nombre: a.name, estado: "esperando" })));
    setSubiendo(true);
    let bien = 0;
    for (let k = 0; k < archivos.length; k++) {
      setCola((c) => c.map((x, i) => (i === k ? { ...x, estado: "subiendo" } : x)));
      try {
        await subirUno(archivos[k]);
        bien++;
        setCola((c) => c.map((x, i) => (i === k ? { ...x, estado: "listo" } : x)));
      } catch (err) {
        const msg = err instanceof ApiError || err instanceof Error ? err.message : "No se pudo subir";
        setCola((c) => c.map((x, i) => (i === k ? { ...x, estado: "error", msg } : x)));
      }
    }
    setSubiendo(false);
    const mal = archivos.length - bien;
    if (mal === 0) avisar(bien === 1 ? `Se subió ${archivos[0].name}` : `Se subieron ${bien} archivos`);
    else avisar(`Se subieron ${bien} de ${archivos.length}. Revisa los marcados en rojo.`, "error");
    if (bien) recargar();
  }

  async function ver(m: Material) {
    const ventana = window.open("", "_blank");  // se abre antes para que el navegador no la bloquee
    try {
      const { url } = await api<{ url: string }>(`/api/materiales/${m.id_material}/descarga?ver=true`);
      if (ventana) ventana.location.href = url;
      else window.location.assign(url);
    } catch (err) {
      ventana?.close();
      avisar((err as ApiError).message, "error");
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
            <input ref={entrada} type="file" hidden multiple onChange={elegir}
              accept=".pdf,.docx,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
            <Boton icono="subir" cargando={subiendo} onClick={() => entrada.current?.click()}>
              {subiendo ? "Subiendo…" : "Subir archivos"}
            </Boton>
          </>
        )}
      </div>
      {datos.puede_gestionar && (
        <Importante titulo="Archivos que se aceptan">PDF, Word (.docx), JPG o PNG de hasta <strong>{tamano(datos.limite_bytes)}</strong> cada uno. Puedes elegir varios a la vez.</Importante>
      )}
      {cola.length > 0 && (
        <ul className="subida-cola" aria-live="polite">
          {cola.map((c, i) => (
            <li key={i}>
              <span className={c.estado === "listo" ? "ok" : c.estado === "error" ? "mal" : ""}>
                {c.estado === "listo" ? "✓" : c.estado === "error" ? "✗" : c.estado === "subiendo" ? "…" : "•"}
              </span>
              <span>{c.nombre}</span>
              {c.msg && <span className="mal">{c.msg}</span>}
            </li>
          ))}
        </ul>
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
              {m.tipo_mime !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && (
                <button className="icono-btn con-texto ver" onClick={() => ver(m)} aria-label={`Ver ${m.nombre_original}`} title="Ver">
                  <Icono nombre="ver" tam={18} /><span>Ver</span>
                </button>
              )}
              <button className="icono-btn con-texto editar" onClick={() => descargar(m)} aria-label={`Descargar ${m.nombre_original}`} title="Descargar">
                <Icono nombre="descargar" tam={18} /><span>Descargar</span>
              </button>
              {datos.puede_gestionar && (
                <button className="icono-btn con-texto peligro" onClick={() => setBorrar(m)} aria-label={`Eliminar ${m.nombre_original}`} title="Eliminar">
                  <Icono nombre="borrar" tam={18} /><span>Eliminar</span>
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
