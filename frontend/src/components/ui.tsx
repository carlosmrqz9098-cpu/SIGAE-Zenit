import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ButtonHTMLAttributes, type ReactNode,
} from "react";
import { Icono } from "./Icono";

// ------------------------------------------------------------------ Botón
type Variante = "principal" | "secundario" | "peligro" | "fantasma";

export function Boton({
  variante = "principal", cargando, icono, children, className = "", ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; cargando?: boolean; icono?: string }) {
  return (
    <button
      className={`btn btn-${variante} ${className}`}
      disabled={cargando || resto.disabled}
      aria-busy={cargando || undefined}
      {...resto}
    >
      {cargando ? <span className="giro" aria-hidden /> : icono ? <Icono nombre={icono} tam={18} /> : null}
      <span>{children}</span>
    </button>
  );
}

// ------------------------------------------------------------------ Estados de pantalla
export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div className="estado-pantalla" role="status">
      <span className="giro giro-grande" aria-hidden />
      <p>{texto}</p>
    </div>
  );
}

export function Vacio({ titulo, texto, accion }: { titulo: string; texto?: string; accion?: ReactNode }) {
  return (
    <div className="estado-pantalla vacio">
      <h3>{titulo}</h3>
      {texto && <p>{texto}</p>}
      {accion}
    </div>
  );
}

export function CajaError({ mensaje, reintentar }: { mensaje: string; reintentar?: () => void }) {
  return (
    <div className="caja-error" role="alert">
      <Icono nombre="alerta" />
      <p>{mensaje}</p>
      {reintentar && <Boton variante="secundario" onClick={reintentar}>Reintentar</Boton>}
    </div>
  );
}

// ------------------------------------------------------------------ Insignias de estado
const TONO: Record<string, string> = {
  Activa: "verde", Activo: "verde", Acreditado: "verde", Exitosa: "verde",
  Llena: "amarillo", Pendiente: "amarillo", Programado: "azul", Borrador: "gris", "Sin cambios": "gris",
  Cerrada: "gris", Cerrado: "gris", Evaluada: "azul",
  Cancelada: "rojo", Inactiva: "rojo", "No acreditado": "rojo", Fallida: "rojo",
};

/** Qué significa cada estado, en palabras sencillas. */
export const SIGNIFICA: Record<string, string> = {
  Borrador: "Ya está creada, pero todavía no se publica: aparece sola cuando abre su periodo.",
  Activa: "Publicada y abierta para inscribirse.",
  Llena: "Ya no tiene lugares libres.",
  Cerrada: "La actividad ya terminó y se calcularon los créditos.",
  Inactiva: "Se desactivó a mano; no aparece en el catálogo.",
  Programado: "El periodo todavía no empieza.",
  Activo: "El periodo está abierto: los alumnos se pueden inscribir.",
  Cerrado: "El periodo ya terminó.",
  Evaluada: "La actividad cerró y el crédito ya quedó definido.",
  Cancelada: "El alumno se dio de baja.",
};

export function Insignia({ valor }: { valor: string | null | undefined }) {
  const v = valor ?? "Pendiente";
  return <span className={`insignia insignia-${TONO[v] ?? "gris"}`} title={SIGNIFICA[v]}>{v}</span>;
}

/** "¿Qué significa cada estado?" plegable, para quien usa el sistema por primera vez. */
export function Leyenda({ titulo = "¿Qué significa cada estado?", estados, extra }: {
  titulo?: string; estados?: string[]; extra?: [string, string][];
}) {
  const filas: [string, string][] = [...(estados ?? []).map((e) => [e, SIGNIFICA[e]] as [string, string]), ...(extra ?? [])];
  return (
    <details className="leyenda">
      <summary><Icono nombre="alerta" tam={16} /> {titulo}</summary>
      <dl>
        {filas.map(([k, v]) => (
          <div key={k}><dt>{estados?.includes(k) ? <Insignia valor={k} /> : <strong>{k}</strong>}</dt><dd>{v}</dd></div>
        ))}
      </dl>
    </details>
  );
}

// ------------------------------------------------------------------ Estado del crédito (grande y claro)
const CREDITO: Record<string, { tono: string; icono: string; alumno: string; otros: string }> = {
  Acreditado: { tono: "verde", icono: "check", alumno: "¡Ya tienes tu crédito!", otros: "Cumplió asistencia y evidencia" },
  "No acreditado": { tono: "rojo", icono: "cerrar", alumno: "No cumpliste la asistencia o la evidencia", otros: "No cumple asistencia o evidencia" },
  Pendiente: { tono: "amarillo", icono: "reloj", alumno: "Todavía no te evalúan", otros: "Falta capturar asistencia y evidencia" },
  Cancelada: { tono: "morado", icono: "cerrar", alumno: "Te diste de baja", otros: "Se dio de baja" },
};

/** Muestra el crédito con color, ícono y una frase corta para que se entienda a la primera. */
export function EstadoCredito({ valor, para = "otros", chico }: { valor: string | null | undefined; para?: "alumno" | "otros"; chico?: boolean }) {
  const v = valor ?? "Pendiente";
  const c = CREDITO[v] ?? CREDITO.Pendiente;
  return (
    <div className={`estado-credito ec-${c.tono} ${chico ? "chico" : ""}`} role="status">
      <span className="ec-icono" aria-hidden><Icono nombre={c.icono} tam={chico ? 16 : 22} /></span>
      <span className="ec-texto">
        <strong>{v}</strong>
        <small>{para === "alumno" ? c.alumno : c.otros}</small>
      </span>
    </div>
  );
}

