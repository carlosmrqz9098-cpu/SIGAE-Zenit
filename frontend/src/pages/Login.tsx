import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Icono } from "../components/Icono";
import { Boton } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { useSesion } from "../lib/sesion";

// ------------------------------------------------------------------ reglas de los campos
const DOMINIO = "@pachuca.tecnm.mx";
const LETRAS = /[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/g;

const soloLetras = (v: string) => v.replace(LETRAS, "").replace(/ {2,}/g, " ").replace(/^ /, "");
const soloNumeros = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);

function revisarNombre(v: string, que: string) {
  if (v.trim().length < 2) return `Escribe tus ${que}.`;
  return null;
}
function revisarCorreo(v: string) {
  const c = v.trim().toLowerCase();
  if (!c) return "Escribe tu correo.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)) return "Escribe un correo válido.";
  if (!c.endsWith(DOMINIO)) return `Usa tu correo institucional que termina en ${DOMINIO}`;
  return null;
}
function revisarContrasena(v: string) {
  if (v.length < 8) return "Mínimo 8 caracteres.";
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return "Debe tener al menos una letra y un número.";
  return null;
}

type Vista = "entrar" | "registro" | "recuperar";
type Errores = Record<string, string | null>;

// ------------------------------------------------------------------ piezas
function Campo({ etiqueta, error, ayuda, children }: { etiqueta: string; error?: string | null; ayuda?: string; children: ReactNode }) {
  return (
    <label className={`campo ${error ? "campo-error" : ""}`}>
      <span className="campo-etiqueta">{etiqueta}</span>
      {children}
      {error ? <span className="campo-msg">{error}</span> : ayuda ? <span className="campo-ayuda">{ayuda}</span> : null}
    </label>
  );
}

function Mensaje({ tipo = "error", children }: { tipo?: "error" | "aviso" | "exito"; children: ReactNode }) {
  const icono = tipo === "exito" ? "check" : tipo === "aviso" ? "bloquear" : "alerta";
  const clase = tipo === "exito" ? "exito" : tipo === "aviso" ? "bloqueada" : "";
  return (
    <div className={`login-error ${clase}`} role={tipo === "exito" ? "status" : "alert"}>
      <Icono nombre={icono} tam={18} />
      <span>{children}</span>
    </div>
  );
}

function CampoCodigo({ valor, cambiar, error }: { valor: string; cambiar: (v: string) => void; error?: string | null }) {
  return (
    <Campo etiqueta="Código de 6 números" error={error} ayuda="Revisa tu bandeja de entrada y la carpeta de spam.">
      <input className="campo-codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={valor}
        onChange={(e) => cambiar(soloNumeros(e.target.value, 6))} placeholder="000000" autoFocus />
    </Campo>
  );
}

/** Botón de "mandar otro código" que espera 60 segundos entre envíos. */
function Reenviar({ enviar }: { enviar: () => Promise<void> }) {
  const [espera, setEspera] = useState(60);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);
  return (
    <button type="button" className="login-enlace" disabled={espera > 0 || enviando}
      onClick={async () => { setEnviando(true); try { await enviar(); setEspera(60); } finally { setEnviando(false); } }}>
      {espera > 0 ? `Mandar otro código en ${espera} s` : "Mandar otro código"}
    </button>
  );
}

// ------------------------------------------------------------------ iniciar sesión
function Entrar({ ir, correoInicial, exito }: { ir: (v: Vista) => void; correoInicial: string; exito: string | null }) {
  const { entrar, aviso } = useSesion();
  const [correo, setCorreo] = useState(correoInicial);
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(aviso);
  const [bloqueada, setBloqueada] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!correo.trim() || !contrasena) {
      setError("Escribe tu correo y tu contraseña.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await entrar(correo.trim(), contrasena);
    } catch (err) {
      const e2 = err as ApiError;
      setBloqueada(e2.codigo === "CUENTA_BLOQUEADA");
      setError(e2.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="login-form" onSubmit={enviar} noValidate>
      <h1>Inicia sesión</h1>
      <p className="login-sub">Usa tu correo institucional y tu contraseña.</p>
      {exito && !error && <Mensaje tipo="exito">{exito}</Mensaje>}
      {error && <Mensaje tipo={bloqueada ? "aviso" : "error"}>{error}</Mensaje>}
      <Campo etiqueta="Correo">
        <input type="email" autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)}
          placeholder={`tu.correo${DOMINIO}`} required autoFocus={!correoInicial} />
      </Campo>
      <Campo etiqueta="Contraseña">
        <input type="password" autoComplete="current-password" value={contrasena}
          onChange={(e) => setContrasena(e.target.value)} required autoFocus={!!correoInicial} />
      </Campo>
      <button type="button" className="login-enlace derecha" onClick={() => ir("recuperar")}>¿Olvidaste tu contraseña?</button>
      <Boton type="submit" cargando={enviando} className="btn-ancho">Entrar</Boton>
      <p className="login-cambio">¿No tienes cuenta? <button type="button" className="login-enlace" onClick={() => ir("registro")}>Crear cuenta</button></p>
      <p className="login-nota">Después de 5 intentos fallidos la cuenta se bloquea 15 minutos.</p>
    </form>
  );
}

