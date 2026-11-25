import { useMemo, useState, type FormEvent } from "react";
import { TiraDias } from "../components/Horario";
import { Icono } from "../components/Icono";
import { Boton, CajaError, Campo, Cargando, Confirmar, Encabezado, Insignia, Modal, Paginacion, useAvisos, usePaginas, Vacio } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { hora } from "../lib/formato";
import { Enlace } from "../lib/router";
import { useCarga } from "../lib/useCarga";

interface Actividad {
  id_actividad: number; id_periodo: number; id_aula: number; id_responsable: number | null;
  nombre: string; descripcion: string | null; dias: string; hora_inicio: string; hora_fin: string;
  cupo_maximo: number; estado: string; periodo: string; aula: string; responsable: string | null; inscritos: number;
}
interface Opcion { id: number; texto: string }

const VACIA = { id_periodo: "", id_aula: "", id_responsable: "", nombre: "", descripcion: "", dias: "", hora_inicio: "", hora_fin: "", cupo_maximo: "" };
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function Actividades() {
  const { datos, error, cargando, recargar } = useCarga<Actividad[]>("/api/actividades");
  const periodos = useCarga<{ id_periodo: number; nombre: string; estado: string }[]>("/api/periodos");
  const aulas = useCarga<{ id_aula: number; nombre: string; capacidad: number }[]>("/api/aulas");
  const responsables = useCarga<{ id_usuario: number; nombre: string; rol: string; matricula: string | null }[]>("/api/responsables");
  const avisar = useAvisos();

  const [filtro, setFiltro] = useState("");
  const [estado, setEstado] = useState("");
  const [editando, setEditando] = useState<Actividad | "nueva" | null>(null);
  const [form, setForm] = useState<Record<string, string>>(VACIA);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [accion, setAccion] = useState<{ tipo: "desactivar" | "eliminar" | "reactivar"; a: Actividad } | null>(null);
  const [faltan, setFaltan] = useState<Record<string, string>>({});
  const [procesando, setProcesando] = useState(false);

  const opPeriodos: Opcion[] = (periodos.datos ?? []).filter((p) => p.estado !== "Cerrado").map((p) => ({ id: p.id_periodo, texto: `${p.nombre} (${p.estado})` }));
  const opAulas: Opcion[] = (aulas.datos ?? []).map((a) => ({ id: a.id_aula, texto: `${a.nombre} · cap. ${a.capacidad}` }));
  const opResp: Opcion[] = (responsables.datos ?? []).map((r) => ({ id: r.id_usuario, texto: `${r.nombre} (${r.rol}${r.matricula ? ` ${r.matricula}` : ""})` }));

  const lista = useMemo(() => (datos ?? []).filter((a) =>
    (!estado || a.estado === estado) &&
    (!filtro || `${a.nombre} ${a.aula} ${a.responsable ?? ""} ${a.periodo}`.toLowerCase().includes(filtro.toLowerCase())),
  ), [datos, filtro, estado]);
  const pag = usePaginas(lista, 10);

  function abrir(a: Actividad | "nueva") {
    setErrorForm(null);
    setFaltan({});
    setEditando(a);
    setForm(a === "nueva" ? VACIA : {
      id_periodo: String(a.id_periodo), id_aula: String(a.id_aula), id_responsable: a.id_responsable ? String(a.id_responsable) : "",
      nombre: a.nombre, descripcion: a.descripcion ?? "", dias: a.dias, hora_inicio: hora(a.hora_inicio),
      hora_fin: hora(a.hora_fin), cupo_maximo: String(a.cupo_maximo),
    });
  }

  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const diasElegidos = form.dias.split(",").map((d) => d.trim()).filter(Boolean);
  const alternarDia = (d: string) => {
    const nuevos = diasElegidos.includes(d) ? diasElegidos.filter((x) => x !== d) : DIAS.filter((x) => x === d || diasElegidos.includes(x));
    setForm((f) => ({ ...f, dias: nuevos.join(", ") }));
  };

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const f: Record<string, string> = {};
    if (!form.nombre.trim()) f.nombre = "Escribe el nombre";
    if (!form.id_periodo) f.id_periodo = "Elige el periodo";
    if (!form.id_aula) f.id_aula = "Elige el aula";
    if (!form.id_responsable) f.id_responsable = "Elige al responsable";
    if (!form.dias) f.dias = "Elige al menos un día";
    if (!form.hora_inicio) f.hora_inicio = "Falta la hora";
    if (!form.hora_fin) f.hora_fin = "Falta la hora";
    else if (form.hora_inicio && form.hora_fin <= form.hora_inicio) f.hora_fin = "Debe ser después de la de inicio";
    if (!(Number(form.cupo_maximo) > 0)) f.cupo_maximo = "Mayor que 0";
    setFaltan(f);
    if (Object.keys(f).length) {
      setErrorForm("Revisa los campos marcados en rojo.");
      return;
    }
    setGuardando(true);
    setErrorForm(null);
    const cuerpo = {
      id_periodo: Number(form.id_periodo), id_aula: Number(form.id_aula), id_responsable: Number(form.id_responsable),
      nombre: form.nombre, descripcion: form.descripcion || null, dias: form.dias,
      hora_inicio: form.hora_inicio, hora_fin: form.hora_fin, cupo_maximo: Number(form.cupo_maximo),
    };
    try {
      if (editando === "nueva") await api("/api/actividades", { method: "POST", body: cuerpo });
      else if (editando) await api(`/api/actividades/${editando.id_actividad}`, { method: "PUT", body: cuerpo });
      avisar(editando === "nueva" ? "Actividad creada" : "Cambios guardados");
      setEditando(null);
      recargar();
    } catch (err) {
      setErrorForm((err as ApiError).message);
    } finally {
      setGuardando(false);
    }
  }

  async function ejecutar() {
    if (!accion) return;
    setProcesando(true);
    try {
      if (accion.tipo === "desactivar") await api(`/api/actividades/${accion.a.id_actividad}/desactivar`, { method: "POST" });
      else if (accion.tipo === "reactivar") await api(`/api/actividades/${accion.a.id_actividad}/reactivar`, { method: "POST" });
      else await api(`/api/actividades/${accion.a.id_actividad}`, { method: "DELETE" });
      avisar(accion.tipo === "desactivar" ? `${accion.a.nombre} quedó desactivada`
        : accion.tipo === "reactivar" ? `${accion.a.nombre} se reactivó` : `${accion.a.nombre} se eliminó`);
      recargar();
    } catch (err) {
      avisar((err as ApiError).message, "error");
    } finally {
      setProcesando(false);
      setAccion(null);
    }
  }

  const editable = (a: Actividad) => a.estado !== "Cerrada" && a.estado !== "Inactiva";

  return (
    <>
      <Encabezado titulo="Actividades" texto="Las actividades nuevas quedan en borrador y se publican solas cuando abre su periodo."
        acciones={<Boton icono="mas" onClick={() => abrir("nueva")}>Nueva actividad</Boton>} />

      <div className="filtros">
        <label className="buscador">
          <Icono nombre="buscar" tam={18} />
          <input type="search" placeholder="Buscar actividad, aula, responsable o periodo" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Buscar" />
        </label>
        <select value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          {["Borrador", "Activa", "Llena", "Cerrada", "Inactiva"].map((e) => <option key={e}>{e}</option>)}
        </select>
      </div>

      {cargando && !datos && <Cargando />}
      {error && <CajaError mensaje={error} reintentar={recargar} />}
      {datos && lista.length === 0 && <Vacio titulo={datos.length ? "Ninguna actividad coincide" : "Todavía no hay actividades"} texto={datos.length ? "Cambia la búsqueda o el filtro." : "Crea la primera con el botón Nueva actividad."} />}

      {lista.length > 0 && (
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr><th scope="col">Actividad</th><th scope="col">Horario</th><th scope="col">Cupo</th><th scope="col">Estado</th><th scope="col"><span className="sr">Acciones</span></th></tr>
            </thead>
            <tbody>
              {pag.visibles.map((a) => (
                <tr key={a.id_actividad}>
                  <td data-col="Actividad">
                    <strong>{a.nombre}</strong>
                    <span className="texto-suave">{a.periodo} · {a.aula} · {a.responsable ?? "Sin responsable"}</span>
                  </td>
                  <td data-col="Horario"><TiraDias dias={a.dias} inicio={a.hora_inicio} fin={a.hora_fin} /></td>
                  <td data-col="Cupo"><span className="cupo-celda"><span className="num-fuerte">{a.inscritos}</span> / {a.cupo_maximo}</span></td>
                  <td data-col="Estado"><Insignia valor={a.estado} /></td>
                  <td className="acciones-fila">
                    <Enlace a={`/grupos/${a.id_actividad}`} className="btn btn-fantasma btn-chico">Grupo</Enlace>
                    {editable(a) && <button className="icono-btn editar" onClick={() => abrir(a)} aria-label={`Editar ${a.nombre}`} title="Editar"><Icono nombre="editar" /></button>}
                    {editable(a) && <button className="icono-btn cuidado" onClick={() => setAccion({ tipo: "desactivar", a })} aria-label={`Desactivar ${a.nombre}`} title="Desactivar"><Icono nombre="bloquear" /></button>}
                    {a.estado === "Inactiva" && <button className="icono-btn exito" onClick={() => setAccion({ tipo: "reactivar", a })} aria-label={`Reactivar ${a.nombre}`} title="Reactivar"><Icono nombre="recargar" /></button>}
                    {a.inscritos === 0 && <button className="icono-btn peligro" onClick={() => setAccion({ tipo: "eliminar", a })} aria-label={`Eliminar ${a.nombre}`} title="Eliminar"><Icono nombre="borrar" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lista.length > 0 && <Paginacion {...pag} />}

      <Modal titulo={editando === "nueva" ? "Nueva actividad" : "Editar actividad"} abierto={!!editando} alCerrar={() => setEditando(null)} ancho="amplio"
        pie={<><Boton variante="fantasma" onClick={() => setEditando(null)} disabled={guardando}>Cancelar</Boton><Boton type="submit" form="form-actividad" cargando={guardando}>Guardar</Boton></>}>
        <form id="form-actividad" className="formulario" onSubmit={guardar} noValidate>
          {errorForm && <CajaError mensaje={errorForm} />}
          <Campo etiqueta="Nombre *" error={faltan.nombre}><input value={form.nombre} onChange={set("nombre")} maxLength={150} required /></Campo>
          <Campo etiqueta="Descripción" ayuda="Qué se hace y qué se necesita llevar."><textarea value={form.descripcion} onChange={set("descripcion")} maxLength={500} rows={3} /></Campo>
          <div className="rejilla-2">
            <Campo etiqueta="Periodo *" error={faltan.id_periodo}><select value={form.id_periodo} onChange={set("id_periodo")} required><option value="">Elige…</option>{opPeriodos.map((o) => <option key={o.id} value={o.id}>{o.texto}</option>)}</select></Campo>
            <Campo etiqueta="Aula *" error={faltan.id_aula}><select value={form.id_aula} onChange={set("id_aula")} required><option value="">Elige…</option>{opAulas.map((o) => <option key={o.id} value={o.id}>{o.texto}</option>)}</select></Campo>
          </div>
          <Campo etiqueta="Responsable *" error={faltan.id_responsable} ayuda="Un docente, o un alumno responsable con cuenta activa."><select value={form.id_responsable} onChange={set("id_responsable")} required><option value="">Elige…</option>{opResp.map((o) => <option key={o.id} value={o.id}>{o.texto}</option>)}</select></Campo>
          <fieldset className={`campo ${faltan.dias ? "campo-error" : ""}`}>
            <legend className="campo-etiqueta">Días *</legend>
            <div className="dias-elegir">
              {DIAS.map((d) => (
                <label key={d} className={`dia-chip ${diasElegidos.includes(d) ? "on" : ""}`}>
                  <input type="checkbox" checked={diasElegidos.includes(d)} onChange={() => alternarDia(d)} />
                  <span>{d.slice(0, 3)}</span>
                </label>
              ))}
            </div>
            {faltan.dias && <span className="campo-msg">{faltan.dias}</span>}
          </fieldset>
          <div className="rejilla-3">
            <Campo etiqueta="Hora de inicio *" error={faltan.hora_inicio}><input type="time" value={form.hora_inicio} onChange={set("hora_inicio")} required /></Campo>
            <Campo etiqueta="Hora de fin *" error={faltan.hora_fin}><input type="time" value={form.hora_fin} onChange={set("hora_fin")} required /></Campo>
            <Campo etiqueta="Cupo máximo *" error={faltan.cupo_maximo}><input type="number" min={1} value={form.cupo_maximo} onChange={set("cupo_maximo")} required /></Campo>
          </div>
        </form>
      </Modal>

      <Confirmar abierto={!!accion} peligro={accion?.tipo !== "reactivar"} cargando={procesando} alCerrar={() => setAccion(null)} alConfirmar={ejecutar}
        titulo={accion?.tipo === "eliminar" ? "Eliminar actividad" : accion?.tipo === "reactivar" ? "Reactivar actividad" : "Desactivar actividad"}
        accion={accion?.tipo === "eliminar" ? "Sí, eliminar" : accion?.tipo === "reactivar" ? "Sí, reactivar" : "Sí, desactivar"}
        texto={accion && (accion.tipo === "eliminar"
          ? <p>Se eliminará <strong>{accion.a.nombre}</strong> para siempre. Solo se puede si nadie se ha inscrito nunca.</p>
          : accion.tipo === "reactivar"
          ? <p><strong>{accion.a.nombre}</strong> volverá a aparecer en el catálogo (o quedará en borrador si su periodo todavía no abre).</p>
          : <p><strong>{accion.a.nombre}</strong> dejará de aparecer en el catálogo. Las inscripciones se conservan y la puedes reactivar después.</p>)} />
    </>
  );
}
