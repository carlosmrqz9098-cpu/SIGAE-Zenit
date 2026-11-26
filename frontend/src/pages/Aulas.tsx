import { useState, type FormEvent } from "react";
import { Icono } from "../components/Icono";
import { Boton, CajaError, Campo, Cargando, Confirmar, Encabezado, Modal, Paginacion, useAvisos, usePaginas, Vacio } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { useSesion } from "../lib/sesion";
import { useCarga } from "../lib/useCarga";

interface Aula { id_aula: number; nombre: string; ubicacion: string | null; capacidad: number; actividades: number }

export function Aulas() {
  const { usuario } = useSesion();
  const esAdmin = usuario?.rol === "Administrador";
  const { datos, error, cargando, recargar } = useCarga<Aula[]>("/api/aulas");
  const [editando, setEditando] = useState<Aula | "nueva" | null>(null);
  const [form, setForm] = useState({ nombre: "", ubicacion: "", capacidad: "" });
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [borrar, setBorrar] = useState<Aula | null>(null);
  const [borrando, setBorrando] = useState(false);
  const avisar = useAvisos();
  const [faltan, setFaltan] = useState<Record<string, string>>({});
  const [filtro, setFiltro] = useState("");
  const lista = (datos ?? []).filter((a) => !filtro || `${a.nombre} ${a.ubicacion ?? ""}`.toLowerCase().includes(filtro.toLowerCase()));
  const pag = usePaginas(lista, 10);

  function abrir(a: Aula | "nueva") {
    setErrorForm(null);
    setFaltan({});
    setEditando(a);
    setForm(a === "nueva" ? { nombre: "", ubicacion: "", capacidad: "" } : { nombre: a.nombre, ubicacion: a.ubicacion ?? "", capacidad: String(a.capacidad) });
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const f: Record<string, string> = {};
    if (!form.nombre.trim()) f.nombre = "Escribe el nombre del aula";
    if (form.capacidad === "") f.capacidad = "Escribe la capacidad";
    else if (!(Number(form.capacidad) > 0) || !Number.isInteger(Number(form.capacidad))) f.capacidad = "Debe ser un número entero mayor que 0";
    setFaltan(f);
    if (Object.keys(f).length) return setErrorForm("Revisa los campos marcados en rojo.");
    setGuardando(true);
    setErrorForm(null);
    const cuerpo = { nombre: form.nombre, ubicacion: form.ubicacion || null, capacidad: Number(form.capacidad) };
    try {
      if (editando === "nueva") await api("/api/aulas", { method: "POST", body: cuerpo });
      else if (editando) await api(`/api/aulas/${editando.id_aula}`, { method: "PUT", body: cuerpo });
      avisar(editando === "nueva" ? "Aula registrada" : "Cambios guardados");
      setEditando(null);
      recargar();
    } catch (err) {
      setErrorForm((err as ApiError).message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!borrar) return;
    setBorrando(true);
    try {
      await api(`/api/aulas/${borrar.id_aula}`, { method: "DELETE" });
      avisar(`${borrar.nombre} se eliminó`);
      recargar();
    } catch (err) {
      avisar((err as ApiError).message, "error");
    } finally {
      setBorrando(false);
      setBorrar(null);
    }
  }

  return (
    <>
      <Encabezado titulo="Aulas y espacios" texto="Lugares donde se imparten las actividades."
        acciones={esAdmin && <Boton icono="mas" onClick={() => abrir("nueva")}>Nueva aula</Boton>} />
      {datos && datos.length > 0 && (
        <div className="filtros">
          <label className="buscador">
            <Icono nombre="buscar" tam={18} />
            <input type="search" placeholder="Buscar aula o ubicación" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Buscar aulas" />
          </label>
        </div>
      )}
      {cargando && !datos && <Cargando />}
      {error && <CajaError mensaje={error} reintentar={recargar} />}
      {datos && datos.length === 0 && <Vacio titulo="No hay aulas registradas" />}
      {datos && datos.length > 0 && lista.length === 0 && <Vacio titulo="Ninguna aula coincide" texto="Cambia la búsqueda." />}
      {lista.length > 0 && (
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead><tr><th scope="col">Aula</th><th scope="col">Ubicación</th><th scope="col">Capacidad</th><th scope="col">Actividades</th>{esAdmin && <th scope="col"><span className="sr">Acciones</span></th>}</tr></thead>
            <tbody>
              {pag.visibles.map((a) => (
                <tr key={a.id_aula}>
                  <td data-col="Aula"><strong>{a.nombre}</strong></td>
                  <td data-col="Ubicación">{a.ubicacion ?? "—"}</td>
                  <td data-col="Capacidad">{a.capacidad} personas</td>
                  <td data-col="Actividades">{a.actividades}</td>
                  {esAdmin && (
                    <td className="acciones-fila">
                      <button className="icono-btn con-texto editar" onClick={() => abrir(a)} aria-label={`Editar ${a.nombre}`} title="Editar"><Icono nombre="editar" tam={18} /><span>Editar</span></button>
                      {a.actividades === 0 && <button className="icono-btn con-texto peligro" onClick={() => setBorrar(a)} aria-label={`Eliminar ${a.nombre}`} title="Eliminar"><Icono nombre="borrar" tam={18} /><span>Eliminar</span></button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lista.length > 0 && <Paginacion {...pag} />}

      <Modal titulo={editando === "nueva" ? "Nueva aula" : "Editar aula"} abierto={!!editando} alCerrar={() => setEditando(null)}
        pie={<><Boton variante="fantasma" onClick={() => setEditando(null)} disabled={guardando}>Cancelar</Boton><Boton type="submit" form="form-aula" cargando={guardando}>Guardar</Boton></>}>
        <form id="form-aula" className="formulario" onSubmit={guardar} noValidate>
          {errorForm && <CajaError mensaje={errorForm} />}
          <Campo etiqueta="Nombre *" error={faltan.nombre}><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} maxLength={100} /></Campo>
          <Campo etiqueta="Ubicación" ayuda="Edificio o zona del campus"><input value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} maxLength={150} /></Campo>
          <Campo etiqueta="Capacidad *" error={faltan.capacidad}><input type="number" min={1} value={form.capacidad} onChange={(e) => setForm({ ...form, capacidad: e.target.value })} /></Campo>
        </form>
      </Modal>
      <Confirmar abierto={!!borrar} titulo="Eliminar aula" peligro accion="Sí, eliminar" cargando={borrando} alCerrar={() => setBorrar(null)} alConfirmar={eliminar}
        texto={borrar && <p>Se eliminará <strong>{borrar.nombre}</strong>.</p>} />
    </>
  );
}