// ------------------------------------------------------------------ crear cuenta
function Registrarse({ ir, terminar }: { ir: (v: Vista) => void; terminar: (correo: string, mensaje: string) => void }) {
  const { entrar } = useSesion();
  const [paso, setPaso] = useState<"datos" | "codigo">("datos");
  const [rol, setRol] = useState<"Alumno" | "Docente">("Alumno");
  const [d, setD] = useState({ nombres: "", apellidos: "", matricula: "", correo: "", contrasena: "", repetir: "" });
  const [errores, setErrores] = useState<Errores>({});
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const poner = (campo: keyof typeof d, valor: string) => {
    setD((x) => ({ ...x, [campo]: valor }));
    if (errores[campo]) setErrores((x) => ({ ...x, [campo]: null }));
  };

  function revisar(): boolean {
    const e: Errores = {
      nombres: revisarNombre(d.nombres, "nombres"),
      apellidos: revisarNombre(d.apellidos, "apellidos"),
      matricula: rol === "Alumno" && d.matricula.length !== 8 ? "La matrícula son 8 números." : null,
      correo: revisarCorreo(d.correo),
      contrasena: revisarContrasena(d.contrasena),
      repetir: d.repetir !== d.contrasena ? "Las contraseñas no coinciden." : null,
    };
    setErrores(e);
    return !Object.values(e).some(Boolean);
  }

  async function mandarDatos(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!revisar()) return;
    setEnviando(true);
    try {
      await api("/api/auth/registro", {
        method: "POST", sinSesion: true,
        body: { nombres: d.nombres.trim(), apellidos: d.apellidos.trim(), correo: d.correo.trim(), rol,
                matricula: rol === "Alumno" ? d.matricula : null, contrasena: d.contrasena },
      });
      setCodigo("");
      setPaso("codigo");
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setEnviando(false);
    }
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (codigo.length !== 6) {
      setError("Escribe los 6 números del código.");
      return;
    }
    setEnviando(true);
    try {
      const r = await api<{ rol: string; pendiente: boolean }>("/api/auth/registro/confirmar", {
        method: "POST", sinSesion: true, body: { correo: d.correo.trim(), codigo },
      });
      if (r.pendiente) {
        terminar(d.correo.trim(), "Tu correo quedó confirmado. Como te registraste como docente, Servicios Extra-Escolares debe activar tu cuenta antes de que puedas entrar.");
      } else {
        await entrar(d.correo.trim(), d.contrasena);
      }
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setEnviando(false);
    }
  }

  if (paso === "codigo") {
    return (
      <form className="login-form" onSubmit={confirmar} noValidate>
        <h1>Confirma tu correo</h1>
        <p className="login-sub">Te mandamos un código de 6 números a <strong>{d.correo.trim().toLowerCase()}</strong>.</p>
        {error && <Mensaje>{error}</Mensaje>}
        <CampoCodigo valor={codigo} cambiar={setCodigo} />
        <Boton type="submit" cargando={enviando} className="btn-ancho">Confirmar y crear cuenta</Boton>
        <div className="login-acciones">
          <button type="button" className="login-enlace" onClick={() => { setPaso("datos"); setError(null); }}>Cambiar mis datos</button>
          <Reenviar enviar={async () => {
            await api("/api/auth/registro/reenviar", { method: "POST", sinSesion: true, body: { correo: d.correo.trim() } })
              .catch((err) => setError((err as ApiError).message));
          }} />
        </div>
      </form>
    );
  }

  return (
    <form className="login-form" onSubmit={mandarDatos} noValidate>
      <h1>Crear cuenta</h1>
      <p className="login-sub">Solo para alumnos y docentes del ITP, con correo institucional.</p>
      {error && <Mensaje>{error}</Mensaje>}
      <fieldset className="campo">
        <legend className="campo-etiqueta">Soy</legend>
        <div className="login-rol" role="radiogroup">
          {(["Alumno", "Docente"] as const).map((r) => (
            <button key={r} type="button" role="radio" aria-checked={rol === r} className={rol === r ? "activo" : ""}
              onClick={() => setRol(r)}>
              <Icono nombre={r === "Alumno" ? "persona" : "grupos"} tam={18} />{r}
            </button>
          ))}
        </div>
        {rol === "Docente" && <span className="campo-ayuda">Tu cuenta quedará pendiente hasta que Servicios Extra-Escolares la active.</span>}
      </fieldset>
      <div className="login-dos">
        <Campo etiqueta="Nombre(s)" error={errores.nombres}>
          <input autoComplete="given-name" value={d.nombres} maxLength={70}
            onChange={(e) => poner("nombres", soloLetras(e.target.value))} />
        </Campo>
        <Campo etiqueta="Apellidos" error={errores.apellidos}>
          <input autoComplete="family-name" value={d.apellidos} maxLength={70}
            onChange={(e) => poner("apellidos", soloLetras(e.target.value))} />
        </Campo>
      </div>
      {rol === "Alumno" && (
        <Campo etiqueta="Matrícula" error={errores.matricula} ayuda="Son 8 números, por ejemplo 21200123.">
          <input inputMode="numeric" value={d.matricula} maxLength={8}
            onChange={(e) => poner("matricula", soloNumeros(e.target.value, 8))} />
        </Campo>
      )}
      <Campo etiqueta="Correo institucional" error={errores.correo}>
        <input type="email" autoComplete="email" value={d.correo} placeholder={`tu.correo${DOMINIO}`}
          onChange={(e) => poner("correo", e.target.value.replace(/\s/g, ""))} />
      </Campo>
      <Campo etiqueta="Contraseña" error={errores.contrasena} ayuda="Mínimo 8 caracteres, con letras y números.">
        <input type="password" autoComplete="new-password" value={d.contrasena} maxLength={72}
          onChange={(e) => poner("contrasena", e.target.value)} />
      </Campo>
      <Campo etiqueta="Repite la contraseña" error={errores.repetir}>
        <input type="password" autoComplete="new-password" value={d.repetir} maxLength={72}
          onChange={(e) => poner("repetir", e.target.value)} />
      </Campo>
      <Boton type="submit" cargando={enviando} className="btn-ancho">Mandar código a mi correo</Boton>
      <p className="login-cambio">¿Ya tienes cuenta? <button type="button" className="login-enlace" onClick={() => ir("entrar")}>Inicia sesión</button></p>
    </form>
  );
}

