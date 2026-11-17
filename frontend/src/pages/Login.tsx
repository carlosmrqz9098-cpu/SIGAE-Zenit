import { useState, type FormEvent } from "react";
import { Icono } from "../components/Icono";
import { Boton } from "../components/ui";
import { ApiError } from "../lib/api";
import { useSesion } from "../lib/sesion";

export function Login() {
  const { entrar, aviso } = useSesion();
  const [correo, setCorreo] = useState("");
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
        <form className="login-form" onSubmit={enviar} noValidate>
          <div className="login-marca">
            <svg viewBox="0 0 32 32" width="40" height="40" aria-hidden>
              <rect x="4" y="18" width="5" height="10" rx="1.5" fill="#1E7F55" />
              <rect x="11.5" y="12" width="5" height="16" rx="1.5" fill="#2FA36F" />
              <rect x="19" y="6" width="5" height="22" rx="1.5" fill="#F0B73A" />
            </svg>
            <span>SIGAE</span>
          </div>
          <h1>Inicia sesión</h1>
          <p className="login-sub">Usa el correo y la contraseña que te dio Servicios Extra-Escolares.</p>

          {error && (
            <div className={`login-error ${bloqueada ? "bloqueada" : ""}`} role="alert">
              <Icono nombre={bloqueada ? "bloquear" : "alerta"} tam={18} />
              <span>{error}</span>
            </div>
          )}

          <label className="campo">
            <span className="campo-etiqueta">Correo</span>
            <input type="email" autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)}
              placeholder="tu.correo@pachuca.tecnm.mx" required autoFocus />
          </label>
          <label className="campo">
            <span className="campo-etiqueta">Contraseña</span>
            <input type="password" autoComplete="current-password" value={contrasena}
              onChange={(e) => setContrasena(e.target.value)} required />
          </label>
          <Boton type="submit" cargando={enviando} className="btn-ancho">Entrar</Boton>
          <p className="login-nota">Después de 5 intentos fallidos la cuenta se bloquea 15 minutos.</p>
        </form>
      </section>
    </div>
  );
}
