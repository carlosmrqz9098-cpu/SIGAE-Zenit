import { useState, type FormEvent } from "react";
import { Icono } from "../components/Icono";
import { Boton, CajaError, Campo, Cargando, Encabezado, Insignia, Modal, Paginacion, useAvisos, usePaginas, Vacio } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { aInputLocal, deInputLocal, fechaHora } from "../lib/formato";
import { useSesion } from "../lib/sesion";
import { useCarga } from "../lib/useCarga";

interface Periodo {
  id_periodo: number; nombre: string; fecha_hora_inicio: string; fecha_hora_fin: string;
  estado: string; fecha_activacion: string | null; fecha_cierre_real: string | null; actividades: number;
}

export function Periodos() {
  const { usuario } = useSesion();
  const esAdmin = usuario?.rol === "Administrador";
  const { datos, error, cargando, recargar } = useCarga<Periodo[]>("/api/periodos");
  const [editando, setEditando] = useState<Periodo | "nuevo" | null>(null);
  const [form, setForm] = useState({ nombre: "", inicio: "", fin: "" });
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const avisar = useAvisos();

  function abrir(p: Periodo | "nuevo") {
    setErrorForm(null);
    setEditando(p);
    setForm(p === "nuevo" ? { nombre: "", inicio: "", fin: "" } : { nombre: p.nombre, inicio: aInputLocal(p.fecha_hora_inicio), fin: aInputLocal(p.fecha_hora_fin) });
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim() || !form.inicio || !form.fin) return setErrorForm("Llena el nombre y las dos fechas.");
    if (form.fin <= form.inicio) return setErrorForm("El cierre debe ser después de la apertura.");
    setGuardando(true);
    setErrorForm(null);
    const cuerpo = { nombre: form.nombre, fecha_hora_inicio: deInputLocal(form.inicio), fecha_hora_fin: deInputLocal(form.fin) };
    try {
      if (editando === "nuevo") await api("/api/periodos", { method: "POST", body: cuerpo });
      else if (editando) await api(`/api/periodos/${editando.id_periodo}`, { method: "PUT", body: cuerpo });
      avisar(editando === "nuevo" ? "Periodo registrado" : "Cambios guardados");
      setEditando(null);
      recargar();
    } catch (err) {
      setErrorForm((err as ApiError).message);
    } finally {
      setGuardando(false);
    }
  }

  const [filtro, setFiltro] = useState("");
  const lista = (datos ?? []).filter((p) => !filtro || p.nombre.toLowerCase().includes(filtro.toLowerCase()));
  const pag = usePaginas(lista, 10);

  return (
    <>
      <Encabezado titulo="Periodos de inscripción" texto="El sistema abre y cierra cada periodo solo, en la fecha y hora indicadas."
        acciones={esAdmin && <Boton icono="mas" onClick={() => abrir("nuevo")}>Nuevo periodo</Boton>} />
      {datos && datos.length > 0 && (
        <div className="filtros">
          <label className="buscador">
            <Icono nombre="buscar" tam={18} />
            <input type="search" placeholder="Buscar periodo" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Buscar periodos" />
          </label>
        </div>
      )}
      {cargando && !datos && <Cargando />}
      {error && <CajaError mensaje={error} reintentar={recargar} />}
      {datos && datos.length === 0 && <Vacio titulo="No hay periodos registrados" texto={esAdmin ? "Registra el primero para poder crear actividades." : undefined} />}
      {datos && datos.length > 0 && lista.length === 0 && <Vacio titulo="Ningún periodo coincide" texto="Cambia la búsqueda." />}
      {lista.length > 0 && (
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead><tr><th scope="col">Periodo</th><th scope="col">Abre</th><th scope="col">Cierra</th><th scope="col">Actividades</th><th scope="col">Estado</th>{esAdmin && <th scope="col"><span className="sr">Acciones</span></th>}</tr></thead>
            <tbody>
              {pag.visibles.map((p) => (
                <tr key={p.id_periodo}>
                  <td data-col="Periodo"><strong>{p.nombre}</strong></td>
                  <td data-col="Abre">{fechaHora(p.fecha_hora_inicio)}</td>
                  <td data-col="Cierra">{fechaHora(p.fecha_hora_fin)}</td>
                  <td data-col="Actividades">{p.actividades}</td>
                  <td data-col="Estado"><Insignia valor={p.estado} /></td>
                  {esAdmin && <td className="acciones-fila">{p.estado !== "Cerrado" && <button className="icono-btn con-texto editar" onClick={() => abrir(p)} aria-label={`Editar ${p.nombre}`} title="Editar"><Icono nombre="editar" tam={18} /><span>Editar</span></button>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lista.length > 0 && <Paginacion {...pag} />}

      <Modal titulo={editando === "nuevo" ? "Nuevo periodo" : "Editar periodo"} abierto={!!editando} alCerrar={() => setEditando(null)}
        pie={<><Boton variante="fantasma" onClick={() => setEditando(null)} disabled={guardando}>Cancelar</Boton><Boton type="submit" form="form-periodo" cargando={guardando}>Guardar</Boton></>}>
        <form id="form-periodo" className="formulario" onSubmit={guardar} noValidate>
          {errorForm && <CajaError mensaje={errorForm} />}
          <Campo etiqueta="Nombre *" ayuda="Por ejemplo: Agosto–Diciembre 2026"><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} maxLength={100} /></Campo>
          <div className="rejilla-2">
            <Campo etiqueta="Abre inscripciones *" ayuda="Hora de Pachuca"><input type="datetime-local" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} /></Campo>
            <Campo etiqueta="Cierra inscripciones *" ayuda="Hora de Pachuca"><input type="datetime-local" value={form.fin} onChange={(e) => setForm({ ...form, fin: e.target.value })} /></Campo>
          </div>
          <p className="texto-suave">Los periodos no se pueden encimar con otro.</p>
        </form>
      </Modal>
    </>
  );
}