// ------------------------------------------------------------------ Paginación
/** Parte una lista en páginas. Regresa la página visible y los datos para <Paginacion>. */
export function usePaginas<T>(lista: T[], porPagina = 10) {
  const [pagina, setPagina] = useState(1);
  const total = lista.length;
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const actual = Math.min(pagina, paginas);
  useEffect(() => { if (pagina > paginas) setPagina(paginas); }, [pagina, paginas]);
  const visibles = lista.slice((actual - 1) * porPagina, actual * porPagina);
  return { visibles, pagina: actual, paginas, total, porPagina, setPagina };
}

export function Paginacion({ pagina, paginas, total, porPagina, setPagina }: {
  pagina: number; paginas: number; total: number; porPagina: number; setPagina: (n: number) => void;
}) {
  if (total === 0) return null;
  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);
  const ir = (n: number) => { setPagina(n); document.getElementById("contenido")?.scrollIntoView({ block: "start" }); };
  // Números visibles: primera, última y las vecinas de la actual
  const nums = Array.from({ length: paginas }, (_, i) => i + 1)
    .filter((n) => n === 1 || n === paginas || Math.abs(n - pagina) <= 1);
  return (
    <nav className="paginacion" aria-label="Páginas">
      <span className="paginacion-info">Mostrando <strong>{desde}–{hasta}</strong> de <strong>{total}</strong></span>
      {paginas > 1 && (
        <div className="paginacion-botones">
          <button className="pag-btn" disabled={pagina <= 1} onClick={() => ir(pagina - 1)} aria-label="Página anterior">‹ Anterior</button>
          {nums.map((n, i) => (
            <span key={n} className="pag-grupo">
              {i > 0 && n - nums[i - 1] > 1 && <span className="pag-puntos">…</span>}
              <button className={`pag-btn ${n === pagina ? "actual" : ""}`} aria-current={n === pagina ? "page" : undefined}
                onClick={() => ir(n)}>{n}</button>
            </span>
          ))}
          <button className="pag-btn" disabled={pagina >= paginas} onClick={() => ir(pagina + 1)} aria-label="Página siguiente">Siguiente ›</button>
        </div>
      )}
    </nav>
  );
}

// ------------------------------------------------------------------ Encabezado de página
export function Encabezado({ titulo, texto, acciones }: { titulo: string; texto?: string; acciones?: ReactNode }) {
  return (
    <header className="encabezado">
      <div>
        <h1>{titulo}</h1>
        {texto && <p>{texto}</p>}
      </div>
      {acciones && <div className="encabezado-acciones">{acciones}</div>}
    </header>
  );
}

// ------------------------------------------------------------------ Campo de formulario
export function Campo({ etiqueta, ayuda, error, children }: { etiqueta: string; ayuda?: string; error?: string; children: ReactNode }) {
  return (
    <label className={`campo ${error ? "campo-error" : ""}`}>
      <span className="campo-etiqueta">{etiqueta}</span>
      {children}
      {error ? <span className="campo-msg">{error}</span> : ayuda ? <span className="campo-ayuda">{ayuda}</span> : null}
    </label>
  );
}

// ------------------------------------------------------------------ Ventana modal
export function Modal({ titulo, abierto, alCerrar, children, pie, ancho }: {
  titulo: string; abierto: boolean; alCerrar: () => void; children: ReactNode; pie?: ReactNode; ancho?: "normal" | "amplio";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);
  return (
    <dialog
      ref={ref}
      className={`modal ${ancho === "amplio" ? "modal-amplio" : ""}`}
      onCancel={(e) => { e.preventDefault(); alCerrar(); }}
      aria-labelledby="modal-titulo"
    >
      {abierto && (
        <>
          <header className="modal-cabeza">
            <h2 id="modal-titulo">{titulo}</h2>
            <button className="icono-btn" onClick={alCerrar} aria-label="Cerrar">
              <Icono nombre="cerrar" />
            </button>
          </header>
          <div className="modal-cuerpo">{children}</div>
          {pie && <footer className="modal-pie">{pie}</footer>}
        </>
      )}
    </dialog>
  );
}

// ------------------------------------------------------------------ Confirmación
export function Confirmar({ abierto, titulo, texto, accion, peligro, cargando, alConfirmar, alCerrar }: {
  abierto: boolean; titulo: string; texto: ReactNode; accion: string; peligro?: boolean; cargando?: boolean;
  alConfirmar: () => void; alCerrar: () => void;
}) {
  return (
    <Modal
      titulo={titulo}
      abierto={abierto}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton variante="fantasma" onClick={alCerrar} disabled={cargando}>Cancelar</Boton>
          <Boton variante={peligro ? "peligro" : "principal"} onClick={alConfirmar} cargando={cargando}>{accion}</Boton>
        </>
      }
    >
      <div className="confirmar-texto">{texto}</div>
    </Modal>
  );
}

// ------------------------------------------------------------------ Avisos (toasts)
type Aviso = { id: number; texto: string; tipo: "ok" | "error" };
const AvisosCtx = createContext<(texto: string, tipo?: "ok" | "error") => void>(() => {});

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const avisar = useCallback((texto: string, tipo: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a, { id, texto, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === "error" ? 7000 : 4000);
  }, []);
  return (
    <AvisosCtx.Provider value={avisar}>
      {children}
      <div className="avisos" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} className={`aviso aviso-${a.tipo}`} role={a.tipo === "error" ? "alert" : "status"}>
            <Icono nombre={a.tipo === "ok" ? "check" : "alerta"} tam={18} />
            <span>{a.texto}</span>
          </div>
        ))}
      </div>
    </AvisosCtx.Provider>
  );
}

export const useAvisos = () => useContext(AvisosCtx);
