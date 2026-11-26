import { useState, type ReactNode } from "react";
import { api, ApiError } from "../lib/api";
import { Enlace, useRuta } from "../lib/router";
import { useSesion } from "../lib/sesion";
import type { Rol, Sexo } from "../lib/tipos";
import { MENU, puedeVer } from "../rutas";
import { Icono } from "./Icono";
import { Boton, Modal } from "./ui";

const ROL_VISTA: Record<Rol, { texto: string; clase: string }> = {
  Administrador: { texto: "Administrador", clase: "rol-admin" },
  Personal: { texto: "Personal Extra-Escolares", clase: "rol-personal" },
  Docente: { texto: "Docente", clase: "rol-docente" },
  Alumno: { texto: "Alumno", clase: "rol-alumno" },
};

/** Al alumno que aún no dice si es hombre o mujer se le pregunta una vez. */
function PedirSexo() {
  const { usuario, recargarUsuario } = useSesion();
  const [cerrada, setCerrada] = useState(false);
  const [elegido, setElegido] = useState<Sexo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  if (!usuario || usuario.rol !== "Alumno" || usuario.sexo || cerrada) return null;

  async function guardar() {
    if (!elegido) return setError("Elige una opción.");
    setGuardando(true);
    setError(null);
    try {
      await api("/api/mi-sexo", { method: "PUT", body: { sexo: elegido } });
      await recargarUsuario();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo="Antes de seguir" abierto alCerrar={() => setCerrada(true)}
      pie={<><Boton variante="fantasma" onClick={() => setCerrada(true)}>Ahora no</Boton><Boton onClick={guardar} cargando={guardando}>Guardar</Boton></>}>
      <p>Algunas actividades son <strong>solo para hombres</strong> (varonil) o <strong>solo para mujeres</strong> (femenil). Dinos cuál eres para mostrarte las que te tocan.</p>
      <div className="opciones-seg grande" role="radiogroup" style={{ marginTop: 16 }}>
        {(["Hombre", "Mujer"] as const).map((x) => (
          <button key={x} type="button" role="radio" aria-checked={elegido === x} className={elegido === x ? "activo" : ""} onClick={() => setElegido(x)}>{x}</button>
        ))}
      </div>
      <p className="campo-ayuda" style={{ marginTop: 12 }}>Solo se elige una vez. Si te equivocas, Servicios Extra-Escolares lo puede corregir.</p>
      {error && <p className="campo-msg">{error}</p>}
    </Modal>
  );
}

function iniciales(nombre: string) {
  return nombre.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export function Marco({ children }: { children: ReactNode }) {
  const { usuario, salir } = useSesion();
  const { ruta, ir } = useRuta();
  const [abierto, setAbierto] = useState(false);
  if (!usuario) return null;
  const items = MENU.filter((m) => puedeVer(m, usuario));
  const activo = (a: string) => (a === "/" ? ruta === "/" : ruta === a || ruta.startsWith(`${a}/`));

  return (
    <div className="marco">
      <a href="#contenido" className="saltar">Ir al contenido</a>
      <aside className={`lateral ${abierto ? "abierto" : ""}`}>
        <div className="marca">
          <svg viewBox="0 0 32 32" width="34" height="34" aria-hidden>
            <rect x="4" y="18" width="5" height="10" rx="1.5" fill="#1E7F55" />
            <rect x="11.5" y="12" width="5" height="16" rx="1.5" fill="#2FA36F" />
            <rect x="19" y="6" width="5" height="22" rx="1.5" fill="#F0B73A" />
          </svg>
          <div>
            <strong>SIGAE</strong>
            <span>Actividades Extra-Escolares</span>
          </div>
        </div>
        <p className={`rol-etiqueta ${ROL_VISTA[usuario.rol].clase}`}>
          <Icono nombre={usuario.rol === "Alumno" ? "persona" : usuario.rol === "Docente" ? "grupos" : "parametros"} tam={16} />
          {ROL_VISTA[usuario.rol].texto}
        </p>
        <nav aria-label="Menú principal">
          <ul>
            {items.map((m) => (
              <li key={m.a} onClick={() => setAbierto(false)}>
                <Enlace a={m.a} className={`nav-item ${activo(m.a) ? "activo" : ""}`} aria-current={activo(m.a) ? "page" : undefined}>
                  <Icono nombre={m.icono} />
                  <span>{m.texto}</span>
                </Enlace>
              </li>
            ))}
          </ul>
        </nav>
        <div className="perfil">
          <span className="avatar" aria-hidden>{iniciales(usuario.nombre)}</span>
          <div className="perfil-datos">
            <strong>{usuario.nombre}</strong>
            <span>{usuario.rol}{usuario.matricula ? ` · ${usuario.matricula}` : ""}</span>
          </div>
          <button className="icono-btn claro" onClick={salir} aria-label="Cerrar sesión" title="Cerrar sesión">
            <Icono nombre="salir" />
          </button>
        </div>
      </aside>
      {abierto && <div className="velo" onClick={() => setAbierto(false)} aria-hidden />}

      <div className="principal">
        <div className="barra-movil">
          <button className="icono-btn" onClick={() => setAbierto(true)} aria-label="Abrir menú">
            <Icono nombre="menu" />
          </button>
          <strong>SIGAE</strong>
          <span className={`rol-etiqueta chica ${ROL_VISTA[usuario.rol].clase}`}>{ROL_VISTA[usuario.rol].texto}</span>
          <span className="avatar chico" aria-hidden>{iniciales(usuario.nombre)}</span>
        </div>
        <main id="contenido" tabIndex={-1}>
          {ruta !== "/" && !ruta.startsWith("/grupos/") && (
            <button type="button" className="regresar" onClick={() => ((window.history.state?.sigae ?? 0) > 0 ? window.history.back() : ir("/"))}>
              <Icono nombre="atras" tam={16} /> Regresar
            </button>
          )}
          {children}
        </main>
        <PedirSexo />
      </div>
    </div>
  );
}
