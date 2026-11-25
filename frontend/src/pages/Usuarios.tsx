import { useMemo, useState, type FormEvent } from "react";
import { Icono } from "../components/Icono";
import { Boton, CajaError, Campo, Cargando, Encabezado, Insignia, Modal, Paginacion, useAvisos, usePaginas, Vacio } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { fecha } from "../lib/formato";
import { useSesion } from "../lib/sesion";
import type { Rol } from "../lib/tipos";
import { useCarga } from "../lib/useCarga";

interface U { id_usuario: number; nombre: string; correo: string; rol: Rol; matricula: string | null; activo: boolean; creado_en: string }
const ROLES: Rol[] = ["Alumno", "Docente", "Personal", "Administrador"];
const NOMBRE_ROL: Record<Rol, string> = {
  Alumno: "Alumno", Docente: "Docente", Personal: "Personal de Extra-Escolares", Administrador: "Administrador",
};

export function Usuarios() {
  const { usuario } = useSesion();
  const esAdmin = usuario?.rol === "Administrador";
  const { datos, error, cargando, recargar } = useCarga<U[]>("/api/usuarios");
  const [filtro, setFiltro] = useState("");
  const [rol, setRol] = useState("");
  const [editando, setEditando] = useState<U | "nuevo" | null>(null);
  const [form, setForm] = useState({ nombre: "", correo: "", rol: "Alumno" as Rol, matricula: "", contrasena: "", activo: true });
  const [clave, setClave] = useState<U | null>(null);
  const [nuevaClave, setNuevaClave] = useState("");
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const avisar = useAvisos();

  const lista = useMemo(() => (datos ?? []).filter((u) =>
    (!rol || u.rol === rol) && (!filtro || `${u.nombre} ${u.correo} ${u.matricula ?? ""}`.toLowerCase().includes(filtro.toLowerCase()))), [datos, filtro, rol]);
  const pag = usePaginas(lista, 10);

  function abrir(u: U | "nuevo") {
    setErrorForm(null);
    setEditando(u);
    setForm(u === "nuevo"
      ? { nombre: "", correo: "", rol: "Alumno", matricula: "", contrasena: "", activo: true }
      : { nombre: u.nombre, correo: u.correo, rol: u.rol, matricula: u.matricula ?? "", contrasena: "", activo: u.activo });
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) return setErrorForm("Escribe el nombre completo.");
    if (form.rol === "Alumno" && !form.matricula.trim()) return setErrorForm("Los alumnos necesitan matrícula.");
    if (editando === "nuevo" && (!form.correo.includes("@") || form.contrasena.length < 8)) return setErrorForm("Escribe un correo válido y una contraseña de al menos 8 caracteres.");
    setGuardando(true);
    setErrorForm(null);
    try {
      if (editando === "nuevo") {
        await api("/api/usuarios", { method: "POST", body: { nombre: form.nombre, correo: form.correo, rol: form.rol, matricula: form.matricula || null, contrasena: form.contrasena } });
        avisar(`Se registró a ${form.nombre}. Ya puede iniciar sesión.`);
      } else if (editando) {
        await api(`/api/usuarios/${editando.id_usuario}`, { method: "PUT", body: { nombre: form.nombre, rol: form.rol, matricula: form.matricula || null, activo: form.activo } });
        avisar("Cambios guardados");
      }
      setEditando(null);
      recargar();
    } catch (err) {
      setErrorForm((err as ApiError).message);
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarClave(e: FormEvent) {
    e.preventDefault();
    if (!clave) return;
    if (nuevaClave.length < 8) return setErrorForm("La contraseña debe tener al menos 8 caracteres.");
    setGuardando(true);
    setErrorForm(null);
    try {
      await api(`/api/usuarios/${clave.id_usuario}/contrasena`, { method: "PUT", body: { contrasena: nuevaClave } });
      avisar(`Se asignó una nueva contraseña a ${clave.nombre}`);
      setClave(null);
      setNuevaClave("");
    } catch (err) {
      setErrorForm((err as ApiError).message);
    } finally {
      setGuardando(false);
    }
  }

  const propio = editando !== "nuevo" && editando?.id_usuario === usuario?.id_usuario;

  return (
    <>
      <Encabezado titulo="Usuarios" texto={esAdmin ? "Registra cuentas, asigna roles y desactiva accesos." : "Consulta de las personas registradas."}
        acciones={esAdmin && <Boton icono="mas" onClick={() => abrir("nuevo")}>Nuevo usuario</Boton>} />
      <div className="filtros">
        <label className="buscador">
          <Icono nombre="buscar" tam={18} />
          <input type="search" placeholder="Buscar por nombre, correo o matrícula" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Buscar usuarios" />
        </label>
        <select value={rol} onChange={(e) => setRol(e.target.value)} aria-label="Filtrar por rol">
          <option value="">Todos los roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}
        </select>
      </div>
      {cargando && !datos && <Cargando />}
      {error && <CajaError mensaje={error} reintentar={recargar} />}
      {datos && lista.length === 0 && <Vacio titulo="Nadie coincide con la búsqueda" />}
      {lista.length > 0 && (
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead><tr><th scope="col">Nombre</th><th scope="col">Rol</th><th scope="col">Matrícula</th><th scope="col">Alta</th><th scope="col">Acceso</th>{esAdmin && <th scope="col"><span className="sr">Acciones</span></th>}</tr></thead>
            <tbody>
              {pag.visibles.map((u) => (
                <tr key={u.id_usuario} className={u.activo ? "" : "apagada"}>
                  <td data-col="Nombre"><strong>{u.nombre}</strong><span className="texto-suave">{u.correo}</span></td>
                  <td data-col="Rol">{NOMBRE_ROL[u.rol] ?? u.rol}</td>
                  <td data-col="Matrícula">{u.matricula ?? "—"}</td>
                  <td data-col="Alta">{fecha(u.creado_en)}</td>
                  <td data-col="Acceso"><span className={`insignia insignia-${u.activo ? "verde" : "rojo"}`}>{u.activo ? "Activo" : "Desactivado"}</span></td>
                  {esAdmin && (
                    <td className="acciones-fila">
                      <button className="icono-btn con-texto editar" onClick={() => abrir(u)} aria-label={`Editar ${u.nombre}`} title="Editar"><Icono nombre="editar" tam={18} /><span>Editar</span></button>
                      <button className="icono-btn con-texto cuidado" onClick={() => { setErrorForm(null); setNuevaClave(""); setClave(u); }} aria-label={`Nueva contraseña para ${u.nombre}`} title="Asignar contraseña"><Icono nombre="bloquear" tam={18} /><span>Contraseña</span></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lista.length > 0 && <Paginacion {...pag} />}

      <Modal titulo={editando === "nuevo" ? "Nuevo usuario" : "Editar usuario"} abierto={!!editando} alCerrar={() => setEditando(null)}
        pie={<><Boton variante="fantasma" onClick={() => setEditando(null)} disabled={guardando}>Cancelar</Boton><Boton type="submit" form="form-usuario" cargando={guardando}>Guardar</Boton></>}>
        <form id="form-usuario" className="formulario" onSubmit={guardar} noValidate>
          {errorForm && <CajaError mensaje={errorForm} />}
          <Campo etiqueta="Nombre completo *"><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} maxLength={150} /></Campo>
          <Campo etiqueta="Correo *" ayuda={editando === "nuevo" ? "Con este correo iniciará sesión." : "El correo no se puede cambiar."}>
            <input type="email" value={form.correo} disabled={editando !== "nuevo"} onChange={(e) => setForm({ ...form, correo: e.target.value })} />
          </Campo>
          <div className="rejilla-2">
            <Campo etiqueta="Rol *" ayuda={propio ? "No puedes cambiar tu propio rol." : undefined}>
              <select value={form.rol} disabled={propio} onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}>{ROLES.map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}</select>
            </Campo>
            {form.rol === "Alumno" && <Campo etiqueta="Matrícula *"><input value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} maxLength={20} /></Campo>}
          </div>
          {editando === "nuevo" ? (
            <Campo etiqueta="Contraseña inicial *" ayuda="Mínimo 8 caracteres. Entrégala a la persona en privado.">
              <input type="text" autoComplete="new-password" value={form.contrasena} onChange={(e) => setForm({ ...form, contrasena: e.target.value })} />
            </Campo>
          ) : (
            <label className="interruptor">
              <input type="checkbox" checked={form.activo} disabled={propio} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
              <span>{form.activo ? "Cuenta activa: puede iniciar sesión" : "Cuenta desactivada: no puede iniciar sesión"}</span>
            </label>
          )}
        </form>
      </Modal>

      <Modal titulo="Asignar nueva contraseña" abierto={!!clave} alCerrar={() => setClave(null)}
        pie={<><Boton variante="fantasma" onClick={() => setClave(null)} disabled={guardando}>Cancelar</Boton><Boton type="submit" form="form-clave" cargando={guardando}>Asignar</Boton></>}>
        <form id="form-clave" className="formulario" onSubmit={cambiarClave} noValidate>
          {errorForm && <CajaError mensaje={errorForm} />}
          <p>Nueva contraseña para <strong>{clave?.nombre}</strong>.</p>
          <Campo etiqueta="Contraseña *" ayuda="Mínimo 8 caracteres."><input type="text" autoComplete="new-password" value={nuevaClave} onChange={(e) => setNuevaClave(e.target.value)} /></Campo>
        </form>
      </Modal>
    </>
  );
}
