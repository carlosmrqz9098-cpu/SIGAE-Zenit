import { useEffect, useState } from "react";
import { Marcador, TiraDias } from "../components/Horario";
import { Icono } from "../components/Icono";
import { Boton, CajaError, Cargando, Confirmar, Encabezado, Insignia, useAvisos, Vacio } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { hora } from "../lib/formato";
import { Enlace } from "../lib/router";
import type { ActividadCatalogo } from "../lib/tipos";
import { useCarga } from "../lib/useCarga";

export function Catalogo() {
  const [texto, setTexto] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [soloLibres, setSoloLibres] = useState(false);
  const [elegida, setElegida] = useState<ActividadCatalogo | null>(null);
  const [enviando, setEnviando] = useState(false);
  const avisar = useAvisos();

  useEffect(() => {
    const t = setTimeout(() => setBusqueda(texto.trim()), 350);
    return () => clearTimeout(t);
  }, [texto]);

  const { datos, error, cargando, recargar } = useCarga<ActividadCatalogo[]>(
    `/api/catalogo${busqueda ? `?buscar=${encodeURIComponent(busqueda)}` : ""}`,
  );
  const lista = (datos ?? []).filter((a) => !soloLibres || a.lugares_disponibles > 0);
  const periodoCerrado = datos && datos.length > 0 && datos.every((a) => !a.periodo_abierto);

  async function inscribir() {
    if (!elegida) return;
    setEnviando(true);
    try {
      await api(`/api/actividades/${elegida.id_actividad}/inscripcion`, { method: "POST" });
      avisar(`Te inscribiste a ${elegida.nombre}`);
      setElegida(null);
      recargar();
    } catch (e) {
      avisar((e as ApiError).message, "error");
      setElegida(null);
      recargar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Encabezado titulo="Catálogo de actividades" texto="Elige una actividad con lugares libres e inscríbete. Cada inscripción cuenta para tu crédito complementario." />

      <div className="filtros">
        <label className="buscador">
          <Icono nombre="buscar" tam={18} />
          <input type="search" placeholder="Buscar por nombre, aula o responsable" value={texto}
            onChange={(e) => setTexto(e.target.value)} aria-label="Buscar actividades" />
        </label>
        <label className="interruptor">
          <input type="checkbox" checked={soloLibres} onChange={(e) => setSoloLibres(e.target.checked)} />
          <span>Solo con lugares libres</span>
        </label>
      </div>

      {periodoCerrado && (
        <div className="aviso-suave aviso-ambar">Las inscripciones están cerradas en este momento. Puedes consultar las actividades, pero no inscribirte.</div>
      )}

      {cargando && !datos && <Cargando texto="Buscando actividades…" />}
      {error && <CajaError mensaje={error} reintentar={recargar} />}
      {datos && lista.length === 0 && (
        <Vacio titulo={busqueda ? "No encontramos actividades con esa búsqueda" : "No hay actividades disponibles"}
          texto={busqueda ? "Prueba con otra palabra." : "Cuando Servicios Extra-Escolares publique actividades, aparecerán aquí."} />
      )}

      <div className="tarjetas" aria-busy={cargando}>
        {lista.map((a) => {
          const puede = a.periodo_abierto && !a.ya_inscrito && a.lugares_disponibles > 0 && a.estado === "Activa";
          return (
            <article key={a.id_actividad} className={`tarjeta-act ${a.ya_inscrito ? "inscrito" : ""}`}>
              <div className="tarjeta-act-cuerpo">
                <div className="tarjeta-act-cabeza">
                  <h2>{a.nombre}</h2>
                  {a.ya_inscrito ? <span className="insignia insignia-verde">Inscrito</span> : a.estado !== "Activa" && <Insignia valor={a.estado} />}
                </div>
                {a.descripcion && <p className="tarjeta-act-desc">{a.descripcion}</p>}
                <TiraDias dias={a.dias} inicio={a.hora_inicio} fin={a.hora_fin} />
                <ul className="datos-mini">
                  <li><Icono nombre="lugar" tam={16} />{a.aula}{a.ubicacion ? `, ${a.ubicacion}` : ""}</li>
                  {a.responsable && <li><Icono nombre="persona" tam={16} />{a.responsable}</li>}
                </ul>
              </div>
              <div className="tarjeta-act-pie">
                <Marcador inscritos={a.inscritos} cupo={a.cupo_maximo} />
                {a.ya_inscrito ? (
                  <Enlace a="/mis-inscripciones" className="btn btn-secundario">Ver mi inscripción</Enlace>
                ) : (
                  <Boton onClick={() => setElegida(a)} disabled={!puede}>
                    {a.lugares_disponibles === 0 ? "Sin lugares" : !a.periodo_abierto ? "Inscripciones cerradas" : "Inscribirme"}
                  </Boton>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <Confirmar
        abierto={!!elegida}
        titulo="Confirmar inscripción"
        accion="Sí, inscribirme"
        cargando={enviando}
        alCerrar={() => setElegida(null)}
        alConfirmar={inscribir}
        texto={elegida && (
          <>
            <p>Te vas a inscribir a <strong>{elegida.nombre}</strong>.</p>
            <p>{elegida.dias}, de {hora(elegida.hora_inicio)} a {hora(elegida.hora_fin)}, en {elegida.aula}.</p>
            <p className="texto-suave">Para acreditar necesitas cumplir la asistencia mínima y entregar tu evidencia.</p>
          </>
        )}
      />
    </>
  );
}
