import { useEffect, useState } from "react";
import { Marcador, TiraDias } from "../components/Horario";
import { Icono } from "../components/Icono";
import { Boton, CajaError, Cargando, Confirmar, Encabezado, Insignia, useAvisos, Vacio } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { diasMarcados, hora } from "../lib/formato";
import { Enlace } from "../lib/router";
import type { ActividadCatalogo, MiInscripcion } from "../lib/tipos";
import { useCarga } from "../lib/useCarga";

const LETRAS = ["L", "M", "X", "J", "V", "S"];

/** Letras de los días que tiene una actividad, por ejemplo "Martes y Jueves" → ["M", "J"]. */
function letrasDe(dias: string) {
  return diasMarcados(dias).filter((d) => d.activo).map((d) => d.corto);
}

/** Inscripciones vigentes con las que se cruza (mismo día y horas encimadas). Solo avisa, no bloquea. */
function choquesDe(a: ActividadCatalogo, mias: MiInscripcion[]) {
  const diasA = letrasDe(a.dias);
  return mias.filter((i) =>
    i.id_actividad !== a.id_actividad &&
    letrasDe(i.dias).some((d) => diasA.includes(d)) &&
    a.hora_inicio < i.hora_fin && i.hora_inicio < a.hora_fin,
  );
}

export function Catalogo() {
  const [texto, setTexto] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [soloLibres, setSoloLibres] = useState(false);
  const [diasFiltro, setDiasFiltro] = useState<string[]>([]);
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
  const { datos: misDatos, recargar: recargarMias } = useCarga<MiInscripcion[]>("/api/inscripciones");
  const mias = (misDatos ?? []).filter((i) => i.estado_inscripcion !== "Cancelada");

  const lista = (datos ?? [])
    .filter((a) => !soloLibres || a.lugares_disponibles > 0)
    .filter((a) => diasFiltro.length === 0 || letrasDe(a.dias).some((d) => diasFiltro.includes(d)));
  const hayFiltros = soloLibres || diasFiltro.length > 0;

  function alternarDia(letra: string) {
    setDiasFiltro((x) => (x.includes(letra) ? x.filter((d) => d !== letra) : [...x, letra]));
  }
  const periodoCerrado = datos && datos.length > 0 && datos.every((a) => !a.periodo_abierto);

  async function inscribir() {
    if (!elegida) return;
    setEnviando(true);
    try {
      await api(`/api/actividades/${elegida.id_actividad}/inscripcion`, { method: "POST" });
      avisar(`Te inscribiste a ${elegida.nombre}`);
      setElegida(null);
      recargar();
      recargarMias();
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

      <fieldset className="filtro-dias" aria-label="Filtrar por día">
        <span>Días:</span>
        {LETRAS.map((l) => (
          <label key={l} className={`dia-chip ${diasFiltro.includes(l) ? "on" : ""}`}>
            <input type="checkbox" checked={diasFiltro.includes(l)} onChange={() => alternarDia(l)}
              aria-label={diasMarcados("").find((d) => d.corto === l)?.largo} />
            <span>{l}</span>
          </label>
        ))}
        {hayFiltros && (
          <Boton variante="fantasma" onClick={() => { setDiasFiltro([]); setSoloLibres(false); }}>Quitar filtros</Boton>
        )}
      </fieldset>

      {datos && datos.length > 0 && hayFiltros && (
        <p className="filtro-cuenta">Mostrando {lista.length} de {datos.length} actividades</p>
      )}

      {periodoCerrado && (
        <div className="aviso-suave aviso-ambar">Las inscripciones están cerradas en este momento. Puedes consultar las actividades, pero no inscribirte.</div>
      )}

      {cargando && !datos && <Cargando texto="Buscando actividades…" />}
      {error && <CajaError mensaje={error} reintentar={recargar} />}
      {datos && lista.length === 0 && (
        <Vacio titulo={busqueda || hayFiltros ? "No encontramos actividades con esos filtros" : "No hay actividades disponibles"}
          texto={busqueda || hayFiltros ? "Prueba con otra palabra u otros días." : "Cuando Servicios Extra-Escolares publique actividades, aparecerán aquí."} />
      )}

      <div className="tarjetas" aria-busy={cargando}>
        {lista.map((a) => {
          const puede = a.periodo_abierto && !a.ya_inscrito && a.lugares_disponibles > 0 && a.estado === "Activa";
          const choques = a.ya_inscrito ? [] : choquesDe(a, mias);
          return (
            <article key={a.id_actividad} className={`tarjeta-act ${a.ya_inscrito ? "inscrito" : ""}`}>
              <div className="tarjeta-act-cuerpo">
                <div className="tarjeta-act-cabeza">
                  <h2>{a.nombre}</h2>
                  {a.ya_inscrito ? <span className="insignia insignia-verde">Inscrito</span> : a.estado !== "Activa" && <Insignia valor={a.estado} />}
                </div>
                {a.descripcion && <p className="tarjeta-act-desc">{a.descripcion}</p>}
                <TiraDias dias={a.dias} inicio={a.hora_inicio} fin={a.hora_fin} />
                {choques.length > 0 && (
                  <p className="choque">Se cruza con tu horario de {choques.map((c) => c.actividad).join(", ")}</p>
                )}
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
            {choquesDe(elegida, mias).length > 0 && (
              <p className="choque">Ojo: se cruza con {choquesDe(elegida, mias).map((c) => c.actividad).join(", ")}. Revisa que puedas asistir a las dos.</p>
            )}
            <p className="texto-suave">Para acreditar necesitas cumplir la asistencia mínima y entregar tu evidencia.</p>
          </>
        )}
      />
    </>
  );
}