// ------------------------------------------------------------------ recuperar contraseña
function Recuperar({ ir, terminar }: { ir: (v: Vista) => void; terminar: (correo: string, mensaje: string) => void }) {
  const [paso, setPaso] = useState<"correo" | "codigo">("correo");
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const pedirCodigo = () => api("/api/auth/recuperar", { method: "POST", sinSesion: true, body: { correo: correo.trim() } });

  async function mandarCorreo(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const ec = revisarCorreo(correo);
    setErrores({ correo: ec });
    if (ec) return;
    setEnviando(true);
    try {
      await pedirCodigo();
      setPaso("codigo");
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setEnviando(false);
    }
  }

  async function cambiar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const ee: Errores = {
      codigo: codigo.length !== 6 ? "Escribe los 6 números del código." : null,
      nueva: revisarContrasena(nueva),
      repetir: repetir !== nueva ? "Las contraseñas no coinciden." : null,
    };
    setErrores(ee);
    if (Object.values(ee).some(Boolean)) return;
    setEnviando(true);
    try {
      await api("/api/auth/recuperar/confirmar", {
        method: "POST", sinSesion: true, body: { correo: correo.trim(), codigo, contrasena: nueva },
      });
      terminar(correo.trim(), "Listo, tu contraseña cambió. Ya puedes entrar con la nueva.");
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setEnviando(false);
    }
  }

  if (paso === "codigo") {
    return (
      <form className="login-form" onSubmit={cambiar} noValidate>
        <h1>Nueva contraseña</h1>
        <p className="login-sub">Si <strong>{correo.trim().toLowerCase()}</strong> tiene cuenta, le llegó un código de 6 números.</p>
        {error && <Mensaje>{error}</Mensaje>}
        <CampoCodigo valor={codigo} cambiar={(v) => { setCodigo(v); setErrores((x) => ({ ...x, codigo: null })); }} error={errores.codigo} />
        <Campo etiqueta="Contraseña nueva" error={errores.nueva} ayuda="Mínimo 8 caracteres, con letras y números.">
          <input type="password" autoComplete="new-password" value={nueva} maxLength={72} onChange={(e) => setNueva(e.target.value)} />
        </Campo>
        <Campo etiqueta="Repite la contraseña nueva" error={errores.repetir}>
          <input type="password" autoComplete="new-password" value={repetir} maxLength={72} onChange={(e) => setRepetir(e.target.value)} />
        </Campo>
        <Boton type="submit" cargando={enviando} className="btn-ancho">Cambiar contraseña</Boton>
        <div className="login-acciones">
          <button type="button" className="login-enlace" onClick={() => { setPaso("correo"); setError(null); }}>Usar otro correo</button>
          <Reenviar enviar={async () => { await pedirCodigo().catch((err) => setError((err as ApiError).message)); }} />
        </div>
      </form>
    );
  }

  return (
    <form className="login-form" onSubmit={mandarCorreo} noValidate>
      <h1>Recuperar contraseña</h1>
      <p className="login-sub">Escribe tu correo institucional y te mandamos un código para poner una contraseña nueva.</p>
      {error && <Mensaje>{error}</Mensaje>}
      <Campo etiqueta="Correo institucional" error={errores.correo}>
        <input type="email" autoComplete="email" value={correo} placeholder={`tu.correo${DOMINIO}`} autoFocus
          onChange={(e) => { setCorreo(e.target.value.replace(/\s/g, "")); setErrores({}); }} />
      </Campo>
      <Boton type="submit" cargando={enviando} className="btn-ancho">Mandar código</Boton>
      <p className="login-cambio"><button type="button" className="login-enlace" onClick={() => ir("entrar")}>Volver a iniciar sesión</button></p>
    </form>
  );
}

