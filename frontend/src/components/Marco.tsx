import { useState, type ReactNode } from "react";
import { Enlace, useRuta } from "../lib/router";
import { useSesion } from "../lib/sesion";
import { MENU, puedeVer } from "../rutas";
import { Icono } from "./Icono";

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
      </div>
    </div>
  );
}