// ------------------------------------------------------------------ pantalla
export function Login() {
  const [vista, setVista] = useState<Vista>("entrar");
  const [correo, setCorreo] = useState("");
  const [exito, setExito] = useState<string | null>(null);

  const ir = (v: Vista) => { setExito(null); setVista(v); };
  const terminar = (c: string, mensaje: string) => { setCorreo(c); setExito(mensaje); setVista("entrar"); };

  return (
    <div className="login">
      <section className="login-arte" aria-hidden>
        <div className="login-pizarron">
          <span className="login-sello">ITP · Servicios Extra-Escolares</span>
          <p className="login-lema">Deporte, arte y cultura,<br />en un solo lugar.</p>
          <ol className="login-semana">
            {["L", "M", "X", "J", "V", "S"].map((d, i) => (
              <li key={d} className={[0, 2, 4].includes(i) ? "on" : ""}>{d}</li>
            ))}
          </ol>
          <p className="login-detalle">Revisa horarios, aparta tu lugar y sigue tu crédito complementario desde el celular.</p>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-caja">
          <div className="login-marca">
            <svg viewBox="0 0 32 32" width="40" height="40" aria-hidden>
              <rect x="4" y="18" width="5" height="10" rx="1.5" fill="#1E7F55" />
              <rect x="11.5" y="12" width="5" height="16" rx="1.5" fill="#2FA36F" />
              <rect x="19" y="6" width="5" height="22" rx="1.5" fill="#F0B73A" />
            </svg>
            <span>SIGAE</span>
          </div>
          {vista === "entrar" && <Entrar key={correo + (exito ?? "")} ir={ir} correoInicial={correo} exito={exito} />}
          {vista === "registro" && <Registrarse ir={ir} terminar={terminar} />}
          {vista === "recuperar" && <Recuperar ir={ir} terminar={terminar} />}
        </div>
      </section>
    </div>
  );
}
